const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const otpGenerator = require('otp-generator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Root route - get auth statistics from MongoDB
router.get('/', async (req, res) => {
  console.log('📡 GET /api/auth - Auth stats request');
  try {
    const mongoose = require('mongoose');

    // Check MongoDB connection
    let isConnected = false;
    if (mongoose.connection.readyState === 1) {
      isConnected = true;
    } else {
      // Try to connect
      try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jain_silver', {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
        });
        isConnected = true;
      } catch (connError) {
        console.error('MongoDB connection failed:', connError.message);
        isConnected = false;
      }
    }

    // If not connected, return default stats
    if (!isConnected) {
      return res.json({
        message: 'Auth API',
        statistics: {
          totalUsers: 0,
          verifiedUsers: 0,
          approvedUsers: 0,
          pendingUsers: 0,
          adminUsers: 0,
          note: 'MongoDB connection not ready. Please check IP whitelist in MongoDB Atlas.'
        },
        endpoints: {
          register: 'POST /api/auth/register',
          verifyOtp: 'POST /api/auth/verify-otp',
          resendOtp: 'POST /api/auth/resend-otp',
          signin: 'POST /api/auth/signin',
          adminSignin: 'POST /api/auth/admin/signin',
          forgotPassword: 'POST /api/auth/forgot-password',
          verifyResetOtp: 'POST /api/auth/verify-reset-otp',
          resetPassword: 'POST /api/auth/reset-password'
        }
      });
    }

    // Get statistics from MongoDB
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const approvedUsers = await User.countDocuments({ status: 'approved' });
    const pendingUsers = await User.countDocuments({ status: 'pending' });
    const adminUsers = await User.countDocuments({ role: 'admin' });

    res.json({
      message: 'Auth API',
      statistics: {
        totalUsers,
        verifiedUsers,
        approvedUsers,
        pendingUsers,
        adminUsers
      },
      endpoints: {
        register: 'POST /api/auth/register',
        verifyOtp: 'POST /api/auth/verify-otp',
        resendOtp: 'POST /api/auth/resend-otp',
        signin: 'POST /api/auth/signin',
        adminSignin: 'POST /api/auth/admin/signin',
        forgotPassword: 'POST /api/auth/forgot-password',
        verifyResetOtp: 'POST /api/auth/verify-reset-otp',
        resetPassword: 'POST /api/auth/reset-password'
      }
    });
  } catch (error) {
    console.error('Get auth stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Configure multer for S3 file uploads - make it optional
let upload, getFileUrl;
try {
  const multerS3 = require('../utils/multerS3');
  upload = multerS3.upload;
  getFileUrl = multerS3.getFileUrl;
} catch (multerError) {
  console.warn('⚠️  Multer S3 not available, file uploads will be disabled:', multerError.message);
  // Create fallback upload middleware
  const multer = require('multer');
  const memoryStorage = multer.memoryStorage();
  upload = multer({ storage: memoryStorage });
  getFileUrl = () => null;
}

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'jain_silver_secret_key_2024_change_in_production', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Test endpoint - simple POST without files
router.post('/register/test', (req, res) => {
  res.json({
    message: 'Test endpoint working',
    received: {
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length']
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Register new user - GET handler (for testing/info)
router.get('/register', (req, res) => {
  res.status(405).json({
    message: 'Method not allowed',
    error: 'Use POST method to register',
    endpoint: 'POST /api/auth/register',
    testEndpoint: 'POST /api/auth/register/test (for testing without files)',
    requiredFields: {
      name: 'string',
      email: 'string (valid email)',
      phone: 'string (10-digit Indian phone number)',
      password: 'string (min 6 characters)',
      aadharNumber: 'string',
      panNumber: 'string',
      aadharFront: 'file (image)',
      aadharBack: 'file (image)',
      panImage: 'file (image)'
    },
    contentType: 'multipart/form-data'
  });
});

// Register new user - POST handler
router.post('/register',
  (req, res, next) => {
    // Set CORS headers on every request (for React Native)
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Accept, Content-Length, Origin'
    );

    // Log immediately when request arrives
    console.log('🔔 POST /api/auth/register - Request received at:', new Date().toISOString());
    console.log('📥 Raw request info:', {
      method: req.method,
      url: req.url,
      path: req.path,
      headers: {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length'],
        'user-agent': req.headers['user-agent']?.substring(0, 50),
        'origin': req.headers['origin']
      }
    });

    console.log('✅ POST /api/auth/register - Registration request received');
    const contentLength = req.headers['content-length'];
    const contentType = req.headers['content-type'] || '';

    console.log('📋 Request details:', {
      method: req.method,
      path: req.path,
      url: req.url,
      contentType: contentType,
      contentLength: contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB` : 'unknown',
      origin: req.headers['origin'],
      userAgent: req.headers['user-agent']?.substring(0, 80),
      host: req.headers['host'],
      timestamp: new Date().toISOString()
    });

    // Check content type
    if (!contentType.includes('multipart/form-data')) {
      console.error('❌ Invalid Content-Type for file upload:', contentType);
      return res.status(400).json({
        message: 'Invalid Content-Type',
        error: 'Request must be multipart/form-data for file uploads',
        received: contentType
      });
    }

    // Check request size
    if (contentLength && parseInt(contentLength) > 4.5 * 1024 * 1024) {
      console.error('❌ Request too large:', `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB`);
      return res.status(413).json({
        message: 'Request too large',
        error: 'Total file size exceeds 4.5MB limit. Please compress images.',
        maxSize: '4.5MB',
        receivedSize: `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB`
      });
    }

    console.log('📦 Request body keys:', Object.keys(req.body || {}));
    console.log('📎 Request files:', req.files ? Object.keys(req.files) : 'No files yet');

    next();
  },
  (req, res, next) => {
    console.log('📦 Multer middleware - Processing file uploads...');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Content-Length:', req.headers['content-length']);
    console.log('Request body type:', typeof req.body);
    console.log('Request body keys:', req.body ? Object.keys(req.body) : 'No body');
    console.log('Request has files before multer:', !!req.files);

    // Handle multer errors with timeout
    const uploadMiddleware = upload.fields([
      { name: 'aadharFront', maxCount: 1 },
      { name: 'aadharBack', maxCount: 1 },
      { name: 'panImage', maxCount: 1 },
      { name: 'selfie', maxCount: 1 }
    ]);

    // Add timeout to multer processing (increased for large files)
    const timeout = setTimeout(() => {
      console.error('❌ Multer processing timeout after 60 seconds');
      if (!res.headersSent) {
        return res.status(408).json({
          message: 'Request timeout - file upload took too long',
          error: 'Please try again with smaller files or check your connection'
        });
      }
    }, 60000); // 60 second timeout for multer (increased from 20s)

    uploadMiddleware(req, res, (err) => {
      clearTimeout(timeout);
      if (err) {
        console.error('❌ File upload error:', err);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File size too large. Maximum 5MB allowed per file.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ message: 'Too many files. Maximum 4 files allowed (Aadhar Front, Aadhar Back, PAN Image, Selfie).' });
        }
        if (err.message && err.message.includes('Only images')) {
          return res.status(400).json({ message: 'Only image files (JPEG, PNG) are allowed.' });
        }
        if (err.code === 'ECONNRESET' || err.message?.includes('ECONNRESET')) {
          return res.status(408).json({
            message: 'Connection reset during file upload',
            error: 'Please try again. The connection was interrupted during upload.'
          });
        }
        return res.status(400).json({
          message: 'File upload error',
          error: err.message,
          code: err.code
        });
      }
      console.log('✅ Multer processing completed');
      console.log('Files received:', req.files ? Object.keys(req.files) : 'No files');
      console.log('Request body after multer:', req.body ? Object.keys(req.body) : 'No body');
      if (req.files) {
        Object.keys(req.files).forEach(key => {
          const file = Array.isArray(req.files[key]) ? req.files[key][0] : req.files[key];
          console.log(`  - ${key}: ${file?.size || 0} bytes, ${file?.mimetype || 'unknown type'}, buffer: ${!!file?.buffer}`);
        });
      } else {
        console.error('⚠️  WARNING: req.files is undefined or empty after multer processing');
        console.error('   This usually means multer did not parse the multipart/form-data correctly');
        console.error('   Check Content-Type header and ensure request is multipart/form-data');
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      const multerS3 = require('../utils/multerS3');
      if (multerS3.uploadToS3Middleware && req.files) {
        console.log('📤 Uploading files to S3...');
        console.log('Files to upload:', Object.keys(req.files));

        // Use the middleware function with timeout
        const s3UploadTimeout = setTimeout(() => {
          console.error('❌ S3 upload timeout after 60 seconds');
          if (!res.headersSent) {
            return res.status(408).json({
              message: 'Request timeout - S3 upload took too long',
              error: 'Please try again or check your AWS S3 configuration.'
            });
          }
        }, 60000); // 60 second timeout for S3 uploads (increased from 30s)

        // Call the middleware function
        await multerS3.uploadToS3Middleware(req, res, () => {
          clearTimeout(s3UploadTimeout);
          console.log('✅ All files uploaded successfully to S3');
          next();
        });
      } else {
        console.log('⚠️ S3 middleware not available or no files, skipping S3 upload');
        if (!req.files) {
          console.error('❌ No files in request - multer may have failed');
          return res.status(400).json({
            message: 'No files received',
            error: 'Please ensure all document images are uploaded'
          });
        }
        next();
      }
    } catch (s3Error) {
      console.error('❌ S3 upload middleware error:', s3Error.message);
      console.error('Error stack:', s3Error.stack);
      // Return error - S3 is required for document storage
      return res.status(500).json({
        message: 'File upload service unavailable',
        error: 'Unable to upload documents. Please check S3 configuration and AWS credentials.',
        details: process.env.NODE_ENV === 'development' ? s3Error.message : undefined
      });
    }
  },
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').custom((value) => {
      if (!value) {
        throw new Error('Phone number is required');
      }
      // Allow Indian phone numbers with or without country code
      const phoneRegex = /^(\+91|91)?[6-9]\d{9}$/;
      const cleanedPhone = value.replace(/\s|-/g, '');
      if (!phoneRegex.test(cleanedPhone)) {
        throw new Error('Valid 10-digit Indian phone number is required');
      }
      return true;
    }),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('aadharNumber').notEmpty().withMessage('Aadhar number is required'),
    body('panNumber').notEmpty().withMessage('PAN number is required')
  ],
  async (req, res) => {
    try {
      console.log('📝 Registration request received');
      console.log('Request body:', { ...req.body, password: '***' }); // Don't log password
      console.log('Request files:', req.files ? Object.keys(req.files) : 'No files');

      // Check MongoDB connection first
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        console.log('⚠️ MongoDB not connected, attempting connection...');
        try {
          await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jain_silver', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
          });
          console.log('✅ MongoDB connected for registration');
        } catch (connError) {
          console.error('❌ MongoDB connection failed:', connError.message);
          return res.status(503).json({
            message: 'Database connection failed',
            error: 'Please try again later. Check MongoDB connection.'
          });
        }
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, surname, lastName, email, phone, password, aadharNumber, panNumber } = req.body;

      // Normalize email and phone
      const normalizedEmail = email ? email.toLowerCase().trim() : '';
      // Normalize phone: remove spaces, dashes, and country code if present
      let normalizedPhone = phone ? phone.replace(/\s|-/g, '').trim() : '';
      // Remove +91 or 91 prefix if present
      if (normalizedPhone.startsWith('+91')) {
        normalizedPhone = normalizedPhone.substring(3);
      } else if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
        normalizedPhone = normalizedPhone.substring(2);
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: normalizedEmail },
          { phone: normalizedPhone }
        ]
      });

      if (existingUser) {
        return res.status(400).json({
          message: 'User with this email or phone already exists'
        });
      }

      // Generate OTP
      const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false
      });
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Validate file uploads
      if (!req.files || !req.files.aadharFront || !req.files.aadharBack || !req.files.panImage || !req.files.selfie) {
        console.error('❌ Missing required files:', {
          aadharFront: !!req.files?.aadharFront,
          aadharBack: !!req.files?.aadharBack,
          panImage: !!req.files?.panImage,
          selfie: !!req.files?.selfie,
          allFiles: req.files ? Object.keys(req.files) : 'No files object'
        });
        return res.status(400).json({
          message: 'All document images are required (Aadhar Front, Aadhar Back, PAN Image, Selfie)',
          received: req.files ? Object.keys(req.files) : []
        });
      }

      console.log('✅ All required files received');

      // Get CloudFront URLs from S3 uploads or use file keys
      let documents;
      try {
        const aadharFrontFile = Array.isArray(req.files.aadharFront) ? req.files.aadharFront[0] : req.files.aadharFront;
        const aadharBackFile = Array.isArray(req.files.aadharBack) ? req.files.aadharBack[0] : req.files.aadharBack;
        const panImageFile = Array.isArray(req.files.panImage) ? req.files.panImage[0] : req.files.panImage;
        const selfieFile = Array.isArray(req.files.selfie) ? req.files.selfie[0] : req.files.selfie;

        console.log('📄 Processing file locations:', {
          aadharFront: {
            location: aadharFrontFile?.location,
            key: aadharFrontFile?.key,
            storage: aadharFrontFile?.storage
          },
          aadharBack: {
            location: aadharBackFile?.location,
            key: aadharBackFile?.key,
            storage: aadharBackFile?.storage
          },
          panImage: {
            location: panImageFile?.location,
            key: panImageFile?.key,
            storage: panImageFile?.storage
          },
          selfie: {
            location: selfieFile?.location,
            key: selfieFile?.key,
            storage: selfieFile?.storage
          }
        });

        // Get file URLs - prefer location (CloudFront URL) over key (S3 key)
        const getDocumentUrl = (file) => {
          if (!file) return null;
          if (file.location) {
            // Already a CloudFront URL
            return file.location;
          }
          if (file.key && getFileUrl) {
            // Convert S3 key to CloudFront URL
            return getFileUrl(file.key);
          }
          return null;
        };

        const aadharFrontUrl = getDocumentUrl(aadharFrontFile);
        const aadharBackUrl = getDocumentUrl(aadharBackFile);
        const panImageUrl = getDocumentUrl(panImageFile);
        const selfieUrl = getDocumentUrl(selfieFile);

        if (!aadharFrontUrl || !aadharBackUrl || !panImageUrl || !selfieUrl) {
          console.error('❌ Missing document URLs after upload:', {
            aadharFront: !!aadharFrontUrl,
            aadharBack: !!aadharBackUrl,
            panImage: !!panImageUrl,
            selfie: !!selfieUrl
          });
          return res.status(500).json({
            message: 'Failed to process document uploads',
            error: 'Document files were not properly uploaded. Please try again.'
          });
        }

        documents = {
          aadhar: {
            front: aadharFrontUrl,
            back: aadharBackUrl,
            number: aadharNumber.trim()
          },
          pan: {
            image: panImageUrl,
            number: panNumber.trim().toUpperCase()
          },
          selfie: selfieUrl
        };

        console.log('✅ Document URLs prepared:', {
          aadharFront: documents.aadhar.front ? 'Set' : 'Missing',
          aadharBack: documents.aadhar.back ? 'Set' : 'Missing',
          panImage: documents.pan.image ? 'Set' : 'Missing',
          selfie: documents.selfie ? 'Set' : 'Missing'
        });
      } catch (docError) {
        console.error('❌ Error processing document URLs:', docError);
        console.error('Error stack:', docError.stack);
        return res.status(500).json({
          message: 'Error processing document files',
          error: docError.message
        });
      }

      // Create user - will be saved in 'users' collection (Mongoose auto-pluralizes 'User' -> 'users')
      console.log('👤 Creating user in MongoDB (collection: users)...');
      const user = new User({
        name: name ? name.trim() : ((surname || '') + ' ' + (lastName || '')).trim() || 'User',
        surname: surname ? surname.trim() : '',
        lastName: lastName ? lastName.trim() : '',
        email: normalizedEmail,
        phone: normalizedPhone,
        password,
        documents,
        otp: {
          code: otp,
          expiresAt: otpExpiresAt
        },
        status: 'pending',
        role: 'user', // Explicitly set role to 'user'
        isVerified: true // Auto-verify users (OTP verification removed)
      });

      try {
        await user.save();
        console.log('✅ User saved to MongoDB collection "users":', user._id);
        console.log('   Collection:', user.constructor.collection.name);
        console.log('   User details:', {
          name: user.name,
          email: user.email,
          phone: user.phone,
          status: user.status,
          role: user.role,
          isVerified: user.isVerified
        });
      } catch (saveError) {
        console.error('❌ Error saving user to MongoDB:', saveError);
        throw saveError;
      }

      // In production, send OTP via SMS/Email
      console.log(`✅ Registration successful for ${normalizedEmail || normalizedPhone}`);
      console.log(`📱 OTP for ${normalizedPhone || normalizedEmail}: ${otp}`);

      // Notify admin about new registration
      try {
        const { notifyAdminNewRegistration } = require('../utils/notifications');
        await notifyAdminNewRegistration({
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone
        });
      } catch (notifError) {
        console.error('Error sending admin notification:', notifError);
        // Don't fail registration if notification fails
      }

      res.status(201).json({
        message: 'Registration successful. Your account is pending admin approval.',
        userId: user._id,
        note: 'You can sign in once your account is approved by admin.'
      });
    } catch (error) {
      console.error('❌ Registration error:', error.message);
      console.error('📊 Error details:', {
        message: error.message,
        code: error.code,
        name: error.name,
        statusCode: error.statusCode,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue
      });
      if (error.stack) {
        console.error('🔍 Error stack (first 300 chars):', error.stack.substring(0, 300));
      }

      // Handle specific MongoDB errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
          message: `User with this ${field} already exists`
        });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }));
        return res.status(400).json({
          message: 'Validation error',
          errors
        });
      }

      res.status(500).json({
        message: 'Server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);

// Verify OTP
router.post('/verify-otp',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, otp } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.otp || user.otp.code !== otp) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }

      if (new Date() > user.otp.expiresAt) {
        return res.status(400).json({ message: 'OTP has expired' });
      }

      user.isVerified = true;
      user.otp = undefined;
      await user.save();

      res.json({
        message: 'OTP verified successfully. Waiting for admin approval.',
        userId: user._id
      });
    } catch (error) {
      console.error('OTP verification error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Resend OTP
router.post('/resend-otp',
  [body('userId').notEmpty().withMessage('User ID is required')],
  async (req, res) => {
    try {
      const { userId } = req.body;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false
      });
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      user.otp = {
        code: otp,
        expiresAt: otpExpiresAt
      };
      await user.save();

      // In production, send OTP via SMS/Email
      console.log(`Resent OTP for ${user.phone}: ${otp}`);
      console.log(`Demo OTP (for testing): ${otp}`);

      res.json({
        message: 'OTP resent successfully',
        otp: otp // Demo OTP - Remove this in production
      });
    } catch (error) {
      console.error('Resend OTP error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Sign in
router.post('/signin',
  [
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      // Check MongoDB connection
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        console.log('⚠️ MongoDB not connected, attempting connection...');
        try {
          await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jain_silver', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000, // Increased to 10s for serverless
            socketTimeoutMS: 45000,
            maxPoolSize: 1,
            minPoolSize: 0,
          });
          console.log('✅ MongoDB connected for signin');
        } catch (connError) {
          console.error('❌ MongoDB connection failed:', connError.message);
          return res.status(503).json({
            message: 'Database connection failed',
            error: 'Please try again later'
          });
        }
      }

      const { email, phone, password } = req.body;

      // Validate password first
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('❌ Validation errors:', errors.array());
        return res.status(400).json({
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      // Validate that at least one identifier is provided
      if (!email && !phone) {
        return res.status(400).json({
          message: 'Email or phone is required',
          errors: [{ msg: 'Either email or phone must be provided', param: 'email' }]
        });
      }

      // Validate email if provided
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            message: 'Valid email is required',
            errors: [{ msg: 'Invalid email format', param: 'email' }]
          });
        }
      }

      // Validate phone if provided
      if (phone) {
        // Indian phone validation: 10 digits starting with 6-9
        const phoneRegex = /^[6-9]\d{9}$/;
        const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
        if (!phoneRegex.test(cleanPhone)) {
          return res.status(400).json({
            message: 'Valid phone number is required (10 digits starting with 6-9)',
            errors: [{ msg: 'Invalid phone format', param: 'phone' }]
          });
        }
      }

      console.log('🔐 Sign in attempt:', { email: email || undefined, phone: phone || undefined });

      // Find user
      const user = await User.findOne(
        email ? { email: email.toLowerCase().trim() } : { phone: phone.trim() }
      );

      if (!user) {
        console.error('❌ User not found:', { email: email || undefined, phone: phone || undefined });
        return res.status(404).json({ message: 'User not found. Please check your credentials or register.' });
      }

      console.log('✅ User found:', { id: user._id, email: user.email, status: user.status, isVerified: user.isVerified });

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        console.error('❌ Invalid password for user:', user.email);
        return res.status(401).json({ message: 'Incorrect password. Please try again.' });
      }

      // Check if user is approved - ONLY approved users can sign in
      if (user.status !== 'approved') {
        console.warn('❌ Login attempt by unapproved user:', {
          email: user.email,
          status: user.status,
          isVerified: user.isVerified
        });

        if (user.status === 'rejected') {
          // Get store phone number for contact info
          let adminPhone = '+91 98480 34323'; // Default phone number
          try {
            const StoreInfo = require('../models/Store');
            const storeInfo = await StoreInfo.findOne();
            if (storeInfo && storeInfo.phoneNumber) {
              adminPhone = storeInfo.phoneNumber;
            }
          } catch (storeError) {
            console.warn('Could not fetch store info for admin contact:', storeError.message);
          }

          return res.status(403).json({
            message: `Your account has been rejected. Please contact admin for assistance.\n\nAdmin Contact: ${adminPhone}`,
            status: user.status,
            userStatus: 'rejected',
            adminPhone: adminPhone
          });
        } else if (user.status === 'pending') {
          // Get store phone number for contact info
          let adminPhone = '+91 98480 34323'; // Default phone number
          try {
            const StoreInfo = require('../models/Store');
            const storeInfo = await StoreInfo.findOne();
            if (storeInfo && storeInfo.phoneNumber) {
              adminPhone = storeInfo.phoneNumber;
            }
          } catch (storeError) {
            console.warn('Could not fetch store info for admin contact:', storeError.message);
          }

          return res.status(403).json({
            message: `Your account is pending admin approval. Please wait for approval before signing in.\n\nAdmin Contact: ${adminPhone}`,
            status: user.status,
            userStatus: 'pending',
            adminPhone: adminPhone
          });
        } else {
          return res.status(403).json({
            message: 'Your account is not approved. Please contact admin.',
            status: user.status,
            userStatus: user.status
          });
        }
      }

      // Generate token - only for approved users
      const token = generateToken(user._id);

      console.log('✅ Sign in successful:', { email: user.email, status: user.status });

      res.json({
        message: 'Sign in successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          isVerified: user.isVerified
        }
      });
    } catch (error) {
      console.error('❌ Sign in error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        message: 'Server error',
        error: error.message,
        ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
      });
    }
  }
);

// Admin sign in
router.post('/admin/signin',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      console.log('🔐 Admin login attempt:', { email: req.body.email });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('❌ Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      const normalizedEmail = email.toLowerCase().trim();

      // Check MongoDB connection
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        console.log('⚠️ MongoDB not connected, attempting connection...');
        try {
          await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jain_silver', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
          });
          console.log('✅ MongoDB connected for admin login');
        } catch (connError) {
          console.error('❌ MongoDB connection failed:', connError.message);
          return res.status(503).json({
            message: 'Database connection failed',
            error: 'Please try again later'
          });
        }
      }

      // Find admin user
      console.log('🔍 Searching for admin user with email:', normalizedEmail);
      const user = await User.findOne({
        email: normalizedEmail,
        role: 'admin'
      });

      if (!user) {
        console.error('❌ Admin user not found:', normalizedEmail);
        // Check if any admin exists
        const adminCount = await User.countDocuments({ role: 'admin' });
        console.log(`📊 Total admin users in database: ${adminCount}`);
        if (adminCount === 0) {
          console.log('⚠️ No admin users found. Admin will be created on next server restart.');
        }
        return res.status(404).json({ message: 'User not found' });
      }

      console.log('✅ Admin user found:', { id: user._id, email: user.email, name: user.name });

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        console.error('❌ Invalid password for admin:', normalizedEmail);
        return res.status(401).json({ message: 'Incorrect password' });
      }

      console.log('✅ Password verified successfully');

      // Generate token
      const token = generateToken(user._id);
      console.log('✅ Admin login successful:', { email: user.email, id: user._id });

      res.json({
        message: 'Admin sign in successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('❌ Admin sign in error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        message: 'Server error',
        error: error.message,
        ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
      });
    }
  }
);

// Forgot Password - Request OTP
router.post('/forgot-password',
  [
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('phone').optional().isMobilePhone('en-IN').withMessage('Valid phone is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, phone } = req.body;

      if (!email && !phone) {
        return res.status(400).json({ message: 'Email or phone is required' });
      }

      const user = await User.findOne(
        email ? { email: email.toLowerCase() } : { phone }
      );

      if (!user) {
        // Don't reveal if user exists for security
        return res.json({
          message: 'If the account exists, an OTP has been sent to your registered phone/email'
        });
      }

      // Generate OTP for password reset
      const resetOtp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false
      });
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store reset OTP in user document
      user.resetPasswordOTP = {
        code: resetOtp,
        expiresAt: otpExpiresAt
      };
      await user.save();

      // In production, send OTP via SMS/Email
      console.log(`Password reset OTP for ${user.phone || user.email}: ${resetOtp}`);
      console.log(`Demo OTP (for testing): ${resetOtp}`);

      res.json({
        message: 'OTP has been sent to your registered phone/email',
        otp: resetOtp // Demo OTP - Remove this in production
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Verify Reset OTP
router.post('/verify-reset-otp',
  [
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('phone').optional().isMobilePhone('en-IN').withMessage('Valid phone is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, phone, otp } = req.body;

      if (!email && !phone) {
        return res.status(400).json({ message: 'Email or phone is required' });
      }

      const user = await User.findOne(
        email ? { email: email.toLowerCase() } : { phone }
      );

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.resetPasswordOTP || user.resetPasswordOTP.code !== otp) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }

      if (new Date() > user.resetPasswordOTP.expiresAt) {
        return res.status(400).json({ message: 'OTP has expired' });
      }

      // Generate reset token (valid for 15 minutes)
      const resetToken = jwt.sign(
        { userId: user._id, type: 'password-reset' },
        process.env.JWT_SECRET || 'jain_silver_secret_key_2024_change_in_production',
        { expiresIn: '15m' }
      );

      // Clear the OTP after successful verification
      user.resetPasswordOTP = undefined;
      await user.save();

      res.json({
        message: 'OTP verified successfully',
        resetToken
      });
    } catch (error) {
      console.error('Verify reset OTP error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Reset Password
router.post('/reset-password',
  [
    body('resetToken').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { resetToken, newPassword } = req.body;

      // Verify reset token
      let decoded;
      try {
        decoded = jwt.verify(
          resetToken,
          process.env.JWT_SECRET || 'jain_silver_secret_key_2024_change_in_production'
        );
      } catch (error) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      if (decoded.type !== 'password-reset') {
        return res.status(400).json({ message: 'Invalid reset token' });
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Store old password hash for logging (before update)
      const oldPasswordHash = user.password;

      // Update password (will be hashed by pre-save hook)
      user.password = newPassword;
      user.markModified('password'); // Explicitly mark as modified to ensure pre-save hook runs
      await user.save();

      // Verify password was actually updated
      const passwordUpdated = user.password !== oldPasswordHash;

      console.log(`✅ Password reset successful for user: ${user.email || user.phone}`);
      console.log(`   Password updated: ${passwordUpdated ? 'YES' : 'NO'}`);
      console.log(`   User can now login with new password`);

      res.json({
        message: 'Password reset successfully. You can now login with your new password.'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router;

