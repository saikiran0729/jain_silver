const express = require('express');
const router = express.Router();
const User = require('../models/User');
const SilverRate = require('../models/SilverRate');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const mongoose = require('mongoose');
const { formatUserDocuments } = require('../utils/documentHelper');

// Load Settings model with error handling
let Settings;
try {
  Settings = require('../models/Settings');
} catch (error) {
  console.error('⚠️ Settings model could not be loaded initially:', error.message);
  Settings = null;
}

// Helper to ensure Settings is loaded
const getSettingsModel = () => {
  if (Settings) return Settings;
  try {
    Settings = require('../models/Settings');
    return Settings;
  } catch (error) {
    console.error('⚠️ Settings model could not be loaded on demand:', error.message);
    return null;
  }
};

// Root route - get admin dashboard data from MongoDB
router.get('/', auth, adminAuth, async (req, res) => {
  try {
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

/**
 * @swagger
 * /admin/pending-users:
 *   get:
 *     summary: Get all pending users (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
// Get all pending users
router.get('/pending-users', auth, adminAuth, async (req, res) => {
  try {
    // Check MongoDB connection
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

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: Filter by user status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of users to return
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of users to skip
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
// Get all users
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    // Check MongoDB connection
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

/**
 * @swagger
 * /admin/adjust-rates:
 *   post:
 *     summary: Adjust silver rates (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *               - adjustmentType
 *             properties:
 *               value:
 *                 type: number
 *                 description: Adjustment value (positive for increase, negative for decrease)
 *               adjustmentType:
 *                 type: string
 *                 enum: [amount, percentage]
 *                 description: Type of adjustment - amount per gram or percentage
 *               itemName:
 *                 type: string
 *                 description: Specific item to adjust (optional, defaults to all items)
 *     responses:
 *       200:
 *         description: Rates adjusted successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
// Admin helper: adjust rates (per-gram amount or percentage, can be negative)
// This applies a manual adjustment that is added/subtracted from live RB Goldspot rates
// Uses MongoDB for persistence
router.post('/adjust-rates', auth, adminAuth, async (req, res) => {
  try {
    console.log('📝 Rate adjustment request:', JSON.stringify(req.body, null, 2));
    const { value, adjustmentType, itemName, category } = req.body;

    let amount = parseFloat(value);
    let isPercentage = adjustmentType === 'percentage';

    if (isNaN(amount)) {
      return res.status(400).json({ message: 'Valid numeric value is required' });
    }

    if (isPercentage && (amount < -100 || amount > 100)) {
      return res.status(400).json({ message: 'Percentage must be between -100% and 100%' });
    }

    // Get current rates from MongoDB
    const SilverRate = require('../models/SilverRate');
    let currentRates = await SilverRate.find({ location: 'Andhra Pradesh' });

    // Identify which items to adjust
    let itemsToAdjust = [];
    if (itemName && itemName !== 'all') {
      itemsToAdjust = [itemName];
    } else if (category === 'gold') {
      itemsToAdjust = currentRates.filter(r => r.type === 'gold').map(r => r.name);
    } else if (category === 'silver') {
      itemsToAdjust = currentRates.filter(r => r.type !== 'gold').map(r => r.name);
    } else {
      // Default to all items
      itemsToAdjust = currentRates.map(r => r.name);
    }

    console.log(`📊 Processing adjustment: ${amount} (${isPercentage ? 'percentage' : 'amount'}) for ${itemName || category || 'all items'}`);

    let modified = 0;
    const adjustments = [];
    const bulkOps = [];

    for (const itemIdentifier of itemsToAdjust) {
      // Find the rate in our fetched list
      let currentRate = currentRates.find(r =>
        r.name === itemIdentifier ||
        r.displayName === itemIdentifier ||
        (r._id && r._id.toString() === itemIdentifier)
      );

      // If not found, try case-insensitive or partial (reuse existing logic from admin.js if needed)
      if (!currentRate) {
        currentRate = await SilverRate.findOne({
          $or: [
            { name: itemIdentifier, location: 'Andhra Pradesh' },
            { displayName: itemIdentifier, location: 'Andhra Pradesh' }
          ]
        });
      }

      if (!currentRate) {
        console.error(`❌ Rate "${itemIdentifier}" not found.`);
        continue;
      }

      const rateName = currentRate.name;
      const itemType = currentRate.type;
      let normalPrice = currentRate.normalPrice;
      const currentAdjustment = currentRate.manualAdjustment || 0;
      const currentPercentage = currentRate.manualAdjustmentPercentage || 0;

      // Use adjustment value directly as per-gram (no normalization needed)
      let normalizedDelta = amount;
      if (!isPercentage) {
        console.log(`📊 Adjustment: ₹${normalizedDelta}/gram for ${rateName} (${itemType})`);
      }

      // If normalPrice is missing, try to calculate or use fallback
      if (!normalPrice || normalPrice <= 0) {
        normalPrice = (currentRate.ratePerGram || 0) / (1 + currentPercentage / 100) - currentAdjustment;
      }

      // Calculate new persistent adjustment values
      let newAdjustment = currentAdjustment;
      let newPercentage = currentPercentage;

      if (isPercentage) {
        newPercentage += amount; // e.g. if it was 10% and user adds 5%, it becomes 15%
      } else {
        newAdjustment += normalizedDelta;
      }

      // Update calculations for immediate response (updater will correct it properly)
      let weightInGrams = currentRate.weight?.value || 1;
      if (currentRate.weight?.unit === 'kg') {
        weightInGrams *= 1000;
      }

      const ratePerGram = Math.max(0, normalPrice * (1 + newPercentage / 100) + newAdjustment);

      bulkOps.push({
        updateOne: {
          filter: { name: rateName, location: 'Andhra Pradesh' },
          update: {
            $set: {
              manualAdjustment: newAdjustment,
              manualAdjustmentPercentage: newPercentage,
              ratePerGram: ratePerGram,
              rate: Math.max(0, ratePerGram * weightInGrams),
              lastUpdated: new Date()
            }
          }
        }
      });

      modified++;
      adjustments.push({
        itemName: rateName,
        type: itemType,
        newPercentage: newPercentage,
        newAdjustmentAmount: newAdjustment,
        delta: isPercentage ? `${amount}%` : `₹${normalizedDelta}/g`,
        effectiveRatePerGram: ratePerGram
      });
    }

    if (bulkOps.length > 0) {
      await SilverRate.bulkWrite(bulkOps);
      console.log(`✅ Updated ${bulkOps.length} rate adjustments in MongoDB`);

      // CRITICAL: Await sync BEFORE sending response.
      // On Vercel serverless, setImmediate/background calls get killed after res.json().
      // We must sync inline so rates are recalculated with fresh live prices + new adjustments.
      try {
        const ratesRoute = require('./rates');
        if (ratesRoute.syncRatesWithSource) {
          await Promise.race([
            ratesRoute.syncRatesWithSource(),
            new Promise((resolve) => setTimeout(resolve, 5000)) // 5s timeout
          ]);
          console.log('✅ Unified rate sync completed after adjustment');
        }
      } catch (e) {
        console.warn('⚠️ Post-adjustment sync failed (adjustment is saved, will sync on next poll):', e.message);
      }
    }
    const io = req.app.get('io');
    if (io) io.emit('manualAdjustment', { value: amount, adjustmentType, itemName, category });

    res.json({
      message: `Rates adjusted successfully for ${modified} items`,
      modifiedCount: modified,
      adjustments: adjustments
    });
  } catch (error) {
    console.error('Admin adjust rates error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get showAsItIs setting
router.get('/show-as-it-is', auth, adminAuth, async (req, res) => {
  try {
    // Ensure Settings model is available
    if (!Settings) {
      return res.status(500).json({
        message: 'Settings model not available',
        showAsItIs: false
      });
    }

    const setting = await Settings.getSetting('showAsItIs');
    res.json({
      showAsItIs: setting.value || false,
      lastUpdated: setting.lastUpdated || new Date()
    });
  } catch (error) {
    console.error('Get showAsItIs setting error:', error);
    // Return default value on error instead of 500
    res.json({
      showAsItIs: false,
      lastUpdated: new Date(),
      error: error.message
    });
  }
});

// Toggle showAsItIs setting
router.post('/toggle-show-as-it-is', auth, adminAuth, async (req, res) => {
  try {
    // Ensure Settings model is available
    if (!Settings) {
      return res.status(500).json({
        message: 'Settings model not available',
        error: 'Settings model not loaded'
      });
    }

    const currentSetting = await Settings.getSetting('showAsItIs');
    const newValue = !currentSetting.value;

    await Settings.setSetting('showAsItIs', newValue, req.user.userId);

    console.log(`✅ Admin toggled "Show As It Is": ${newValue ? 'ENABLED' : 'DISABLED'}`);

    res.json({
      message: `"Show As It Is" ${newValue ? 'enabled' : 'disabled'} successfully`,
      showAsItIs: newValue,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Toggle showAsItIs setting error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update product name and visibility by name (this must come before /product/:id to match correctly)
router.put('/product', auth, adminAuth, async (req, res) => {
  try {
    const { productName, displayName, isVisible } = req.body;

    if (!productName) {
      return res.status(400).json({ message: 'Product name is required' });
    }

    // Find the rate by name, displayName, or _id (for flexibility)
    // Try to find by _id first if productName looks like an ObjectId
    let rate = null;
    if (productName.match(/^[0-9a-fA-F]{24}$/)) {
      // It's an ObjectId - try with location first, then without
      rate = await SilverRate.findOne({
        _id: productName,
        location: 'Andhra Pradesh'
      });
      if (!rate) {
        rate = await SilverRate.findById(productName);
      }
    }

    // If not found by _id, try by name (with location, then without)
    if (!rate) {
      rate = await SilverRate.findOne({
        name: productName,
        location: 'Andhra Pradesh'
      });
      if (!rate) {
        rate = await SilverRate.findOne({ name: productName });
      }
    }

    // If still not found, try by displayName (with location, then without)
    if (!rate) {
      rate = await SilverRate.findOne({
        displayName: productName,
        location: 'Andhra Pradesh'
      });
      if (!rate) {
        rate = await SilverRate.findOne({ displayName: productName });
      }
    }

    if (!rate) {
      console.error(`❌ Product not found: "${productName}"`);
      console.log('   Available rates in DB (first 5):', (await SilverRate.find({ location: 'Andhra Pradesh' }).limit(5).select('name')).map(r => r.name));
      return res.status(404).json({
        message: `Product not found: ${productName}`,
        receivedName: productName,
        suggestion: 'Try using the exact "name" or "originalName" from the database'
      });
    }

    console.log(`🔍 Found product for update: ${rate.name} (ID: ${rate._id})`);
    console.log(`   Inputs - displayName: ${displayName}, isVisible: ${isVisible}`);

    // Update fields if provided
    if (displayName !== undefined) {
      rate.displayName = displayName.trim() || null;
    }
    if (isVisible !== undefined) {
      rate.isVisible = Boolean(isVisible);
      console.log(`🔄 Updating visibility for ${rate.name}: ${rate.isVisible} → ${isVisible}`);
    }

    await rate.save();

    console.log(`✅ Admin updated product ${rate.name}: displayName=${rate.displayName || 'default'}, isVisible=${rate.isVisible}`);

    // Trigger rate update to ensure prices are recalculated with latest adjustments
    try {
      const updateRatesHandler = require('./rates').updateRatesHandler || null;
      if (updateRatesHandler) {
        updateRatesHandler(req, null).catch(err => {
          console.error('⚠️ Failed to trigger rate update after product update:', err.message);
        });
        console.log('🔄 Triggered rate update to recalculate rates after product name change');
      }
    } catch (updateErr) {
      console.warn('⚠️ Could not trigger rate update:', updateErr.message);
    }

    res.json({
      message: 'Product updated successfully',
      product: {
        _id: rate._id,
        name: rate.name,
        displayName: rate.displayName,
        isVisible: rate.isVisible
      }
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reset all displayNames to null (restore original names)
router.post('/reset-display-names', auth, adminAuth, async (req, res) => {
  try {
    console.log('🔄 Resetting all displayNames to null...');

    // Find all rates
    const rates = await SilverRate.find({ location: 'Andhra Pradesh' });
    console.log(`📊 Found ${rates.length} rates in database`);

    // Show current displayNames before reset
    const ratesWithDisplayName = rates.filter(r => r.displayName);
    console.log(`📝 Rates with custom displayName: ${ratesWithDisplayName.length}`);
    if (ratesWithDisplayName.length > 0) {
      console.log('Current displayNames:');
      ratesWithDisplayName.forEach(r => {
        console.log(`   - "${r.name}" → displayName: "${r.displayName}"`);
      });
    }

    // Reset all displayNames to null
    const bulkOps = rates.map(rate => ({
      updateOne: {
        filter: { _id: rate._id },
        update: {
          $set: {
            displayName: null,
            lastUpdated: new Date()
          }
        }
      }
    }));

    if (bulkOps.length > 0) {
      const result = await SilverRate.bulkWrite(bulkOps);
      console.log(`✅ Reset ${result.modifiedCount} displayNames to null`);

      // Verify the reset
      const verifyRates = await SilverRate.find({ location: 'Andhra Pradesh' });
      const stillWithDisplayName = verifyRates.filter(r => r.displayName);

      res.json({
        message: `Successfully reset ${result.modifiedCount} displayNames to null`,
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount,
        ratesWithDisplayNameBefore: ratesWithDisplayName.length,
        ratesWithDisplayNameAfter: stillWithDisplayName.length,
        verification: stillWithDisplayName.length === 0 ? 'passed' : 'warning',
        note: 'All products will now show their original database names'
      });
    } else {
      res.json({
        message: 'No rates found to reset',
        modifiedCount: 0
      });
    }
  } catch (error) {
    console.error('❌ Error resetting displayNames:', error);
    res.status(500).json({
      message: 'Failed to reset displayNames',
      error: error.message
    });
  }
});


// Get "Show As It Is" setting
router.get('/show-as-it-is', auth, adminAuth, async (req, res) => {
  try {
    let showAsItIs = false;
    const SettingsModel = getSettingsModel();

    if (SettingsModel) {
      const setting = await SettingsModel.getSetting('showAsItIs');
      if (setting && setting.value !== undefined) {
        showAsItIs = setting.value;
      }
    }
    res.json({ showAsItIs });
  } catch (error) {
    console.error('Get showAsItIs error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Toggle "Show As It Is" setting
router.post('/toggle-show-as-it-is', auth, adminAuth, async (req, res) => {
  try {
    const SettingsModel = getSettingsModel();

    if (!SettingsModel) {
      return res.status(503).json({ message: 'Settings service unavailable' });
    }

    // Ensure getSetting exists
    if (typeof SettingsModel.getSetting !== 'function') {
      return res.status(503).json({ message: 'Settings model not correctly loaded' });
    }

    const currentSetting = await SettingsModel.getSetting('showAsItIs');
    const currentValue = currentSetting ? currentSetting.value : false;
    const newValue = !currentValue;

    await SettingsModel.setSetting('showAsItIs', newValue);

    console.log(`✅ Toggled "Show As It Is" to: ${newValue}`);
    res.json({
      message: `Show As It Is ${newValue ? 'enabled' : 'disabled'} successfully`,
      showAsItIs: newValue
    });
  } catch (error) {
    console.error('Toggle showAsItIs error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reset ALL manual adjustments to zero
router.post('/reset-all-adjustments', auth, adminAuth, async (req, res) => {
  try {
    const result = await SilverRate.updateMany(
      { location: 'Andhra Pradesh' },
      { $set: { manualAdjustment: 0, manualAdjustmentPercentage: 0, lastUpdated: new Date() } }
    );

    console.log(`✅ Reset ${result.modifiedCount} rates to zero adjustments`);

    // Trigger sync to recalculate rates with zero adjustments
    try {
      const ratesRoute = require('./rates');
      if (ratesRoute.syncRatesWithSource) {
        await Promise.race([
          ratesRoute.syncRatesWithSource(),
          new Promise((resolve) => setTimeout(resolve, 5000))
        ]);
      }
    } catch (e) {
      console.warn('⚠️ Post-reset sync failed:', e.message);
    }

    res.json({
      message: `Reset ${result.modifiedCount} rates to zero adjustments`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Reset adjustments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;


