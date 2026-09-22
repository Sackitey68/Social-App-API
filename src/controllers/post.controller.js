const Post = require('../models/Post');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { validateRequired } = require('../utils/validate');

/**
 * POST /api/posts
 * Private — creates a post owned by req.user, always in "draft" state.
 */
const createPost = asyncHandler(async (req, res) => {
  const { title, content, tags } = req.body;

  validateRequired(req.body, ['title', 'content']);


  // New posts always start as drafts 
  const post = await Post.create({
    title,
    content,
    tags: Array.isArray(tags) ? tags : [],
    author: req.user._id,
    state: 'draft',
  });

  // Populate author for the response (no password leaks because of User.toJSON)
  await post.populate('author', 'first_name last_name username email');

  res.status(201).json({
    success: true,
    message: 'Post created successfully',
    data: { post: post.toJSON() },
  });
});

module.exports = { createPost };