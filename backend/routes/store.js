const express = require('express');
const router = express.Router();
const StoreInfo = require('../models/Store');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Root route - get store information from MongoDB
router.get('/', async (req, res) => {
  try {
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
          bankName: 'State Bank of India',
          accountNumber: '50200012345678',
          ifscCode: 'SBIN0001234',
          accountHolderName: 'Jain Silver Plaza',
          branch: 'Governerpet, Vijayawada'
        },
        {
          bankName: 'HDFC Bank',
          accountNumber: '50100234567890',
          ifscCode: 'HDFC0002345',
          accountHolderName: 'Jain Silver Plaza',
          branch: 'Benz Circle, Vijayawada'
        },
        {
          bankName: 'ICICI Bank',
          accountNumber: '60345678901234',
          ifscCode: 'ICIC0003456',
          accountHolderName: 'Jain Silver Plaza',
          branch: 'MG Road, Vijayawada'
        }
      ]
    };

    // Check MongoDB connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jain_silver', {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
        });
      } catch (connError) {
        console.error('MongoDB connection failed, returning default data:', connError.message);
        return res.json(defaultStoreInfo);
      }
    }
    
    // Try to get store info from database
    try {
      let storeInfo;
      if (typeof StoreInfo.getStoreInfo === 'function') {
        storeInfo = await StoreInfo.getStoreInfo();
      } else {
        storeInfo = await StoreInfo.findOne();
        if (!storeInfo) {
          storeInfo = new StoreInfo(defaultStoreInfo);
          await storeInfo.save();
        } else {
          storeInfo = storeInfo.toObject ? storeInfo.toObject() : storeInfo;
        }
      }
      
      const mergedInfo = { ...defaultStoreInfo, ...storeInfo };
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
          bankName: 'State Bank of India',
          accountNumber: '50200012345678',
          ifscCode: 'SBIN0001234',
          accountHolderName: 'Jain Silver Plaza',
          branch: 'Governerpet, Vijayawada'
        },
        {
          bankName: 'HDFC Bank',
          accountNumber: '50100234567890',
          ifscCode: 'HDFC0002345',
          accountHolderName: 'Jain Silver Plaza',
          branch: 'Benz Circle, Vijayawada'
        },
        {
          bankName: 'ICICI Bank',
          accountNumber: '60345678901234',
          ifscCode: 'ICIC0003456',
          accountHolderName: 'Jain Silver Plaza',
          branch: 'MG Road, Vijayawada'
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
          bankName: 'State Bank of India',
          accountNumber: '50200012345678',
          ifscCode: 'SBIN0001234',
          accountHolderName: 'Jain Silver Plaza',
          branch: 'Governerpet, Vijayawada'
        },
        {
          bankName: 'HDFC Bank',
          accountNumber: '50100234567890',
          ifscCode: 'HDFC0002345',
          accountHolderName: 'Jain Silver Plaza',
          branch: 'Benz Circle, Vijayawada'
        },
        {
          bankName: 'ICICI Bank',
          accountNumber: '60345678901234',
          ifscCode: 'ICIC0003456',
          accountHolderName: 'Jain Silver Plaza',
          branch: 'MG Road, Vijayawada'
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
      
      // Merge with defaults to ensure all fields exist
      const mergedInfo = { ...defaultStoreInfo, ...storeInfo };
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
          bankName: 'State Bank of India',
          accountNumber: '50200012345678',
          ifscCode: 'SBIN0001234',
          accountHolderName: 'Jain Silver Plaza',
          branch: 'Governerpet, Vijayawada'
        },
        {
          bankName: 'HDFC Bank',
          accountNumber: '50100234567890',
          ifscCode: 'HDFC0002345',
          accountHolderName: 'Jain Silver Plaza',
          branch: 'Benz Circle, Vijayawada'
        },
        {
          bankName: 'ICICI Bank',
          accountNumber: '60345678901234',
          ifscCode: 'ICIC0003456',
          accountHolderName: 'Jain Silver Plaza',
          branch: 'MG Road, Vijayawada'
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
    
    let storeInfo = await StoreInfo.findOne();
    
    if (!storeInfo) {
      // Create new store info with defaults
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
        ...updateData,
        storeTimings: updateData.storeTimings || defaultStoreInfo.storeTimings,
        bankDetails: updateData.bankDetails || defaultStoreInfo.bankDetails
      });
    } else {
      // Update existing fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && updateData[key] !== null) {
          storeInfo[key] = updateData[key];
        }
      });
    }
    
    await storeInfo.save();
    
    const savedInfo = storeInfo.toObject ? storeInfo.toObject() : storeInfo;
    console.log('✅ Store info updated successfully');
    
    res.json({
      message: 'Store information updated successfully',
      storeInfo: savedInfo
    });
  } catch (error) {
    console.error('❌ Update store info error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update store information (admin only - can be added later)
// router.put('/info', auth, adminAuth, async (req, res) => {
//   // Implementation for updating store info
// });

module.exports = router;

