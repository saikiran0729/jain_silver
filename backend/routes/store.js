const express = require('express');
const router = express.Router();
const StoreInfo = require('../models/Store');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Memory cache for store info to speed up responses and reduce DB load
let storeCache = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 1 minute

// Root route - get store information from MongoDB
router.get('/', async (req, res) => {
  try {
    // Check if we have a valid cache
    if (storeCache && (Date.now() - lastCacheUpdate < CACHE_TTL)) {
      return res.json(storeCache);
    }

    // Default store info
    const defaultStoreInfo = {
      welcomeMessage: 'Welcome to Jain Silver Plaza - Your trusted partner for premium silver products. We offer the best quality silver coins, bars, and jewelry with transparent pricing and excellent customer service.',
      address: 'Governerpet, Vijayawada, Andhra Pradesh, Gopala Reddy Road, Governerpet, Vijayawada-520002, Andhra Pradesh',
      phoneNumber: '+91 98480 34323',
      storeTimings: [
        { day: 'Monday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Tuesday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Wednesday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Thursday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Friday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Saturday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Sunday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: true },
      ],
      instagram: 'https://www.instagram.com/jainsilverplaza?igsh=MWJrcWlzbjVhcW1jNw==',
      facebook: 'https://www.facebook.com/share/1CaCEfRxST/',
      youtube: 'https://youtube.com/@jainsilverplaza6932?si=IluQGMU-eNMVx75A',
      rating: 4.4,
      totalRatings: 84,
      mapLink: 'https://www.google.com/maps/place/16%C2%B030\'41.3%22N+80%C2%B037\'33.3%22E/@16.511483,80.62592,17z/data=!3m1!1b4!4m4!3m3!8m2!3d16.511483!4d80.62592?entry=ttu&g_ep=EgoyMDI1MTEyMy4xIKXMDSoASAFQAw%3D%3D',
      bankDetails: [
        {
          bankName: 'HDFC BANK',
          accountNumber: '50200039209361',
          ifscCode: 'HDFC0009380',
          accountHolderName: 'jain silver plaza',
          branch: 'besant road,vijayawada'
        }
      ]
    };

    // Check MongoDB connection (fast check)
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      // If not connected, try to connect but don't block too long
      try {
        if (!process.env.MONGODB_URI && !process.env.VERCEL) {
          return res.json(defaultStoreInfo);
        }
      } catch (e) { console.error(e); }
    }

    // Try to get store info from database with lean() for performance
    try {
      let storeInfo;
      if (typeof StoreInfo.getStoreInfo === 'function') {
        storeInfo = await StoreInfo.getStoreInfo();
      } else {
        storeInfo = await StoreInfo.findOne().lean();
        if (!storeInfo) {
          // Verify if any exists before creating to avoid race conditions
          const count = await StoreInfo.countDocuments();
          if (count === 0) {
            const newStore = new StoreInfo(defaultStoreInfo);
            await newStore.save();
            storeInfo = newStore.toObject();
          }
        }
      }

      const mergedInfo = { ...defaultStoreInfo, ...(storeInfo || {}) };

      // Update cache
      storeCache = mergedInfo;
      lastCacheUpdate = Date.now();

      res.json(mergedInfo);
    } catch (dbError) {
      console.error('Error fetching store info from database:', dbError.message);
      res.json(defaultStoreInfo);
    }
  } catch (error) {
    console.error('Get store info error:', error);
    // Return default instead of 500
    res.json({
      welcomeMessage: 'Welcome to Jain Silver Plaza - Your trusted partner for premium silver products.',
      address: 'Governerpet, Vijayawada, Andhra Pradesh, Gopala Reddy Road, Governerpet, Vijayawada-520002, Andhra Pradesh',
      phoneNumber: '+91 98480 34323',
      storeTimings: [
        { day: 'Monday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Tuesday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Wednesday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Thursday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Friday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Saturday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Sunday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: true },
      ],
      instagram: 'https://www.instagram.com/jainsilverplaza?igsh=MWJrcWlzbjVhcW1jNw==',
      facebook: 'https://www.facebook.com/share/1CaCEfRxST/',
      youtube: 'https://youtube.com/@jainsilverplaza6932?si=IluQGMU-eNMVx75A',
      rating: 4.4,
      totalRatings: 84,
      mapLink: 'https://www.google.com/maps/place/16%C2%B030\'41.3%22N+80%C2%B037\'33.3%22E/@16.511483,80.62592,17z/data=!3m1!1b4!4m4!3m3!8m2!3d16.511483!4d80.62592?entry=ttu&g_ep=EgoyMDI1MTEyMy4xIKXMDSoASAFQAw%3D%3D',
      bankDetails: [
        {
          bankName: 'HDFC BANK',
          accountNumber: '50200039209361',
          ifscCode: 'HDFC0009380',
          accountHolderName: 'jain silver plaza',
          branch: 'besant road,vijayawada'
        }
      ]
    });
  }
});

/**
 * @swagger
 * /store/info:
 *   get:
 *     summary: Get store information (Public)
 *     tags: [Store]
 *     responses:
 *       200:
 *         description: Store information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StoreInfo'
 */
// Get store information (public endpoint) - alias for root
router.get('/info', async (req, res) => {
  try {
    // Check cache first
    if (storeCache && (Date.now() - lastCacheUpdate < CACHE_TTL)) {
      return res.json(storeCache);
    }
    // Default store info to return if MongoDB fails
    const defaultStoreInfo = {
      welcomeMessage: 'Welcome to Jain Silver Plaza - Your trusted partner for premium silver products. We offer the best quality silver coins, bars, and jewelry with transparent pricing and excellent customer service.',
      address: 'Governerpet, Vijayawada, Andhra Pradesh, Gopala Reddy Road, Governerpet, Vijayawada-520002, Andhra Pradesh',
      phoneNumber: '+91 98480 34323',
      storeTimings: [
        { day: 'Monday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Tuesday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Wednesday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Thursday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Friday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Saturday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Sunday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: true },
      ],
      instagram: 'https://www.instagram.com/jainsilverplaza?igsh=MWJrcWlzbjVhcW1jNw==',
      facebook: 'https://www.facebook.com/share/1CaCEfRxST/',
      youtube: 'https://youtube.com/@jainsilverplaza6932?si=IluQGMU-eNMVx75A',
      rating: 4.4,
      totalRatings: 84,
      mapLink: 'https://www.google.com/maps/place/16%C2%B030\'41.3%22N+80%C2%B037\'33.3%22E/@16.511483,80.62592,17z/data=!3m1!1b4!4m4!3m3!8m2!3d16.511483!4d80.62592?entry=ttu&g_ep=EgoyMDI1MTEyMy4xIKXMDSoASAFQAw%3D%3D',
      bankDetails: [
        {
          bankName: 'HDFC BANK',
          accountNumber: '50200039209361',
          ifscCode: 'HDFC0009380',
          accountHolderName: 'jain silver plaza',
          branch: 'besant road,vijayawada'
        }
      ]
    };

    // Ensure MongoDB connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jain_silver', {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
        });
      } catch (connError) {
        console.error('MongoDB connection failed, returning default store info:', connError.message);
        return res.json(defaultStoreInfo);
      }
    }

    // Try to get store info from database
    try {
      let storeInfo;
      if (typeof StoreInfo.getStoreInfo === 'function') {
        storeInfo = await StoreInfo.getStoreInfo();
      } else {
        // Fallback: find one store document
        storeInfo = await StoreInfo.findOne();
        if (!storeInfo) {
          // Create default store info if none exists
          storeInfo = new StoreInfo(defaultStoreInfo);
          await storeInfo.save();
        } else {
          storeInfo = storeInfo.toObject ? storeInfo.toObject() : storeInfo;
        }
      }

      // Convert to plain object if needed
      const storeInfoObj = storeInfo.toObject ? storeInfo.toObject() : storeInfo;

      // Merge with defaults, but prioritize database values (database values come last in spread)
      // This ensures that if database has empty arrays, they are used instead of defaults
      const mergedInfo = {
        ...defaultStoreInfo,
        ...storeInfoObj,
        // Explicitly set arrays from database if they exist (even if empty)
        storeTimings: storeInfoObj.storeTimings !== undefined ? storeInfoObj.storeTimings : defaultStoreInfo.storeTimings,
        bankDetails: storeInfoObj.bankDetails !== undefined ? storeInfoObj.bankDetails : defaultStoreInfo.bankDetails
      };

      console.log('📖 Returning store info:', JSON.stringify(mergedInfo, null, 2));

      // Update cache
      storeCache = mergedInfo;
      lastCacheUpdate = Date.now();

      res.json(mergedInfo);
    } catch (dbError) {
      console.error('Error fetching store info from database:', dbError.message);
      // Return default info if database query fails
      res.json(defaultStoreInfo);
    }
  } catch (error) {
    console.error('Get store info error:', error);
    // Always return default info instead of 500 error
    res.json({
      welcomeMessage: 'Welcome to Jain Silver Plaza - Your trusted partner for premium silver products.',
      address: 'Governerpet, Vijayawada, Andhra Pradesh, Gopala Reddy Road, Governerpet, Vijayawada-520002, Andhra Pradesh',
      phoneNumber: '+91 98480 34323',
      storeTimings: [
        { day: 'Monday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Tuesday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Wednesday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Thursday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Friday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Saturday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Sunday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: true },
      ],
      instagram: 'https://www.instagram.com/jainsilverplaza?igsh=MWJrcWlzbjVhcW1jNw==',
      facebook: 'https://www.facebook.com/share/1CaCEfRxST/',
      youtube: 'https://youtube.com/@jainsilverplaza6932?si=IluQGMU-eNMVx75A',
      rating: 4.4,
      totalRatings: 84,
      mapLink: 'https://www.google.com/maps/place/16%C2%B030\'41.3%22N+80%C2%B037\'33.3%22E/@16.511483,80.62592,17z/data=!3m1!1b4!4m4!3m3!8m2!3d16.511483!4d80.62592?entry=ttu&g_ep=EgoyMDI1MTEyMy4xIKXMDSoASAFQAw%3D%3D',
      bankDetails: [
        {
          bankName: 'HDFC BANK',
          accountNumber: '50200039209361',
          ifscCode: 'HDFC0009380',
          accountHolderName: 'jain silver plaza',
          branch: 'besant road,vijayawada'
        }
      ]
    });
  }
});

