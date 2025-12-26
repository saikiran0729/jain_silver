/**
 * Script to reset all manual adjustments to 0
 * This will reset all price adjustments back to exact RB Gold prices
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SilverRate = require('../models/SilverRate');

async function resetAllAdjustments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find all rates
    const rates = await SilverRate.find({ location: 'Andhra Pradesh' });
    console.log(`📊 Found ${rates.length} rates to reset`);

    // Reset all manual adjustments to 0
    const bulkOps = rates.map(rate => ({
      updateOne: {
        filter: { _id: rate._id },
        update: {
          $set: {
            manualAdjustment: 0,
            lastUpdated: new Date()
          }
        }
      }
    }));

    if (bulkOps.length > 0) {
      const result = await SilverRate.bulkWrite(bulkOps);
      console.log(`✅ Reset ${result.modifiedCount} rate adjustments to 0`);
      console.log(`📊 Modified: ${result.modifiedCount}, Matched: ${result.matchedCount}`);
    } else {
      console.log('⚠️ No rates found to reset');
    }

    // Verify the reset
    const verifyRates = await SilverRate.find({ location: 'Andhra Pradesh' });
    const nonZeroAdjustments = verifyRates.filter(r => r.manualAdjustment !== 0);
    
    if (nonZeroAdjustments.length === 0) {
      console.log('✅ Verification passed: All adjustments are now 0');
    } else {
      console.warn(`⚠️ Warning: ${nonZeroAdjustments.length} rates still have non-zero adjustments:`);
      nonZeroAdjustments.forEach(r => {
        console.warn(`   - ${r.name}: ${r.manualAdjustment}`);
      });
    }

    console.log('✅ Reset complete! All manual adjustments have been set to 0.');
    console.log('   Note: Rates will be recalculated on next update cycle with exact RB Gold prices.');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting adjustments:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
resetAllAdjustments();

