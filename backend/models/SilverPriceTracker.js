const mongoose = require('mongoose');

// Model to track base silver price (stored once only)
const silverPriceTrackerSchema = new mongoose.Schema({
  // Base silver price stored once when first API price is received
  baseSilverPrice: {
    type: Number,
    required: true
  },
  // Location for which this base price applies
  location: {
    type: String,
    default: 'Andhra Pradesh',
    required: true
  },
  // When the base price was first set
  firstSetAt: {
    type: Date,
    default: Date.now
  },
  // Last updated timestamp
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  // Previous market rate (for calculating changes between updates)
  previousMarketRate: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

// Ensure only one document per location
silverPriceTrackerSchema.index({ location: 1 }, { unique: true });

// Static method to get or create base silver price
silverPriceTrackerSchema.statics.getOrCreateBasePrice = async function(location = 'Andhra Pradesh') {
  let tracker = await this.findOne({ location });

  if (!tracker) {
    // This will be set when first API call is made
    // For now, return null to indicate it needs to be initialized
    return null;
  }

  return tracker.baseSilverPrice;
};

// Static method to update base silver price (only if not set)
silverPriceTrackerSchema.statics.setBasePriceIfNotExists = async function(baseSilverPrice, location = 'Andhra Pradesh') {
  const existing = await this.findOne({ location });

  if (!existing) {
    const tracker = new this({
      baseSilverPrice,
      previousMarketRate: baseSilverPrice, // Initialize previous rate to base price
      location,
      firstSetAt: new Date(),
      lastUpdated: new Date()
    });
    await tracker.save();
    console.log(`✅ Base silver price set to ₹${baseSilverPrice} for ${location}`);
    return tracker;
  }

  // Base price already exists, don't update
  console.log(`ℹ️ Base silver price already set to ₹${existing.baseSilverPrice} for ${location}`);
  return existing;
};

// Static method to get tracker with previous market rate
silverPriceTrackerSchema.statics.getTracker = async function(location = 'Andhra Pradesh') {
  return await this.findOne({ location });
};

// Static method to update previous market rate
silverPriceTrackerSchema.statics.updatePreviousMarketRate = async function(currentRate, location = 'Andhra Pradesh') {
  const tracker = await this.findOne({ location });
  if (tracker) {
    tracker.previousMarketRate = currentRate;
    tracker.lastUpdated = new Date();
    await tracker.save();
  }
  return tracker;
};

module.exports = mongoose.model('SilverPriceTracker', silverPriceTrackerSchema);