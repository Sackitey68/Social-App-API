const jwt = require('jsonwebtoken');

/**
 * Sign a JWT for a given user id.
 * Expiry is controlled by JWT_EXPIRES_IN in .env (default: 1h).
 */
const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
};

module.exports = generateToken;