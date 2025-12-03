const express = require('express');
const router = express.Router();
const User = require('../models/User');
const SilverRate = require('../models/SilverRate');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Root route - get admin dashboard data from MongoDB
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      // Try to connect
      try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jain_silver', {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
        });
      } catch (connError) {
        console.error('MongoDB connection failed, returning default dashboard:', connError);
        return res.json({
        message: 'Admin API',
        dashboard: {
          users: {
            total: 0,
            approved: 0,
            pending: 0,
            rejected: 0,
            verified: 0,
            note: 'MongoDB connection not ready'
          },
          rates: {
            total: 0
          },
          recentUsers: []
        },
        endpoints: {
          pendingUsers: 'GET /api/admin/pending-users',
          allUsers: 'GET /api/admin/users',
          userDetails: 'GET /api/admin/user/:userId',
          approveUser: 'PUT /api/admin/approve-user/:userId',
          rejectUser: 'PUT /api/admin/reject-user/:userId'
        }
        });
        return;
      }
    }

    const totalUsers = await User.countDocuments();
    const approvedUsers = await User.countDocuments({ status: 'approved' });
    const pendingUsers = await User.countDocuments({ status: 'pending', isVerified: true });
    const rejectedUsers = await User.countDocuments({ status: 'rejected' });
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const totalRates = await SilverRate.countDocuments();
    
    const recentUsers = await User.find()
      .select('-password -otp -resetPasswordOTP')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      message: 'Admin API',
      dashboard: {
        users: {
          total: totalUsers,
          approved: approvedUsers,
          pending: pendingUsers,
          rejected: rejectedUsers,
          verified: verifiedUsers
        },
        rates: {
          total: totalRates
        },
        recentUsers
      },
      endpoints: {
        pendingUsers: 'GET /api/admin/pending-users',
        adjustRates: 'POST /api/admin/adjust-rates',
        allUsers: 'GET /api/admin/users',
        userDetails: 'GET /api/admin/user/:userId',
        approveUser: 'PUT /api/admin/approve-user/:userId',
        rejectUser: 'PUT /api/admin/reject-user/:userId'
      }
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all pending users
router.get('/pending-users', auth, adminAuth, async (req, res) => {
  try {
    // Check MongoDB connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        message: 'Database connection not available',
        users: []
      });
    }

    const users = await User.find({ 
      status: 'pending',
      isVerified: true
    })
      .select('-password -otp -resetPasswordOTP')
      .sort({ createdAt: -1 })
      .limit(100) // Limit to 100 users to prevent timeout
      .lean(); // Use lean() for better performance - returns plain objects instead of Mongoose documents

    // Format document URLs with CloudFront
    let formattedUsers = [];
    try {
      const { formatUserDocuments } = require('../utils/documentHelper');
      formattedUsers = users.map(user => {
        try {
          return formatUserDocuments(user);
        } catch (userFormatError) {
          console.error('Error formatting individual user:', userFormatError);
          // Return user without formatting if helper fails for this user
          return user;
        }
      });
    } catch (formatError) {
      console.error('Error formatting user documents:', formatError);
      console.error('Format error stack:', formatError.stack);
      // Return users without formatting if helper fails
      formattedUsers = users;
    }

    // Ensure we always return an array
    if (!Array.isArray(formattedUsers)) {
      console.warn('formattedUsers is not an array, converting...');
      formattedUsers = [];
    }

    res.json(formattedUsers);
  } catch (error) {
    console.error('Get pending users error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      users: [] // Return empty array on error
    });
  }
});

