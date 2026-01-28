const mongoose = require('mongoose');

const silverRateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['coin', 'bar', 'jewelry', 'gold']
  },
  weight: {
    value: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      required: true,
      enum: ['grams', 'kg', 'oz']
    }
  },
  purity: {
    type: String,
    required: true,
    enum: ['92.5%', '99.9%', '99.99%']
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  ratePerGram: {
    type: Number,
    required: true,
    min: 0
  },
  // Manual per-gram adjustment (can be negative). Admin can set this to apply
  // a fixed rupee adjustment per gram (e.g. -100 will subtract ₹100/gram).
  manualAdjustment: {
    type: Number,
    default: 0
  },
  // Normal price (base price for automatic adjustments)
  normalPrice: {
    type: Number,
    default: null
  },
  // Adjusted price (recalculated from normalPrice + silver price difference)
  adjustedPrice: {
    type: Number,
    default: null
  },
  location: {
    type: String,
    default: 'Andhra Pradesh',
    required: true
  },
  unit: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD']
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  // Display name (custom name shown to users, if not set, uses name)
  displayName: {
    type: String,
    default: null
  },
  // Whether this product should be visible to users
  isVisible: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
silverRateSchema.index({ name: 1, purity: 1 });
silverRateSchema.index({ location: 1, type: 1 });

// Instance method to calculate adjusted price based on silver price changes
// IMPORTANT: Always recalculates from normalPrice, never accumulates
silverRateSchema.methods.calculateAdjustedPrice = function (currentSilverPrice, baseSilverPrice) {
  // normalPrice = 236 is constant and must NEVER change
  const normalPrice = 236;

  // Calculate difference only: silverDiff = currentSilverPrice - baseSilverPrice
  const silverDiff = currentSilverPrice - baseSilverPrice;

  // Calculate adjusted price as: adjustedPrice = normalPrice + silverDiff
  const adjustedPrice = normalPrice + silverDiff;

  return adjustedPrice;
};

module.exports = mongoose.model('SilverRate', silverRateSchema);

