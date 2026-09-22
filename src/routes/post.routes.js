// src/routes/post.routes.js
const express = require('express');
const { protect } = require('../middleware/auth');
const { createPost } = require('../controllers/post.controller');

const router = express.Router();

// POST /api/posts (private)
router.post('/', protect, createPost);

module.exports = router;