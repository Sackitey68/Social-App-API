const mongoose = require('mongoose');
const User = require('../models/User');
const Follow = require('../models/Follow');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * POST /api/users/:id/follow
 * Private — req.user follows the user identified by :id
 */
const followUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid user id');
  }

  // Cannot follow yourself
  if (String(id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot follow yourself');
  }

  // Target must exist
  const target = await User.findById(id, '_id username');
  if (!target) {
    throw new ApiError(404, 'User not found');
  }

  // Prevent duplicate follow 
  const existing = await Follow.findOne({ follower: req.user._id, following: id });
  if (existing) {
    throw new ApiError(409, 'You already follow this user');
  }

  // Create the follow. The unique index guards against races.
  try {
    await Follow.create({ follower: req.user._id, following: id });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'You already follow this user');
    }
    throw err;
  }

  res.status(200).json({
    success: true,
    message: `You are now following ${target.username}`,
    data: {
      follower: req.user._id,
      following: target._id,
    },
  });
});

/**
 * DELETE /api/users/:id/follow
 * Private — req.user unfollows 
 */
const unfollowUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid user id');
  }

  if (String(id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot unfollow yourself');
  }

  // Idempotent: no error if the follow never existed
  await Follow.deleteOne({ follower: req.user._id, following: id });

  res.status(200).json({
    success: true,
    message: 'Unfollowed successfully',
    data: {
      follower: req.user._id,
      following: id,
    },
  });
});

module.exports = { followUser, unfollowUser };