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

  // 1) Presence check — clean 400 if any missing
  validateRequired(req.body, [
    'first_name',
    'last_name',
    'username',
    'email',
    'password',
  ]);

  // 2) Explicit duplicate check for nicer error messages
  //    (the unique index also protects us, but this gives a field-specific message)
  const existingEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    throw new ApiError(409, 'Email is already in use');
  }

  const existingUsername = await User.findOne({ username: username.toLowerCase() });
  if (existingUsername) {
    throw new ApiError(409, 'Username is already taken');
  }

  // 3) Create the user (password is hashed by the pre-save hook)
  const user = await User.create({
    first_name,
    last_name,
    username,
    email,
    password,
  });

  // 4) Sign a JWT for immediate session
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

module.exports = { signup };