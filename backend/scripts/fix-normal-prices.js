/**
 * Script to fix normalPrice values in MongoDB
 * Sets normalPrice to current ratePerGram if not set, so adjustments work correctly
 */

const mongoose = require('mongoose');
const SilverRate = require('../models/SilverRate');
const SilverPriceTracker = require('../models/SilverPriceTracker');

async function fixNormalPrices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    // Get base silver price to calculate normalPrice correctly
    let baseSilverPrice = null;
    try {
      baseSilverPrice = await SilverPriceTracker.getOrCreateBasePrice('Andhra Pradesh');
      if (!baseSilverPrice) {
        console.log('⚠️ Base silver price not set yet. Will use current ratePerGram as normalPrice.');
      } else {
        console.log(`📊 Base silver price: ₹${baseSilverPrice.toFixed(2)}/gram`);
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch base silver price:', err.message);
    }

    const rates = await SilverRate.find({ location: 'Andhra Pradesh' });
    console.log(`\n📋 Found ${rates.length} rates to check\n`);

    let fixed = 0;
    for (const rate of rates) {
      // Calculate what normalPrice should be based on current ratePerGram and manualAdjustment
      // normalPrice = ratePerGram - manualAdjustment - (currentMarketRate - baseSilverPrice)
      // But we don't know currentMarketRate, so we'll use a simpler approach:
      // If normalPrice is not set, set it to current ratePerGram - manualAdjustment
      // This will be corrected on next update run
      
      if (rate.normalPrice === null || rate.normalPrice === undefined || rate.normalPrice <= 0) {
        const manualAdj = rate.manualAdjustment || 0;
        const currentRatePerGram = rate.ratePerGram || 0;
        
        // Set normalPrice = current ratePerGram - manualAdjustment (approximation)
        // This will be corrected by the rate updater on next run
        const estimatedNormalPrice = currentRatePerGram - manualAdj;
        rate.normalPrice = estimatedNormalPrice > 0 ? estimatedNormalPrice : currentRatePerGram;
        
        await rate.save();
        console.log(`✅ Fixed ${rate.name}: Set normalPrice to ₹${rate.normalPrice.toFixed(2)}/gram (was null, current ratePerGram: ₹${currentRatePerGram.toFixed(2)}, manualAdj: ₹${manualAdj.toFixed(2)})`);
        fixed++;
      } else {
        console.log(`✓ ${rate.name}: normalPrice already set to ₹${rate.normalPrice.toFixed(2)}/gram`);
      }
    }

    console.log(`\n🎉 Fixed ${fixed} rates. All rates now have normalPrice set.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing normal prices:', error);
    process.exit(1);
  }
}

fixNormalPrices();

