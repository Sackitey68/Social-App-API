const ApiError = require('./ApiError');

/**
 * Ensures all required fields are present and non-empty on req.body.
 * Throws ApiError(400) listing missing fields.
 *
 * Usage:
 *   validateRequired(req.body, ['first_name', 'email', 'password']);
 */
const validateRequired = (body, fields) => {
  const missing = fields.filter((field) => {
    const value = body[field];
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  });
  if (missing.length > 0) {
    throw new ApiError(400, `Missing required field(s): ${missing.join(', ')}`);
  }
};

module.exports = { validateRequired };