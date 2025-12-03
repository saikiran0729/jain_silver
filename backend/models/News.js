const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  image: {
    type: String, // URL to image
    default: null
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  published: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date,
    default: null
  },
  category: {
    type: String,
    enum: ['announcement', 'update', 'offer', 'general'],
    default: 'general'
  },
  tags: [{
    type: String,
    trim: true
  }],
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
newsSchema.index({ published: 1, publishedAt: -1 });
newsSchema.index({ category: 1 });
newsSchema.index({ createdAt: -1 });

const News = mongoose.model('News', newsSchema);

module.exports = News;

