const mongoose = require('mongoose');
require('dotenv').config();

const SilverRate = require('../models/SilverRate');

async function resetAdjustedPrices() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jain_silver', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find all products with normalPrice set
    const products = await SilverRate.find({
      location: 'Andhra Pradesh',
      normalPrice: { $ne: null, $exists: true }
    });

    console.log(`📊 Found ${products.length} products with normalPrice set`);

    let updated = 0;
    for (const product of products) {
      // Reset adjustedPrice to match normalPrice (without modifying normalPrice)
      const oldAdjustedPrice = product.adjustedPrice;
      product.adjustedPrice = product.normalPrice;

      // Also reset ratePerGram to match for backward compatibility
      product.ratePerGram = product.adjustedPrice;

      // Recalculate total rate
      let weightInGrams = product.weight.value;
      if (product.weight.unit === 'kg') {
        weightInGrams = product.weight.value * 1000;
      } else if (product.weight.unit === 'oz') {
        weightInGrams = product.weight.value * 28.35;
      }
      product.rate = product.ratePerGram * weightInGrams;

      product.lastUpdated = new Date();

      await product.save();

      console.log(`✅ Reset ${product.name}: adjustedPrice ₹${oldAdjustedPrice || 'N/A'} → ₹${product.adjustedPrice} (normalPrice: ₹${product.normalPrice})`);
      updated++;
    }

    console.log(`\n🎉 Successfully reset adjustedPrice for ${updated} products`);
    console.log('💡 All adjustedPrice fields now match their normalPrice values');
    console.log('🚀 Rate updater will now apply proper adjustments from this baseline');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetAdjustedPrices();