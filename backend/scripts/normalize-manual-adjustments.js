#!/usr/bin/env node
/*
  normalize-manual-adjustments.js

  Normalize `manualAdjustment` for all SilverRate documents so that
  `manualAdjustment = current ratePerGram - live base rate (adjusted for purity)`.

  By default the script runs in dry-run mode and only logs what would change.
  To apply changes set environment variable `DRY_RUN=false`.

  Usage:
    node normalize-manual-adjustments.js
    DRY_RUN=false node normalize-manual-adjustments.js

  Notes:
  - Requires `MONGODB_URI` env var if your DB isn't on localhost.
  - This script uses the same multi-source fetcher as the app to get current base rate.
*/

const mongoose = require('mongoose');
const path = require('path');

const DRY_RUN = process.env.DRY_RUN !== 'false';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jain_silver';

async function main() {
  console.log(`🔧 normalize-manual-adjustments starting (DRY_RUN=${DRY_RUN})`);

  // Connect to DB
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ Could not connect to MongoDB:', err.message);
    process.exit(1);
  }

  // Load models and fetcher
  const SilverRate = require('../models/SilverRate');
  const { fetchSilverRatesFromMultipleSources } = require('../utils/multiSourceRateFetcher');

  // Fetch live base rate from sources
  let liveRate;
  try {
    liveRate = await Promise.race([
      fetchSilverRatesFromMultipleSources(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Rate fetch timeout')), 5000))
    ]);
  } catch (err) {
    console.error('❌ Could not fetch live base rate:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!liveRate || !liveRate.ratePerGram) {
    console.error('❌ Invalid live rate received:', liveRate);
    await mongoose.disconnect();
    process.exit(1);
  }

  const baseRatePerGram = liveRate.ratePerGram;
  console.log(`📡 Live base rate: ₹${baseRatePerGram.toFixed(4)}/gram (source: ${liveRate.source || 'unknown'})`);

  // Load all rates in Andhra Pradesh
  const rates = await SilverRate.find({ location: 'Andhra Pradesh' }).lean();
  console.log(`📋 Found ${rates.length} SilverRate documents`);

  const updates = [];

  for (const r of rates) {
    let expectedBase = baseRatePerGram;
    if (r.purity === '92.5%') {
      expectedBase = baseRatePerGram * 0.96;
    } else if (r.purity === '99.99%') {
      expectedBase = baseRatePerGram * 1.005;
    }

    // compute current manual adjustment as difference between stored ratePerGram and expected base
    const currentRatePerGram = typeof r.ratePerGram === 'number' ? r.ratePerGram : 0;
    const newManual = currentRatePerGram - expectedBase;

    // If near-zero, set exactly zero
    const newManualRounded = Math.abs(newManual) < 1e-6 ? 0 : parseFloat(newManual.toFixed(4));

    // Determine whether update required (tolerate tiny diffs)
    const oldManual = typeof r.manualAdjustment === 'number' ? r.manualAdjustment : 0;
    const diff = Math.abs(oldManual - newManualRounded);

    if (diff > 0.0001) {
      updates.push({ id: r._id, name: r.name, oldManual, newManual: newManualRounded });
    }
  }

  console.log(`⚠️ ${updates.length} rates will be updated${DRY_RUN ? ' (dry-run)' : ''}`);
  updates.forEach(u => {
    console.log(`   - ${u.name}: ${u.oldManual} → ${u.newManual}`);
  });

  if (!DRY_RUN && updates.length > 0) {
    // Apply updates
    const bulkOps = updates.map(u => ({
      updateOne: {
        filter: { _id: u.id },
        update: { $set: { manualAdjustment: u.newManual, lastUpdated: new Date() } }
      }
    }));

    try {
      const res = await SilverRate.bulkWrite(bulkOps);
      console.log(`✅ Applied updates: ${res.modifiedCount} modified`);
    } catch (err) {
      console.error('❌ Failed to apply updates:', err.message);
    }
  }

  await mongoose.disconnect();
  console.log('🔚 Done');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
