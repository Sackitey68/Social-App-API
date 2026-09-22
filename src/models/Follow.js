const mongoose = require('mongoose');

const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Follower is required'],
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Following is required'],
    },
  },
  { timestamps: true }
);

// Prevent duplicate follows (req #14) at the DB level
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// Fast lookups for "who am I following" and "who follows me"
followSchema.index({ follower: 1 });
followSchema.index({ following: 1 });

module.exports = mongoose.model('Follow', followSchema);