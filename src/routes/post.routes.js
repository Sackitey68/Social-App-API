const express = require('express');
const { protect, optionalAuth } = require('../middleware/auth');
const { createPost, listPosts } = require('../controllers/post.controller');

const router = express.Router();

// GET /api/posts — public 
router.get('/', optionalAuth, listPosts);

// POST /api/posts — private
router.post('/', protect, createPost);

module.exports = router;