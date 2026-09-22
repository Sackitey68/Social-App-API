const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: [true, 'Post is required'],
    },
  },
  { timestamps: true }
);

// Prevent duplicate likes 
likeSchema.index({ user: 1, post: 1 }, { unique: true });

// Fast lookups
likeSchema.index({ user: 1 });
likeSchema.index({ post: 1 });

module.exports = mongoose.model('Like', likeSchema);