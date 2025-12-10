const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Root route - get users data from MongoDB
router.get('/', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // Use centralized connection helper if available, otherwise connect directly
    let isConnected = false;
    if (req.app.locals && req.app.locals.ensureDBConnection) {
      isConnected = await req.app.locals.ensureDBConnection();
    } else {
      // Fallback: try to connect directly with better timeout for serverless
      if (mongoose.connection.readyState !== 1) {
        try {
          const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jain_silver';
          await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000, // Increased to 10s for Vercel serverless
            socketTimeoutMS: 45000,
            maxPoolSize: 1, // Serverless-friendly pool size
            minPoolSize: 0,
          });
          isConnected = mongoose.connection.readyState === 1;
        } catch (connError) {
          console.error('❌ MongoDB connection failed:', connError.message || connError);
          console.error('   Error details:', {
            name: connError.name,
            code: connError.code,
            hasMongoURI: !!process.env.MONGODB_URI
          });
          isConnected = false;
        }
      } else {
        isConnected = true;
      }
    }
    
    if (!isConnected || mongoose.connection.readyState !== 1) {
      console.error('⚠️ MongoDB connection not ready, returning empty data');
      return res.json({
        message: 'Users API',
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          pages: 0
        },
        statistics: {
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          note: 'MongoDB connection not ready. Check MONGODB_URI environment variable and MongoDB Atlas network access.'
        },
        endpoints: {
          profile: {
            get: '/api/users/profile',
            put: '/api/users/profile',
            description: 'Get or update user profile (requires authentication)'
          }
        }
      });
    }

    const { status, limit = 10, page = 1 } = req.query;
    const query = status ? { status } : {};
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(query)
      .select('-password -otp -resetPasswordOTP')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const totalUsers = await User.countDocuments(query);
    const approvedCount = await User.countDocuments({ status: 'approved' });
    const pendingCount = await User.countDocuments({ status: 'pending' });
    const rejectedCount = await User.countDocuments({ status: 'rejected' });

    res.json({
      message: 'Users API',
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / parseInt(limit))
      },
      statistics: {
        total: totalUsers,
        approved: approvedCount,
        pending: pendingCount,
        rejected: rejectedCount
      },
      endpoints: {
        profile: {
          get: '/api/users/profile',
          put: '/api/users/profile',
          description: 'Get or update user profile (requires authentication)'
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -otp -resetPasswordOTP');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Format document URLs with CloudFront
    const { formatUserDocuments } = require('../utils/documentHelper');
    const formattedUser = formatUserDocuments(user);
    
    res.json(formattedUser);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    user.updatedAt = new Date();

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

