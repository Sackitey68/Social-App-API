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

//  LIST PUBLISHED 
const SORTABLE = ['like_count', 'comment_count', 'timestamp'];

const listPosts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const sort = buildSort(req.query.sort, SORTABLE, '-timestamp');

  // Base filter: only published posts
  const filter = { state: 'published' };

  // `search` matches title, tags, and author's first_name/last_name/username
  const { search, tag, author } = req.query;

  if (search) {
    // 1) Find users whose name/username matches → collect their IDs
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

    // 2) Match posts by title OR tags OR those authors
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } },
      ...(authorIds.length ? [{ author: { $in: authorIds } }] : []),
    ];
  }

  // Optional dedicated filters 
  if (tag) {
    filter.tags = tag.toLowerCase();
  }
  if (author) {
    // author can be a username or an ObjectId
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

  //  Query 
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
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

module.exports = { createPost, listPosts };