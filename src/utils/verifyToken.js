const jwt = require('jsonwebtoken');

/**
 * Verify a JWT and return its decoded payload.
 * Throws JsonWebTokenError or TokenExpiredError on failure
 * — both are handled centrally in errorHandler.js.
 */
const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = verifyToken;