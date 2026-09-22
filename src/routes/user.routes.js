const express = require('express');
const { protect } = require('../middleware/auth');
const { followUser, unfollowUser } = require('../controllers/user.controller');

const router = express.Router();

// POST /api/users/:id/follow
router.post('/:id/follow', protect, followUser);

// DELETE /api/users/:id/follow
router.delete('/:id/follow', protect, unfollowUser);

module.exports = router;