const mongoose = require('mongoose');
const Post = require('../models/Post');
const Like = require('../models/Like');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * POST /api/posts/:id/like
 * Private — req.user likes a published post.
 * Idempotent: liking an already-liked post returns 200 without changing counts.
 */
const likePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid post id');
  }

  const post = await Post.findById(id);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Only published posts can be liked
  if (post.state !== 'published') {
    throw new ApiError(404, 'Post not found');
  }

  // Already liked → idempotent, don't increment again
  const existing = await Like.findOne({ user: req.user._id, post: id });
  if (existing) {
    return res.status(200).json({
      success: true,
      message: 'Post already liked',
      data: {
        post_id: post.id,
        liked: true,
        like_count: post.like_count,
      },
    });
  }

  // Create like + increment counter
  try {
    await Like.create({ user: req.user._id, post: id });
  } catch (err) {
    // Race condition safety net
    if (err.code === 11000) {
      return res.status(200).json({
        success: true,
        message: 'Post already liked',
        data: {
          post_id: post.id,
          liked: true,
          like_count: post.like_count,
        },
      });
    }
    throw err;
  }

  post.like_count += 1;
  await post.save();

  res.status(200).json({
    success: true,
    message: 'Post liked',
    data: {
      post_id: post.id,
      liked: true,
      like_count: post.like_count,
    },
  });
});

/**
 * DELETE /api/posts/:id/like
 * Private — req.user unlikes a post.
 * Idempotent: unliking a post you never liked returns 200 without changing counts.
 */
const unlikePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid post id');
  }

  const post = await Post.findById(id);
  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  const result = await Like.deleteOne({ user: req.user._id, post: id });

  // Only decrement if a like was actually removed
  if (result.deletedCount === 1) {
    post.like_count = Math.max(0, post.like_count - 1);
    await post.save();
  }

  res.status(200).json({
    success: true,
    message: result.deletedCount === 1 ? 'Post unliked' : 'Post was not liked',
    data: {
      post_id: post.id,
      liked: false,
      like_count: post.like_count,
    },
  });
});

module.exports = { likePost, unlikePost };