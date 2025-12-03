/**
 * Helper functions for handling document URLs with CloudFront
 */

let AWS_CONFIG;
try {
  const awsModule = require('../config/aws');
  AWS_CONFIG = awsModule.AWS_CONFIG || awsModule.default?.AWS_CONFIG;
  if (!AWS_CONFIG) {
    throw new Error('AWS_CONFIG not found');
  }
} catch (error) {
  console.warn('AWS config not available, using fallback URLs:', error.message);
  AWS_CONFIG = {
    CLOUDFRONT_URL: process.env.AWS_CLOUDFRONT_URL || process.env.CLOUDFRONT_URL || ''
  };
}

/**
 * Convert document URLs to CloudFront URLs
 * @param {Object} documents - User documents object
 * @returns {Object} - Documents with CloudFront URLs
 */
const formatDocumentUrls = (documents) => {
  if (!documents) return null;
  
  const formatted = {};
  
  // Format Aadhar documents
  if (documents.aadhar) {
    formatted.aadhar = {
      ...documents.aadhar,
      front: getCloudFrontUrl(documents.aadhar.front),
      back: getCloudFrontUrl(documents.aadhar.back),
    };
  }
  
  // Format PAN document
  if (documents.pan) {
    formatted.pan = {
      ...documents.pan,
      image: getCloudFrontUrl(documents.pan.image),
    };
  }
  
  // Format other documents
  if (documents.other && Array.isArray(documents.other)) {
    formatted.other = documents.other.map(doc => ({
      ...doc,
      url: getCloudFrontUrl(doc.url || doc),
    }));
  }
  
  return formatted;
};

/**
 * Get CloudFront URL from S3 key or existing URL
 * @param {String} location - S3 key or URL
 * @returns {String} - CloudFront URL
 */
const getCloudFrontUrl = (location) => {
  if (!location) return null;
  
  // If it's already a CloudFront URL or full URL, return as is
  if (location.includes('cloudfront.net') || location.startsWith('https://') || location.startsWith('http://')) {
    return location;
  }
  
  // If CloudFront URL is not configured, return relative URL
  if (!AWS_CONFIG || !AWS_CONFIG.CLOUDFRONT_URL) {
    return location.startsWith('/') ? location : `/${location}`;
  }
  
  // If it's an S3 key (starts with documents/ or images/), convert to CloudFront URL
  if (location.startsWith('documents/') || location.startsWith('images/')) {
    return `${AWS_CONFIG.CLOUDFRONT_URL}/${location}`;
  }
  
  // If it's just a filename, assume it's in documents folder
  if (!location.includes('/')) {
    return `${AWS_CONFIG.CLOUDFRONT_URL}/documents/${location}`;
  }
  
  // Default: prepend CloudFront URL
  return `${AWS_CONFIG.CLOUDFRONT_URL}/${location}`;
};

/**
 * Format user object with CloudFront URLs for documents
 * @param {Object} user - User object from MongoDB
 * @returns {Object} - User object with formatted document URLs
 */
const formatUserDocuments = (user) => {
  if (!user) {
    console.warn('formatUserDocuments: user is null or undefined');
    return user;
  }
  
  try {
    // If user is already a plain object (from lean()), use it directly
    const userObj = user.toObject ? user.toObject() : { ...user };
    
    if (userObj.documents && typeof userObj.documents === 'object') {
      try {
        userObj.documents = formatDocumentUrls(userObj.documents);
      } catch (docError) {
        console.error('Error formatting document URLs:', docError);
        // Keep original documents if formatting fails
      }
    }
    
    return userObj;
  } catch (error) {
    console.error('Error in formatUserDocuments:', error);
    // Return user as-is if formatting fails
    return user.toObject ? user.toObject() : { ...user };
  }
};

module.exports = {
  formatDocumentUrls,
  getCloudFrontUrl,
  formatUserDocuments,
};

