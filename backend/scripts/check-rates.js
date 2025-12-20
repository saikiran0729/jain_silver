/**
 * Script to check current rates in MongoDB
 * Helps debug rate adjustment issues
 */

// Try to load dotenv, but continue if not available
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, use environment variables directly
}

const mongoose = require('mongoose');
const SilverRate = require('../models/SilverRate');

async function checkRates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find all rates
    const rates = await SilverRate.find({ location: 'Andhra Pradesh' }).sort({ name: 1 });
    console.log(`\n📊 Found ${rates.length} rates in database:\n`);

    rates.forEach((rate, index) => {
      console.log(`${index + 1}. Name: "${rate.name}"`);
      console.log(`   DisplayName: "${rate.displayName || 'none'}"`);
      console.log(`   RatePerGram: ₹${rate.ratePerGram?.toFixed(2) || 'N/A'}/gram`);
      console.log(`   Manual Adjustment: ₹${rate.manualAdjustment?.toFixed(2) || '0.00'}/gram`);
      console.log(`   Total Rate: ₹${rate.rate?.toFixed(2) || 'N/A'}`);
      console.log(`   IsVisible: ${rate.isVisible !== false ? 'true' : 'false'}`);
      console.log(`   Last Updated: ${rate.lastUpdated || 'N/A'}`);
      console.log('');
    });

    // Check for rates with displayName
    const ratesWithDisplayName = rates.filter(r => r.displayName);
    console.log(`\n📝 Rates with custom displayName: ${ratesWithDisplayName.length}`);
    ratesWithDisplayName.forEach(r => {
      console.log(`   - "${r.name}" → "${r.displayName}"`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkRates();

