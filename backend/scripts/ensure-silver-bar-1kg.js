const mongoose = require('mongoose');
const SilverRate = require('../models/SilverRate');
require('dotenv').config();

async function ensureSilverBar1Kg() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jain_silver', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Check if Silver Bar 1 Kg exists
    let silverBar1Kg = await SilverRate.findOne({ 
      name: 'Silver Bar 1 Kg',
      location: 'Andhra Pradesh'
    });

    if (!silverBar1Kg) {
      console.log('📦 Silver Bar 1 Kg not found. Creating it...');
      
      // Get a reference rate to calculate the ratePerGram
      const referenceRate = await SilverRate.findOne({ 
        location: 'Andhra Pradesh',
        purity: '99.99%'
      });

      let ratePerGram = 76.00; // Default rate
      if (referenceRate && referenceRate.ratePerGram) {
        ratePerGram = referenceRate.ratePerGram;
        console.log(`📊 Using reference rate: ₹${ratePerGram}/gram`);
      } else {
        console.log(`📊 Using default rate: ₹${ratePerGram}/gram`);
      }

      // Calculate total rate for 1 kg (1000 grams)
      const totalRate = Math.round(ratePerGram * 1000 * 100) / 100;

      // Create the product
      silverBar1Kg = await SilverRate.create({
        name: 'Silver Bar 1 Kg',
        type: 'bar',
        weight: { value: 1, unit: 'kg' },
        purity: '99.99%',
        rate: totalRate,
        ratePerGram: ratePerGram,
        manualAdjustment: 0,
        location: 'Andhra Pradesh',
        unit: 'INR',
        isVisible: true, // Make sure it's visible
        displayName: null,
        lastUpdated: new Date()
      });

      console.log(`✅ Created Silver Bar 1 Kg: ₹${totalRate.toFixed(2)} (₹${ratePerGram.toFixed(2)}/gram)`);
    } else {
      console.log('✅ Silver Bar 1 Kg already exists');
      
      // Ensure it's visible
      if (silverBar1Kg.isVisible === false) {
        silverBar1Kg.isVisible = true;
        await silverBar1Kg.save();
        console.log('✅ Made Silver Bar 1 Kg visible');
      } else {
        console.log('✅ Silver Bar 1 Kg is already visible');
      }

      // Show current status
      console.log(`📊 Current status:`);
      console.log(`   Name: ${silverBar1Kg.name}`);
      console.log(`   Rate: ₹${silverBar1Kg.rate?.toFixed(2) || 'N/A'}`);
      console.log(`   Rate per gram: ₹${silverBar1Kg.ratePerGram?.toFixed(2) || 'N/A'}/gram`);
      console.log(`   Visible: ${silverBar1Kg.isVisible ? 'Yes' : 'No'}`);
      console.log(`   Last updated: ${silverBar1Kg.lastUpdated || 'N/A'}`);
    }

    console.log('\n✅ Silver Bar 1 Kg is ready!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error ensuring Silver Bar 1 Kg:', error);
    process.exit(1);
  }
}

ensureSilverBar1Kg();

