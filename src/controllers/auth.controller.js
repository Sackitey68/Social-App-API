const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { validateRequired } = require('../utils/validate');

/**
 * POST /api/auth/signup
 * Public
 */
const signup = asyncHandler(async (req, res) => {
  const { first_name, last_name, username, email, password } = req.body;

  validateRequired(req.body, [
    'first_name',
    'last_name',
    'username',
    'email',
    'password',
  ]);

  const existingEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    throw new ApiError(409, 'Email is already in use');
  }

  const existingUsername = await User.findOne({ username: username.toLowerCase() });
  if (existingUsername) {
    throw new ApiError(409, 'Username is already taken');
  }

  const user = await User.create({
    first_name,
    last_name,
    username,
    email,
    password,
  });

  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: user.toJSON(),
      token,
    },
  });
});

/**
 * POST /api/auth/signin
 * Public
 */
const signin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  validateRequired(req.body, ['email', 'password']);

  // Password is `select: false` on the schema — pull it in explicitly.
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  // Use a single generic message for both "no such email" and "wrong password".
  // This prevents attackers from enumerating which emails exist.
  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const token = generateToken(user._id);

  // user.toJSON() strips password automatically
  res.status(200).json({
    success: true,
    message: 'Signed in successfully',
    data: {
      user: user.toJSON(),
      token,
    },
  });
});

module.exports = { signup, signin };