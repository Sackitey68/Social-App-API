const express = require('express');
const { protect, optionalAuth } = require('../middleware/auth');
const {
  createPost,
  listPosts,
  getPost,
  publishPost,
  updatePost,
  deletePost,
  getMyPosts,
} = require('../controllers/post.controller');
const { likePost, unlikePost } = require('../controllers/like.controller');

const router = express.Router();

// Public
router.get('/', optionalAuth, listPosts);

// Private (before /:id)
router.get('/me', protect, getMyPosts);

// Public single post
router.get('/:id', optionalAuth, getPost);

// Private mutations
router.post('/', protect, createPost);
router.patch('/:id/publish', protect, publishPost);
router.patch('/:id', protect, updatePost);
router.delete('/:id', protect, deletePost);

// Likes
router.post('/:id/like', protect, likePost);
router.delete('/:id/like', protect, unlikePost);

module.exports = router;