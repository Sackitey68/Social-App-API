// src/routes/user.routes.js
const express = require('express');
const { protect } = require('../middleware/auth');
const {
  followUser,
  unfollowUser,
  getFollowing,
  getFollowers,
} = require('../controllers/user.controller');

const router = express.Router();

// Public
router.get('/:id/following', getFollowing);
router.get('/:id/followers', getFollowers);

// Private
router.post('/:id/follow', protect, followUser);
router.delete('/:id/follow', protect, unfollowUser);

module.exports = router;