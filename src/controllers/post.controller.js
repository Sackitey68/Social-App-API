const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { validateRequired } = require('../utils/validate');
const { getPagination, buildSort } = require('../utils/query');

// CREATE 
const createPost = asyncHandler(async (req, res) => {
  const { title, content, tags } = req.body;

  validateRequired(req.body, ['title', 'content']);

  const post = await Post.create({
    title,
    content,
    tags: Array.isArray(tags) ? tags : [],
    author: req.user._id,
    state: 'draft',
  });

  await post.populate('author', 'first_name last_name username email');

  res.status(201).json({
    success: true,
    message: 'Post created successfully',
    data: { post: post.toJSON() },
  });
});

// LIST PUBLISHED 
const SORTABLE = ['like_count', 'comment_count', 'timestamp'];

const listPosts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const sort = buildSort(req.query.sort, SORTABLE, '-timestamp');

  const filter = { state: 'published' };
  const { search, tag, author } = req.query;

  if (search) {
    const matchedUsers = await User.find(
      {
        $or: [
          { first_name: { $regex: search, $options: 'i' } },
          { last_name: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
        ],
      },
      '_id'
    );
    const authorIds = matchedUsers.map((u) => u._id);
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } },
      ...(authorIds.length ? [{ author: { $in: authorIds } }] : []),
    ];
  }

  if (tag) filter.tags = tag.toLowerCase();

  if (author) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(author);
    if (isObjectId) {
      filter.author = author;
    } else {
      const user = await User.findOne({ username: author.toLowerCase() }, '_id');
      if (!user) {
        return res.status(200).json({
          success: true,
          data: { posts: [], pagination: { page, limit, total: 0, pages: 0 } },
        });
      }
      filter.author = user._id;
    }
  }

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('author', 'first_name last_name username email'),
    Post.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      posts: posts.map((p) => p.toJSON()),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
});

// GET ONE 
const getPost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Reject malformed ObjectIds before hitting the DB
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid post id');
  }

  const post = await Post.findById(id).populate(
    'author',
    'first_name last_name username email'
  );

  if (!post) {
    throw new ApiError(404, 'Post not found');
  }

  // Draft visibility rules:
  //   - published → visible to everyone
  //   - draft     → visible only to its author (when authenticated)
  if (post.state === 'draft') {
    const isOwner = req.user && String(req.user._id) === String(post.author._id);
    if (!isOwner) {
      // Don't leak that a draft exists — return the same 404 as missing
      throw new ApiError(404, 'Post not found');
    }
  }

  res.status(200).json({
    success: true,
    data: { post: post.toJSON() },
  });
});

module.exports = { createPost, listPosts, getPost };