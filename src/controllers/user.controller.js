const mongoose = require('mongoose');
const User = require('../models/User');
const Follow = require('../models/Follow');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPagination } = require('../utils/query');

const USER_FIELDS = 'first_name last_name username email';

// FOLLOW 
const followUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid user id');
  }

  if (String(id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot follow yourself');
  }

  const target = await User.findById(id, '_id username');
  if (!target) {
    throw new ApiError(404, 'User not found');
  }

  const existing = await Follow.findOne({ follower: req.user._id, following: id });
  if (existing) {
    throw new ApiError(409, 'You already follow this user');
  }

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
    data: { follower: req.user._id, following: target._id },
  });
});

// UNFOLLOW 
const unfollowUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid user id');
  }

  if (String(id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot unfollow yourself');
  }

  await Follow.deleteOne({ follower: req.user._id, following: id });

  res.status(200).json({
    success: true,
    message: 'Unfollowed successfully',
    data: { follower: req.user._id, following: id },
  });
});

// FOLLOWERS / FOLLOWING 
/**
 * GET /api/users/:id/following
 * Public — returns users that :id follows (req #16).
 */
const getFollowing = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid user id');
  }

  const userExists = await User.exists({ _id: id });
  if (!userExists) {
    throw new ApiError(404, 'User not found');
  }

  const { page, limit, skip } = getPagination(req.query);

  const [rows, total] = await Promise.all([
    Follow.find({ follower: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('following', USER_FIELDS),
    Follow.countDocuments({ follower: id }),
  ]);

  const users = rows.map((r) => r.following.toJSON());

  res.status(200).json({
    success: true,
    data: {
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

/**
 * GET /api/users/:id/followers
 * Public — returns users that follow :id (req #17).
 */
const getFollowers = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid user id');
  }

  const userExists = await User.exists({ _id: id });
  if (!userExists) {
    throw new ApiError(404, 'User not found');
  }

  const { page, limit, skip } = getPagination(req.query);

  const [rows, total] = await Promise.all([
    Follow.find({ following: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('follower', USER_FIELDS),
    Follow.countDocuments({ following: id }),
  ]);

  const users = rows.map((r) => r.follower.toJSON());

  res.status(200).json({
    success: true,
    data: {
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

module.exports = {
  followUser,
  unfollowUser,
  getFollowing,
  getFollowers,
};