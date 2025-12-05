const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToS3 } = require('./s3Upload');
const { platform, fileStorage } = require('../config/platform');

// Custom storage for multer that uploads to S3
const s3Storage = multer.memoryStorage();

const upload = multer({
  storage: s3Storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    fieldSize: 10 * 1024 * 1024, // 10MB for fields
    files: 4, // Maximum 4 files (aadharFront, aadharBack, panImage, selfie)
    fields: 10 // Maximum 10 fields
  },
  fileFilter: (req, file, cb) => {
    console.log(`📎 Processing file: ${file.fieldname} - ${file.originalname} (${file.mimetype})`);
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images and PDF files are allowed'));
  }
});

// Middleware to upload files to S3 or local storage based on platform
const uploadToS3Middleware = async (req, res, next) => {
  try {
    if (req.files) {
      // Upload all files in parallel for faster processing
      const uploadPromises = [];
      
      for (const fieldName in req.files) {
        const files = Array.isArray(req.files[fieldName]) ? req.files[fieldName] : [req.files[fieldName]];
        for (const file of files) {
          if (file.buffer) {
            // Use S3 if configured and available
            if (fileStorage.useS3) {
              const uploadPromise = uploadToS3(
                file.buffer,
                file.originalname,
                'documents',
                file.mimetype
              ).then(({ key, url }) => {
                file.location = url;
                file.key = key;
                file.storage = 's3';
                console.log(`✅ Uploaded ${fieldName} to S3: ${key}`);
                console.log(`   CloudFront URL: ${url}`);
              }).catch((s3Error) => {
                console.error(`❌ S3 upload failed for ${fieldName}:`, s3Error.message);
                console.error(`   Error details:`, {
                  code: s3Error.code,
                  name: s3Error.name,
                  message: s3Error.message
                });
                
                // If ACL error, provide helpful message
                if (s3Error.message && s3Error.message.includes('ACL')) {
                  console.error(`   💡 Fix: Enable ACLs on S3 bucket or configure bucket policy`);
                  console.error(`   📖 See: backend/S3_BUCKET_ACL_FIX.md for instructions`);
                }
                
                // Fallback to local if S3 fails and platform allows it
                if (fileStorage.fallbackToLocal) {
                  return saveToLocal(file);
                } else {
                  throw s3Error; // Vercel requires S3
                }
              });
              
              uploadPromises.push(uploadPromise);
            } else if (fileStorage.fallbackToLocal) {
              // Use local storage
              uploadPromises.push(saveToLocal(file));
            } else {
              throw new Error('File storage not configured. S3 is required for this platform.');
            }
          }
        }
      }
      
      // Wait for all uploads to complete
      if (uploadPromises.length > 0) {
        await Promise.all(uploadPromises);
        console.log(`✅ All ${uploadPromises.length} files uploaded successfully`);
      }
    }
    next();
  } catch (error) {
    console.error('File upload middleware error:', error);
    return res.status(500).json({ message: 'File upload failed', error: error.message });
  }
};

// Save file to local storage (for non-Vercel, non-AWS deployments)
const saveToLocal = async (file) => {
  const uploadPath = 'uploads/documents';
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
  
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const filename = `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`;
  const filepath = path.join(uploadPath, filename);
  
  fs.writeFileSync(filepath, file.buffer);
  
  file.location = `/uploads/documents/${filename}`;
  file.path = filepath;
  file.filename = filename;
  file.storage = 'local';
};

// Helper to get CloudFront URL from S3 location or key
const getFileUrl = (s3Location) => {
  if (!s3Location) return null;
  const { AWS_CONFIG } = require('../config/aws');
  
  // If it's already a CloudFront URL, return as is
  if (s3Location.includes('cloudfront.net') || s3Location.startsWith('https://')) {
    return s3Location;
  }
  
  // If it's an S3 key (starts with documents/ or images/), convert to CloudFront URL
  if (s3Location.startsWith('documents/') || s3Location.startsWith('images/')) {
    return `${AWS_CONFIG.CLOUDFRONT_URL}/${s3Location}`;
  }
  
  // If it's just a filename, assume it's in documents folder
  if (!s3Location.includes('/')) {
    return `${AWS_CONFIG.CLOUDFRONT_URL}/documents/${s3Location}`;
  }
  
  // Default: prepend CloudFront URL
  return `${AWS_CONFIG.CLOUDFRONT_URL}/${s3Location}`;
};

module.exports = {
  upload,
  uploadToS3Middleware,
  getFileUrl,
};