// Get all users
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    // Check MongoDB connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        message: 'Database connection not available',
        users: []
      });
    }

    const { status } = req.query;
    const query = status ? { status } : {};
    
    const { limit = 100, skip = 0 } = req.query;
    const users = await User.find(query)
      .select('-password -otp -resetPasswordOTP')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean(); // Use lean() for better performance - returns plain objects instead of Mongoose documents

    // Format document URLs with CloudFront
    let formattedUsers = [];
    try {
      const { formatUserDocuments } = require('../utils/documentHelper');
      formattedUsers = users.map(user => {
        try {
          return formatUserDocuments(user);
        } catch (userFormatError) {
          console.error('Error formatting individual user:', userFormatError);
          // Return user without formatting if helper fails for this user
          return user;
        }
      });
    } catch (formatError) {
      console.error('Error formatting user documents:', formatError);
      console.error('Format error stack:', formatError.stack);
      // Return users without formatting if helper fails
      formattedUsers = users;
    }

    // Ensure we always return an array
    if (!Array.isArray(formattedUsers)) {
      console.warn('formattedUsers is not an array, converting...');
      formattedUsers = [];
    }

    res.json(formattedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      users: [] // Return empty array on error
    });
  }
});

// Approve user
router.put('/approve-user/:userId', auth, adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = 'approved';
    user.approvedBy = req.user.userId;
    user.approvedAt = new Date();
    await user.save();

    res.json({
      message: 'User approved successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reject user
router.put('/reject-user/:userId', auth, adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = 'rejected';
    user.approvedBy = req.user.userId;
    user.approvedAt = new Date();
    await user.save();

    res.json({
      message: 'User rejected successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
        reason: reason || 'No reason provided'
      }
    });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user details with documents
router.get('/user/:userId', auth, adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password -otp -resetPasswordOTP');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Format document URLs with CloudFront
    const { formatUserDocuments } = require('../utils/documentHelper');
    const formattedUser = formatUserDocuments(user);

    res.json(formattedUser);
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin helper: adjust rates (per-gram amount or percentage, can be negative)
// This applies a manual adjustment that is added/subtracted from live RB Goldspot rates
// Uses in-memory storage (no MongoDB for rates)
router.post('/adjust-rates', auth, adminAuth, async (req, res) => {
  try {
    const { value, adjustmentType, itemName } = req.body;
    
    // Support both old format (amount) and new format (value + adjustmentType)
    let amount = value;
    let isPercentage = adjustmentType === 'percentage';
    
    // Backward compatibility: if 'amount' is provided, use it
    if (req.body.amount !== undefined && value === undefined) {
      amount = req.body.amount;
      isPercentage = false;
    }
    
    if (typeof amount !== 'number' || isNaN(amount)) {
      return res.status(400).json({ message: 'Valid numeric value is required' });
    }
    
    if (isPercentage && (amount < -100 || amount > 100)) {
      return res.status(400).json({ message: 'Percentage must be between -100% and 100%' });
    }

    // Get current rates from MongoDB to calculate percentage and update adjustments
    const SilverRate = require('../models/SilverRate');
    let currentRates = [];
    try {
      currentRates = await SilverRate.find({ location: 'Andhra Pradesh' });
    } catch (err) {
      console.warn('Could not fetch current rates for percentage calculation:', err.message);
      return res.status(500).json({ message: 'Failed to fetch current rates from database' });
    }

    const rateDefinitions = [
      'Silver Coin 1 Gram',
      'Silver Coin 5 Grams',
      'Silver Coin 10 Grams',
      'Silver Coin 50 Grams',
      'Silver Coin 100 Grams',
      'Silver Bar 100 Grams',
      'Silver Bar 500 Grams',
      'Silver Bar 1 Kg',
      'Silver Jewelry 92.5%',
      'Silver Jewelry 99.9%'
    ];

    let modified = 0;
    const adjustments = [];
    const bulkOps = [];

    // If itemName is provided, adjust only that item; otherwise adjust all
    const itemsToAdjust = itemName ? [itemName] : rateDefinitions;

    for (const rateName of itemsToAdjust) {
      if (!rateDefinitions.includes(rateName)) {
        continue; // Skip invalid item names
      }
      
      // Get current rate from MongoDB
      const currentRate = currentRates.find(r => r.name === rateName);
      if (!currentRate) {
        console.warn(`Rate ${rateName} not found in database, skipping adjustment`);
        continue;
      }
      
      const originalRatePerGram = currentRate.ratePerGram || 0;
      const currentAdjustment = currentRate.manualAdjustment || 0;
      
      let adjustmentAmount = 0;
      let actualPercentageChange = 0;
      
      if (isPercentage) {
        // Calculate amount based on percentage of current ratePerGram
        adjustmentAmount = (originalRatePerGram * amount) / 100;
        actualPercentageChange = amount;
      } else {
        // Use amount directly (additive to existing adjustment)
        adjustmentAmount = amount;
        // Calculate percentage change
        actualPercentageChange = originalRatePerGram > 0 
          ? ((amount / originalRatePerGram) * 100)
          : 0;
      }
      
      // Calculate new adjustment (additive: new = current + adjustment)
      const newAdjustment = currentAdjustment + adjustmentAmount;
      const newRatePerGram = Math.max(0, originalRatePerGram + adjustmentAmount);

      // Update MongoDB with new adjustment
      bulkOps.push({
        updateOne: {
          filter: { name: rateName, location: 'Andhra Pradesh' },
          update: {
            $set: {
              manualAdjustment: newAdjustment,
              lastUpdated: new Date()
            }
          }
        }
      });

      modified++;
      adjustments.push({
        itemName: rateName,
        amount: adjustmentAmount,
        originalRatePerGram: originalRatePerGram,
        originalAdjustment: currentAdjustment,
        newAdjustment: newAdjustment,
        newRatePerGram: newRatePerGram,
        percentageChange: parseFloat(actualPercentageChange.toFixed(2))
      });
    }

    // Execute bulk update to MongoDB
    if (bulkOps.length > 0) {
      try {
        await SilverRate.bulkWrite(bulkOps);
        console.log(`✅ Updated ${bulkOps.length} rate adjustments in MongoDB`);
      } catch (bulkError) {
        console.error('Error updating adjustments in MongoDB:', bulkError);
        return res.status(500).json({ message: 'Failed to save adjustments to database', error: bulkError.message });
      }
    }

    // Trigger immediate rate update to apply adjustments (adjustments are already in MongoDB)
    try {
      const updateRatesHandler = require('./rates').updateRatesHandler || null;
      if (updateRatesHandler) {
        updateRatesHandler(req, null).catch(err => {
          console.error('⚠️ Failed to trigger rate update after adjustment:', err.message);
        });
        console.log('🔄 Triggered rate update to recalculate rates with new adjustments');
      }
    } catch (updateErr) {
      console.warn('⚠️ Could not trigger rate update:', updateErr.message);
    }

    // Emit socket event for clients
    const io = req.app.get('io');
    if (io) io.emit('manualAdjustment', { value: amount, adjustmentType: isPercentage ? 'percentage' : 'amount', itemName });

    // Calculate average percentage if multiple items
    const avgPercentage = adjustments.length > 0
      ? (adjustments.reduce((sum, adj) => sum + adj.percentageChange, 0) / adjustments.length).toFixed(2)
      : 0;

    const adjustmentDescription = isPercentage 
      ? `${amount > 0 ? '+' : ''}${Math.abs(amount)}%`
      : `₹${Math.abs(amount)}/gram`;
    
    console.log(`✅ Admin adjusted rates: ${adjustmentDescription} applied to ${modified} rate(s)`);
    
    const message = isPercentage
      ? `Rates ${amount > 0 ? 'increased' : 'decreased'} by ${adjustmentDescription}`
      : `Rates ${amount > 0 ? 'increased' : 'decreased'} by ${adjustmentDescription} (${amount > 0 ? '+' : ''}${avgPercentage}%)`;

    res.json({ 
      message,
      modifiedCount: modified, 
      value: amount,
      adjustmentType: isPercentage ? 'percentage' : 'amount',
      percentageChange: parseFloat(avgPercentage),
      adjustments: adjustments,
      itemName: itemName || 'all',
      note: 'Adjustment applied and rates are being updated in the database'
    });
  } catch (error) {
    console.error('Admin adjust rates error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;


