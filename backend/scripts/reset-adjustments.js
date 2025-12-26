const mongoose = require('mongoose');
const SilverRate = require('../models/SilverRate');

async function resetAdjustments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jain_silver', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔄 Resetting all manual adjustments to 0...');

    // Update all silver rates to set manualAdjustment to 0
    const result = await SilverRate.updateMany(
      {},
      {
        $set: {
          manualAdjustment: 0,
          lastUpdated: new Date()
        }
      }
    );

    console.log(`✅ Reset ${result.modifiedCount} silver rate adjustments to 0`);

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error resetting adjustments:', error);
    process.exit(1);
  }
}

resetAdjustments();