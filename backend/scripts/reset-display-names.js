/**
 * Script to reset all displayNames in MongoDB to null
 * This will restore all products to their original database names
 */

// Try to load dotenv, but continue if not available
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, use environment variables directly
}

const mongoose = require('mongoose');
const SilverRate = require('../models/SilverRate');

async function resetDisplayNames() {
  try {
    // Get MongoDB URI from environment or use default
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable not set');
      console.log('   Please set MONGODB_URI or run from backend directory with .env file');
      process.exit(1);
    }
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find all rates
    const rates = await SilverRate.find({ location: 'Andhra Pradesh' });
    console.log(`\n📊 Found ${rates.length} rates in database\n`);

    // Show current displayNames before reset
    const ratesWithDisplayName = rates.filter(r => r.displayName);
    console.log(`📝 Rates with custom displayName: ${ratesWithDisplayName.length}`);
    if (ratesWithDisplayName.length > 0) {
      console.log('\nCurrent displayNames:');
      ratesWithDisplayName.forEach(r => {
        console.log(`   - "${r.name}" → displayName: "${r.displayName}"`);
      });
    }

    // Reset all displayNames to null
    const bulkOps = rates.map(rate => ({
      updateOne: {
        filter: { _id: rate._id },
        update: {
          $set: {
            displayName: null,
            lastUpdated: new Date()
          }
        }
      }
    }));

    if (bulkOps.length > 0) {
      const result = await SilverRate.bulkWrite(bulkOps);
      console.log(`\n✅ Reset ${result.modifiedCount} displayNames to null`);
      console.log(`📊 Modified: ${result.modifiedCount}, Matched: ${result.matchedCount}`);
    } else {
      console.log('\n⚠️ No rates found to reset');
    }

    // Verify the reset
    const verifyRates = await SilverRate.find({ location: 'Andhra Pradesh' });
    const stillWithDisplayName = verifyRates.filter(r => r.displayName);
    
    if (stillWithDisplayName.length === 0) {
      console.log('\n✅ Verification passed: All displayNames are now null');
      console.log('   All products will now show their original database names.');
    } else {
      console.warn(`\n⚠️ Warning: ${stillWithDisplayName.length} rates still have displayNames:`);
      stillWithDisplayName.forEach(r => {
        console.warn(`   - ${r.name}: "${r.displayName}"`);
      });
    }

    console.log('\n✅ Reset complete! All displayNames have been reset to null.');
    console.log('   Products will now use their original database names.');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting displayNames:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
resetDisplayNames();

