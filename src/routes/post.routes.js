const express = require("express");
const { protect, optionalAuth } = require("../middleware/auth");
const {
  createPost,
  listPosts,
  getPost,
  publishPost,
  updatePost,
  deletePost,
  getMyPosts,
} = require("../controllers/post.controller");

const router = express.Router();

// GET /api/posts — public feed
router.get("/", optionalAuth, listPosts);


router.get("/me", protect, getMyPosts);

// GET /api/posts/:id — public single post
router.get("/:id", optionalAuth, getPost);

// POST /api/posts — private
router.post("/", protect, createPost);
router.patch("/:id/publish", protect, publishPost);
router.patch("/:id", protect, updatePost);
router.delete("/:id", protect, deletePost);

module.exports = router;
