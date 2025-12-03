const express = require('express');
const router = express.Router();
const News = require('../models/News');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Get all published news posts (public)
router.get('/', async (req, res) => {
  try {
    const { limit = 10, page = 1, category } = req.query;
    const query = { published: true };
    
    if (category) {
      query.category = category;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const news = await News.find(query)
      .populate('author', 'name email')
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await News.countDocuments(query);
    
    res.json({
      news,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get news error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single news post by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const news = await News.findById(req.params.id)
      .populate('author', 'name email');
    
    if (!news) {
      return res.status(404).json({ message: 'News post not found' });
    }
    
    // Increment views
    news.views = (news.views || 0) + 1;
    await news.save();
    
    res.json(news);
  } catch (error) {
    console.error('Get news by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all news posts (admin only - includes unpublished)
router.get('/admin/all', auth, adminAuth, async (req, res) => {
  try {
    const { limit = 50, page = 1, published, category } = req.query;
    const query = {};
    
    if (published !== undefined) {
      query.published = published === 'true';
    }
    
    if (category) {
      query.category = category;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const news = await News.find(query)
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await News.countDocuments(query);
    
    res.json({
      news,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all news error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create news post (admin only)
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const { title, content, image, published, category, tags } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }
    
    const news = new News({
      title,
      content,
      image: image || null,
      author: req.user.id,
      published: published || false,
      publishedAt: published ? new Date() : null,
      category: category || 'general',
      tags: tags || []
    });
    
    await news.save();
    
    const populatedNews = await News.findById(news._id)
      .populate('author', 'name email');
    
    res.status(201).json({
      message: 'News post created successfully',
      news: populatedNews
    });
  } catch (error) {
    console.error('Create news error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update news post (admin only)
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { title, content, image, published, category, tags } = req.body;
    
    const news = await News.findById(req.params.id);
    
    if (!news) {
      return res.status(404).json({ message: 'News post not found' });
    }
    
    // Update fields
    if (title !== undefined) news.title = title;
    if (content !== undefined) news.content = content;
    if (image !== undefined) news.image = image;
    if (category !== undefined) news.category = category;
    if (tags !== undefined) news.tags = tags;
    
    // Handle published status
    if (published !== undefined) {
      news.published = published;
      if (published && !news.publishedAt) {
        news.publishedAt = new Date();
      } else if (!published) {
        news.publishedAt = null;
      }
    }
    
    await news.save();
    
    const populatedNews = await News.findById(news._id)
      .populate('author', 'name email');
    
    res.json({
      message: 'News post updated successfully',
      news: populatedNews
    });
  } catch (error) {
    console.error('Update news error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete news post (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    
    if (!news) {
      return res.status(404).json({ message: 'News post not found' });
    }
    
    await News.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'News post deleted successfully' });
  } catch (error) {
    console.error('Delete news error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