/**
 * @swagger
 * /store/info:
 *   put:
 *     summary: Update store information (Admin only)
 *     tags: [Store]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               welcomeMessage:
 *                 type: string
 *               address:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               instagram:
 *                 type: string
 *               facebook:
 *                 type: string
 *               youtube:
 *                 type: string
 *               storeTimings:
 *                 type: array
 *                 items:
 *                   type: object
 *               bankDetails:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Store information updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 storeInfo:
 *                   $ref: '#/components/schemas/StoreInfo'
 *       400:
 *         description: No valid fields to update
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Update store information (admin only)
router.put('/info', auth, adminAuth, async (req, res) => {
  try {
    // Check MongoDB connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database connection not available',
        error: 'Please try again later'
      });
    }

    console.log('📝 Updating store info with data:', JSON.stringify(req.body, null, 2));

    // Get only the fields that are allowed to be updated
    const allowedFields = ['welcomeMessage', 'address', 'phoneNumber', 'instagram', 'facebook', 'youtube', 'storeTimings', 'bankDetails'];
    const updateData = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Use findOneAndUpdate with upsert to ensure atomic update
    const updateOptions = {
      new: true, // Return the updated document
      upsert: true, // Create if doesn't exist
      runValidators: true // Run schema validators
    };

    // Prepare update object - use $set operator for proper MongoDB update
    const updateObject = {};
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        updateObject[key] = updateData[key];
      }
    });

    console.log('📝 Update object:', JSON.stringify(updateObject, null, 2));

    // Use findOneAndUpdate for atomic operation
    let storeInfo = await StoreInfo.findOneAndUpdate(
      {}, // Empty filter means find any document (since there should only be one)
      { $set: updateObject },
      updateOptions
    );

    if (!storeInfo) {
      // If still no document exists, create one with defaults and update data
      const defaultStoreInfo = {
        storeTimings: [
          { day: 'Monday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
          { day: 'Tuesday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
          { day: 'Wednesday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
          { day: 'Thursday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
          { day: 'Friday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
          { day: 'Saturday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
          { day: 'Sunday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: true },
        ],
        bankDetails: []
      };

      storeInfo = new StoreInfo({
        ...defaultStoreInfo,
        ...updateObject
      });
      await storeInfo.save();
    }

    console.log('✅ Store info saved. Verifying:', JSON.stringify(storeInfo.toObject(), null, 2));

    // Re-fetch to ensure we have the latest data
    storeInfo = await StoreInfo.findById(storeInfo._id);

    if (!storeInfo) {
      console.error('❌ Store info not found after save');
      return res.status(500).json({
        message: 'Store information was saved but could not be retrieved',
        error: 'Please refresh and try again'
      });
    }

    const savedInfo = storeInfo.toObject ? storeInfo.toObject() : storeInfo;
    console.log('✅ Store info updated successfully');

    res.json({
      message: 'Store information updated successfully',
      storeInfo: savedInfo
    });

    // Invalidate cache on update
    storeCache = null;
    lastCacheUpdate = 0;
  } catch (error) {
    console.error('❌ Update store info error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation error',
        error: error.message
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid data format',
        error: error.message
      });
    }

    res.status(500).json({
      message: 'Server error',
      error: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update store information (admin only - can be added later)
// router.put('/info', auth, adminAuth, async (req, res) => {
//   // Implementation for updating store info
// });

module.exports = router;

