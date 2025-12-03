const mongoose = require('mongoose');

const storeInfoSchema = new mongoose.Schema({
  welcomeMessage: {
    type: String,
    default: 'Welcome to Jain Silver - Your trusted partner for premium silver products. We offer the best quality silver coins, bars, and jewelry with transparent pricing and excellent customer service.'
  },
  address: {
    type: String,
    default: 'Andhra Pradesh, India'
  },
  phoneNumber: {
    type: String,
    default: '+91 98480 34323'
  },
  storeTimings: [{
    day: String,
    openTime: String,
    closeTime: String,
    isClosed: Boolean
  }],
  instagram: {
    type: String,
    default: 'https://www.instagram.com/jainsilverplaza?igsh=MWJrcWlzbjVhcW1jNw=='
  },
  facebook: {
    type: String,
    default: 'https://www.facebook.com/share/1CaCEfRxST/'
  },
  youtube: {
    type: String,
    default: 'https://youtube.com/@jainsilverplaza6932?si=IluQGMU-eNMVx75A'
  },
  bankDetails: [{
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
    branch: String
  }]
}, {
  timestamps: true
});

// Ensure only one store info document exists
storeInfoSchema.statics.getStoreInfo = async function() {
  // Check if MongoDB is connected
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB connection not ready');
  }
  
  let storeInfo = await this.findOne();
  if (!storeInfo) {
    // Create default store info
    storeInfo = new this({
      storeTimings: [
        { day: 'Monday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Tuesday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Wednesday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Thursday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Friday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Saturday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: false },
        { day: 'Sunday', openTime: '11:00 AM', closeTime: '08:30 PM', isClosed: true },
      ],
      bankDetails: [
        {
          bankName: 'Bank Name',
          accountNumber: 'XXXXXXXXXXXX',
          ifscCode: 'XXXX0000000',
          accountHolderName: 'Jain Silver',
          branch: 'Branch Name',
        }
      ]
    });
    await storeInfo.save();
  }
  return storeInfo;
};

// Export model, handling case where it might already be registered
let StoreInfo;
try {
  StoreInfo = mongoose.model('StoreInfo', storeInfoSchema);
} catch (error) {
  // Model already registered, use existing
  StoreInfo = mongoose.model('StoreInfo');
}

module.exports = StoreInfo;

