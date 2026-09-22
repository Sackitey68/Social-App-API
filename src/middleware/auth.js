const User = require('../models/User');
const verifyToken = require('../utils/verifyToken');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Extract and verify a Bearer token from the Authorization header.
 * Returns the decoded payload, or throws ApiError(401).
 */
const extractToken = (req) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required');
  }

  const token = header.split(' ')[1];
  if (!token) {
    throw new ApiError(401, 'Authentication required');
  }

  // Throws JsonWebTokenError / TokenExpiredError — caught by errorHandler
  return verifyToken(token);
};

/**
 * protect — requires a valid token.
 * On success, sets req.user (fresh doc from DB).
 */
const protect = asyncHandler(async (req, res, next) => {
  const decoded = extractToken(req);

  const user = await User.findById(decoded.id);
  if (!user) {
    // Token was valid but the user has since been deleted
    throw new ApiError(401, 'User no longer exists');
  }

  req.user = user;
  next();
});

/**
 * optionalAuth — attaches req.user if a valid token is present.
 * No token → continues as anonymous.
 * Bad token → 401 (don't silently ignore an invalid token).
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  // No auth header at all → anonymous
  if (!header) {
    return next();
  }

  // If a header exists, it must be valid
  const decoded = extractToken(req);

  const user = await User.findById(decoded.id);
  if (user) {
    req.user = user;
  }

  next();
});

module.exports = { protect, optionalAuth };