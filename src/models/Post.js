const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
    tags: {
      type: [String],
      default: [],
      set: (tags) =>
        // normalize: lowercase, trim, drop empties, dedupe
        [...new Set((tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    state: {
      type: String,
      enum: {
        values: ['draft', 'published'],
        message: 'State must be either draft or published',
      },
      default: 'draft',
      index: true,
    },
    like_count: {
      type: Number,
      default: 0,
      min: [0, 'like_count cannot be negative'],
    },
    comment_count: {
      type: Number,
      default: 0,
      min: [0, 'comment_count cannot be negative'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes for query performance 
postSchema.index({ state: 1, timestamp: -1 });           
postSchema.index({ author: 1, state: 1, timestamp: -1 });
postSchema.index({ tags: 1 });                          

// Text index for search (requirement #23)
postSchema.index(
  { title: 'text', content: 'text', tags: 'text' },
  { weights: { title: 5, tags: 3, content: 1 }, name: 'PostTextIndex' }
);

module.exports = mongoose.model('Post', postSchema);