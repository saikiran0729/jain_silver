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
      .skip(skip)
      .lean();

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

/**
 * @swagger
 * /news/admin/all:
 *   get:
 *     summary: Get all news posts including unpublished (Admin only)
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of posts to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: published
 *         schema:
 *           type: boolean
 *         description: Filter by published status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: List of news posts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 news:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/News'
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
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

    // Check if News model is available
    if (!News) {
      console.error('News model is not available');
      return res.status(500).json({ message: 'News model not initialized', news: [] });
    }

    const news = await News.find(query)
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean(); // Use lean() for better performance

    const total = await News.countDocuments(query);

    res.json({
      news: news || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total || 0,
        pages: Math.ceil((total || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all news error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      news: [] // Return empty array on error
    });
  }
});

/**
 * @swagger
 * /news:
 *   post:
 *     summary: Create news post (Admin only)
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               image:
 *                 type: string
 *               published:
 *                 type: boolean
 *                 default: false
 *               category:
 *                 type: string
 *                 enum: [announcement, update, offer, general]
 *                 default: general
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: News post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 news:
 *                   $ref: '#/components/schemas/News'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
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
      author: req.user.userId, // Use userId from decoded JWT token
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

/**
 * @swagger
 * /news/{id}:
 *   put:
 *     summary: Update news post (Admin only)
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: News post ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               image:
 *                 type: string
 *               published:
 *                 type: boolean
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: News post updated successfully
 *       404:
 *         description: News post not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /news/{id}:
 *   delete:
 *     summary: Delete news post (Admin only)
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: News post ID
 *     responses:
 *       200:
 *         description: News post deleted successfully
 *       404:
 *         description: News post not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
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

