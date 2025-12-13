const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const SilverRate = require('../models/SilverRate');
const Settings = require('../models/Settings');

// Helper function to fetch manual adjustments from MongoDB
const fetchManualAdjustments = async (rateNames) => {
  let adjustmentsMap = {};
  try {
    const adjustments = await SilverRate.find({ 
      location: 'Andhra Pradesh',
      name: { $in: rateNames }
    }).select('name manualAdjustment').lean();
    
    adjustments.forEach(adj => {
      adjustmentsMap[adj.name] = adj.manualAdjustment || 0;
    });
  } catch (error) {
    console.warn('Could not fetch manual adjustments from MongoDB, using defaults:', error.message);
  }
  return adjustmentsMap;
};

// Helper function to get original rates (without adjustments) from base rate
const getOriginalRates = async (baseRatePerGram) => {
  const rateDefinitions = [
    { name: 'Silver Coin 1 Gram', type: 'coin', weight: { value: 1, unit: 'grams' }, purity: '99.9%' },
    { name: 'Silver Coin 5 Grams', type: 'coin', weight: { value: 5, unit: 'grams' }, purity: '99.9%' },
    { name: 'Silver Coin 10 Grams', type: 'coin', weight: { value: 10, unit: 'grams' }, purity: '99.9%' },
    { name: 'Silver Coin 50 Grams', type: 'coin', weight: { value: 50, unit: 'grams' }, purity: '99.9%' },
    { name: 'Silver Coin 100 Grams', type: 'coin', weight: { value: 100, unit: 'grams' }, purity: '99.9%' },
    { name: 'Silver Bar 100 Grams', type: 'bar', weight: { value: 100, unit: 'grams' }, purity: '99.99%' },
    { name: 'Silver Bar 500 Grams', type: 'bar', weight: { value: 500, unit: 'grams' }, purity: '99.99%' },
    { name: 'Silver Bar 1 Kg', type: 'bar', weight: { value: 1, unit: 'kg' }, purity: '99.99%' },
    { name: 'Silver Jewelry 92.5%', type: 'jewelry', weight: { value: 1, unit: 'grams' }, purity: '92.5%' },
    { name: 'Silver Jewelry 99.9%', type: 'jewelry', weight: { value: 1, unit: 'grams' }, purity: '99.9%' }
  ];

  return rateDefinitions.map(rateDef => {
    let ratePerGram = baseRatePerGram;
    if (rateDef.purity === '92.5%') {
      ratePerGram = baseRatePerGram * 0.96;
    } else if (rateDef.purity === '99.99%') {
      ratePerGram = baseRatePerGram * 1.005;
    }
    
    ratePerGram = Math.round(ratePerGram * 100) / 100;
    
    let weightInGrams = rateDef.weight.value;
    if (rateDef.weight.unit === 'kg') {
      weightInGrams = rateDef.weight.value * 1000;
    }
    
    const totalRate = Math.round(ratePerGram * weightInGrams * 100) / 100;
    const id = Buffer.from(rateDef.name).toString('base64').substring(0, 24);
    
    return {
      _id: id,
      name: rateDef.name,
      type: rateDef.type,
      weight: rateDef.weight,
      purity: rateDef.purity,
      ratePerGram: ratePerGram,
      rate: totalRate,
      originalRatePerGram: ratePerGram,
      originalRate: totalRate,
      lastUpdated: new Date(),
      location: 'Andhra Pradesh',
      unit: 'INR',
      manualAdjustment: 0
    };
  });
};

// Helper function to apply manual adjustments to rates from MongoDB
// NOTE: Rates from MongoDB already have adjustments applied in ratePerGram
// This function just ensures the data structure is correct for the API response
const applyManualAdjustments = async (rates) => {
  // Fetch current adjustments from MongoDB
  const adjustmentsMap = await fetchManualAdjustments(rates.map(r => r.name));

  return rates.map(rate => {
    const manualAdjustment = adjustmentsMap[rate.name] || rate.manualAdjustment || 0;
    
    // IMPORTANT: rate.ratePerGram in MongoDB already includes adjustments
    // So original = current - adjustment
    const currentRatePerGram = rate.ratePerGram || 0;
    const originalRatePerGram = currentRatePerGram - manualAdjustment;
    
    // Calculate original total rate
    let weightInGrams = rate.weight.value;
    if (rate.weight.unit === 'kg') {
      weightInGrams = rate.weight.value * 1000;
    }
    const originalTotalRate = Math.round(originalRatePerGram * weightInGrams * 100) / 100;
    
    // Current rate (already has adjustments) is what customers see
    const adjustedRatePerGram = currentRatePerGram;
    const adjustedTotalRate = rate.rate || Math.round(adjustedRatePerGram * weightInGrams * 100) / 100;
    
    return {
      ...rate,
      ratePerGram: adjustedRatePerGram, // Current rate with adjustments (what customers see)
      rate: adjustedTotalRate,
      originalRatePerGram: Math.max(0, originalRatePerGram), // Original without adjustments
      originalRate: Math.max(0, originalTotalRate),
      manualAdjustment: manualAdjustment
    };
  });
};

// Cache for live base rate (updated on every request)
let cachedBaseRate = {
  ratePerGram: 169.0, // Default fallback rate
  ratePerKg: 169000,
  source: 'cache',
  lastUpdated: new Date(),
  usdInrRate: 89.25
};

// Rate history for smoothing (keep last 10 rates for averaging)
let rateHistory = [];
const MAX_HISTORY_SIZE = 10;

// Track last update attempt to prevent too frequent updates
let lastUpdateAttempt = 0;
let lastSuccessfulUpdate = 0;
const MIN_UPDATE_INTERVAL = 1000; // Update at most once per second

// Rate smoothing: Only update if change is significant (prevents rapid fluctuations)
// Increased to ₹0.50/gram to prevent small market fluctuations from causing visual noise
const RATE_CHANGE_THRESHOLD = 0.50;

// Calculate smoothed rate using exponential moving average
const calculateSmoothedRate = (newRate) => {
  // Add new rate to history
  rateHistory.push({
    rate: newRate,
    timestamp: Date.now()
  });
  
  // Keep only recent rates (last 10)
  if (rateHistory.length > MAX_HISTORY_SIZE) {
    rateHistory.shift();
  }
  
  // Remove rates older than 30 seconds
  const thirtySecondsAgo = Date.now() - 30000;
  rateHistory = rateHistory.filter(r => r.timestamp > thirtySecondsAgo);
  
  if (rateHistory.length === 0) {
    return newRate;
  }
  
  // Calculate weighted average (more recent = higher weight)
  let totalWeight = 0;
  let weightedSum = 0;
  
  rateHistory.forEach((item, index) => {
    const weight = index + 1; // More recent rates have higher weight
    weightedSum += item.rate * weight;
    totalWeight += weight;
  });
  
  const smoothedRate = weightedSum / totalWeight;
  return Math.round(smoothedRate * 100) / 100;
};

// Update rates from endpoints (non-blocking)
const updateRatesFromEndpoints = async () => {
  // Skip on serverless - rate updates should be handled externally
  if (process.env.VERCEL) {
    return; // Don't fetch on serverless to avoid timeouts
  }
  
  const now = Date.now();
  
  // Prevent too frequent updates (max once per second)
  const timeSinceLastAttempt = now - lastUpdateAttempt;
  const timeSinceLastSuccess = now - lastSuccessfulUpdate;
  
  if (timeSinceLastAttempt < MIN_UPDATE_INTERVAL && timeSinceLastSuccess < 3000) {
    return; // Skip if updated recently AND last success was recent
  }
  
  lastUpdateAttempt = now;
  
  console.log(`📡 Fetching rates from endpoints... (last attempt: ${timeSinceLastAttempt}ms ago)`);
  
  try {
    const { fetchSilverRatesFromMultipleSources } = require('../utils/multiSourceRateFetcher');
    
    // Fetch with timeout (reduced for serverless - Vercel has 10s limit)
    // Use 3 seconds to leave room for other processing
    const liveRate = await Promise.race([
      fetchSilverRatesFromMultipleSources(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout after 3 seconds')), 3000)
      )
    ]);

    if (liveRate && liveRate.ratePerGram && liveRate.ratePerGram > 0) {
      const oldRate = cachedBaseRate.ratePerGram;
      
      // Apply smoothing to reduce rapid fluctuations
      const smoothedRate = calculateSmoothedRate(liveRate.ratePerGram);
      const rateChange = Math.abs(smoothedRate - oldRate);
      
      // Log raw vs smoothed rate
      console.log(`📊 Raw: ₹${liveRate.ratePerGram.toFixed(2)}/g → Smoothed: ₹${smoothedRate.toFixed(2)}/g (change: ₹${rateChange.toFixed(2)})`);
      
      // Only update if change is significant OR if cache is stale (older than 10 seconds)
      const cacheAge = Date.now() - cachedBaseRate.lastUpdated.getTime();
      const isStale = cacheAge > 10000;
      const isInitial = oldRate === 169.0 && cachedBaseRate.source === 'cache';
      
      if (rateChange >= RATE_CHANGE_THRESHOLD || isStale || isInitial) {
        cachedBaseRate = {
          ratePerGram: smoothedRate,
          ratePerKg: Math.round(smoothedRate * 1000),
          source: liveRate.source || 'live',
          lastUpdated: new Date(),
          usdInrRate: liveRate.usdInrRate || 89.25
        };
        
        // Log updates with change indicator
        const changeIndicator = smoothedRate > oldRate ? '↑' : (smoothedRate < oldRate ? '↓' : '≈');
        console.log(`✅ Rate updated: ₹${oldRate.toFixed(2)} → ₹${smoothedRate.toFixed(2)}/gram ${changeIndicator}`);
        
        // Mark successful update
        lastSuccessfulUpdate = Date.now();
        
        // Update MongoDB with smoothed rate
        try {
          const smoothedLiveRate = { 
            ...liveRate, 
            ratePerGram: smoothedRate, 
            ratePerKg: Math.round(smoothedRate * 1000) 
          };
          await updateMongoDBRates(smoothedLiveRate);
        } catch (mongoError) {
          console.error('❌ MongoDB update failed:', mongoError.message);
        }
      } else {
        console.log(`⏭️ Stable rate: ₹${oldRate.toFixed(2)}/gram (change ${rateChange.toFixed(2)} < threshold ${RATE_CHANGE_THRESHOLD})`);
        // Still mark as successful even if we didn't update (rate is stable)
        lastSuccessfulUpdate = Date.now();
      }
    } else {
      console.warn('⚠️ Invalid rate received:', liveRate);
    }
  } catch (error) {
    console.error('❌ Rate fetch failed:', error.message);
  }
};

// Update MongoDB rates
const updateMongoDBRates = async (liveRate) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(process.env.MONGODB_URI, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
        });
        console.log('✅ MongoDB connected for rate update');
      } catch (connError) {
        console.warn('⚠️ MongoDB connection failed:', connError.message);
        return;
      }
    }

    const baseRatePerGram = liveRate.ratePerGram;
    const rateDefinitions = [
      { name: 'Silver Coin 1 Gram', type: 'coin', weight: { value: 1, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Coin 5 Grams', type: 'coin', weight: { value: 5, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Coin 10 Grams', type: 'coin', weight: { value: 10, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Coin 50 Grams', type: 'coin', weight: { value: 50, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Coin 100 Grams', type: 'coin', weight: { value: 100, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Bar 100 Grams', type: 'bar', weight: { value: 100, unit: 'grams' }, purity: '99.99%' },
      { name: 'Silver Bar 500 Grams', type: 'bar', weight: { value: 500, unit: 'grams' }, purity: '99.99%' },
      { name: 'Silver Bar 1 Kg', type: 'bar', weight: { value: 1, unit: 'kg' }, purity: '99.99%' },
      { name: 'Silver Jewelry 92.5%', type: 'jewelry', weight: { value: 1, unit: 'grams' }, purity: '92.5%' },
      { name: 'Silver Jewelry 99.9%', type: 'jewelry', weight: { value: 1, unit: 'grams' }, purity: '99.9%' }
    ];

    // Fetch manual adjustments from MongoDB
    const adjustmentsMap = await fetchManualAdjustments(rateDefinitions.map(r => r.name));

    let updatedCount = 0;
    const updatePromises = rateDefinitions.map(async (rateDef) => {
      try {
        let ratePerGram = baseRatePerGram;
        if (rateDef.purity === '92.5%') {
          ratePerGram = baseRatePerGram * 0.96;
        } else if (rateDef.purity === '99.99%') {
          ratePerGram = baseRatePerGram * 1.005;
        }

        const manualAdjustment = adjustmentsMap[rateDef.name] || 0;
        ratePerGram = ratePerGram + manualAdjustment;
        ratePerGram = Math.max(0, Math.round(ratePerGram * 100) / 100);

        let weightInGrams = rateDef.weight.value;
        if (rateDef.weight.unit === 'kg') {
          weightInGrams = rateDef.weight.value * 1000;
        }

        const totalRate = Math.round(ratePerGram * weightInGrams * 100) / 100;

        await SilverRate.findOneAndUpdate(
          { name: rateDef.name, location: 'Andhra Pradesh' },
          {
            name: rateDef.name,
            type: rateDef.type,
            weight: rateDef.weight,
            purity: rateDef.purity,
            ratePerGram: ratePerGram,
            rate: totalRate,
            lastUpdated: new Date(),
            location: 'Andhra Pradesh',
            unit: 'INR',
            manualAdjustment: manualAdjustment,
            source: 'rbgoldspot'
          },
          { upsert: true, new: true }
        );
        updatedCount++;
      } catch (err) {
        console.error(`❌ Failed to update ${rateDef.name}:`, err.message);
      }
    });
    
    await Promise.all(updatePromises);
    
    if (updatedCount > 0) {
      console.log(`✅ MongoDB: Updated ${updatedCount} rates (base: ₹${baseRatePerGram.toFixed(2)}/gram)`);
    }
  } catch (error) {
    console.error('❌ MongoDB rate update error:', error.message);
  }
};

/**
 * @swagger
 * /rates:
 *   get:
 *     summary: Get all silver rates (Public)
 *     tags: [Rates]
 *     description: Returns current silver rates for all products with manual adjustments applied
 *     responses:
 *       200:
 *         description: List of silver rates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SilverRate'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get all silver rates - First tries MongoDB, then live API
router.get('/', async (req, res) => {
  try {
    // Check for skipUpdate query parameter (for admin dashboard to avoid waiting for slow external updates)
    const skipUpdate = req.query.skipUpdate === 'true' || req.query.skipUpdate === true;
    
    // Auth check (optional)
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const jwt = require('jsonwebtoken');
        jwt.verify(token, process.env.JWT_SECRET || 'jain_silver_secret_key_2024_change_in_production');
      }
    } catch (authError) {
      // Continue without auth
    }
    
    // Check if "Show As It Is" is enabled
    let showAsItIs = false;
    try {
      const showAsItIsSetting = await Settings.getSetting('showAsItIs');
      showAsItIs = showAsItIsSetting.value;
    } catch (settingsError) {
      console.warn('Could not fetch showAsItIs setting, defaulting to false:', settingsError.message);
    }
    
    // ALWAYS try to get rates from MongoDB first (primary source)
    // In serverless, we need to ensure connection on each request
    try {
      const mongoose = require('mongoose');
      
      // For serverless (Vercel), ensure connection on each request
      if (mongoose.connection.readyState !== 1) {
        // Try to connect if not connected (serverless cold start)
        try {
          const mongoURI = process.env.MONGODB_URI;
          if (mongoURI) {
            // Quick connection attempt with short timeout for serverless
            await Promise.race([
              mongoose.connect(mongoURI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 3000, // 3 seconds for serverless
                socketTimeoutMS: 10000,
                maxPoolSize: 1, // Single connection for serverless
                minPoolSize: 0
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('MongoDB connection timeout')), 3000)
              )
            ]);
            console.log('✅ MongoDB connected on request');
          }
        } catch (connErr) {
          console.warn('⚠️ MongoDB connection failed on request:', connErr.message);
        }
      }
      
      if (mongoose.connection.readyState === 1) {
        const mongoRates = await SilverRate.find({ location: 'Andhra Pradesh' })
          .sort({ name: 1 })
          .lean();
        
        if (mongoRates && mongoRates.length > 0) {
          // Always use MongoDB rates if available (they're updated every second)
          const latestRate = mongoRates.reduce((latest, rate) => {
            return rate.lastUpdated > latest.lastUpdated ? rate : latest;
          }, mongoRates[0]);
          
          const mongoAge = Date.now() - new Date(latestRate.lastUpdated).getTime();
          const STALE_THRESHOLD = 1000; // 1 second - update every second for live rates
          const VERY_STALE_THRESHOLD = 3000; // 3 seconds - if very stale, wait for update before serving
          const OLD_RATE_THRESHOLD = 170; // If rate is below this, it's likely old cached data
          
          // Check if ANY 99.9% rate is old cached data (should be ~₹176-177, not ₹169)
          const hasOld99_9Rates = mongoRates.some(rate => 
            rate.purity === '99.9%' && rate.ratePerGram < OLD_RATE_THRESHOLD
          );
          
          // If skipUpdate is true, skip waiting for updates and return current rates immediately
          if (skipUpdate) {
            console.log('⏩ Skipping rate update (skipUpdate=true), returning current MongoDB rates immediately');
            let finalRates;
            if (showAsItIs) {
              // If "Show As It Is" is enabled, return original rates without adjustments
              let baseRatePerGram = cachedBaseRate.ratePerGram;
              try {
                const { fetchSilverRatesFromMultipleSources } = require('../utils/multiSourceRateFetcher');
                const liveRate = await Promise.race([
                  fetchSilverRatesFromMultipleSources(),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout after 5 seconds')), 5000)
                  )
                ]);
                if (liveRate && liveRate.ratePerGram && liveRate.ratePerGram > 0) {
                  baseRatePerGram = liveRate.ratePerGram;
                }
              } catch (fetchError) {
                console.warn('Could not fetch fresh base rate, using cached:', fetchError.message);
              }
              finalRates = await getOriginalRates(baseRatePerGram);
            } else {
              finalRates = await applyManualAdjustments(mongoRates);
            }
            const ratesWithUSD = finalRates.map(rate => ({
              ...rate,
              usdInrRate: cachedBaseRate.usdInrRate || 89.25
            }));
            res.set({
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            });
            return res.json(ratesWithUSD);
          }
          
          // If rates are very stale OR contain old 99.9% rates, wait for update before serving
          if (mongoAge > VERY_STALE_THRESHOLD || hasOld99_9Rates) {
            const reason = hasOld99_9Rates 
              ? `contains old 99.9% rates (₹169 detected, expected ~₹176-177)`
              : `very stale (${Math.round(mongoAge/1000)}s old)`;
            console.log(`⚠️ Rates are ${reason}, fetching fresh rates before serving...`);
            try {
              await updateRatesHandler(req, null); // Wait for update
              // Fetch fresh rates after update
              const freshRates = await SilverRate.find({ location: 'Andhra Pradesh' })
                .sort({ name: 1 })
                .lean();
              if (freshRates && freshRates.length > 0) {
                // Verify no old 99.9% rates in fresh data
                const stillHasOldRates = freshRates.some(rate => 
                  rate.purity === '99.9%' && rate.ratePerGram < OLD_RATE_THRESHOLD
                );
                
                if (stillHasOldRates) {
                  console.error('❌ Fresh rates still contain old 99.9% rates! Update may have failed.');
                  // Try one more time with longer timeout
                  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                  await updateRatesHandler(req, null);
                  const retryRates = await SilverRate.find({ location: 'Andhra Pradesh' })
                    .sort({ name: 1 })
                    .lean();
                  if (retryRates && retryRates.length > 0) {
                    const ratesWithAdjustments = await applyManualAdjustments(retryRates);
                    const ratesWithUSD = ratesWithAdjustments.map(rate => ({
                      ...rate,
                      usdInrRate: cachedBaseRate.usdInrRate || 89.25
                    }));
                    res.set({
                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                      'Pragma': 'no-cache',
                      'Expires': '0'
                    });
                    return res.json(ratesWithUSD);
                  }
                } else {
                  const freshLatest = freshRates.reduce((latest, rate) => {
                    return rate.lastUpdated > latest.lastUpdated ? rate : latest;
                  }, freshRates[0]);
                  const freshAge = Date.now() - new Date(freshLatest.lastUpdated).getTime();
                  console.log(`✅ Fresh rates loaded: ${freshRates.length} rates (${Math.round(freshAge/1000)}s old, latest: ${freshLatest.name} = ₹${freshLatest.ratePerGram}/gram)`);
                  
                  const ratesWithAdjustments = await applyManualAdjustments(freshRates);
                  const ratesWithUSD = ratesWithAdjustments.map(rate => ({
                      ...rate,
                      usdInrRate: cachedBaseRate.usdInrRate || 89.25
                    }));
                  res.set({
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                  });
                  return res.json(ratesWithUSD);
                }
              }
            } catch (updateErr) {
              console.error('❌ Update failed for stale/old rates:', updateErr.message);
              // Don't serve old rates - return error instead
              return res.status(503).json({ 
                error: 'Rate update in progress, please retry',
                message: 'Fetching fresh rates, please try again in a moment'
              });
            }
          }
          
          // If rates are stale (older than 1 second), wait for update to complete
          // Since mobile app polls every second, this ensures rates update every second
          // Skip this if skipUpdate is true (for admin dashboard)
          if (!skipUpdate && mongoAge > STALE_THRESHOLD) {
            console.log(`🔄 Rates are stale (${Math.round(mongoAge/1000)}s old), fetching fresh rates...`);
            try {
              // Wait for update to complete (blocking) to ensure fresh rates
              await updateRatesHandler(req, null);
              // Fetch fresh rates after update
              const freshRates = await SilverRate.find({ location: 'Andhra Pradesh' })
                .sort({ name: 1 })
                .lean();
              if (freshRates && freshRates.length > 0) {
                const freshLatest = freshRates.reduce((latest, rate) => {
                  return rate.lastUpdated > latest.lastUpdated ? rate : latest;
                }, freshRates[0]);
                const freshAge = Date.now() - new Date(freshLatest.lastUpdated).getTime();
                console.log(`✅ Fresh rates fetched: ${freshRates.length} rates (${Math.round(freshAge/1000)}s old, latest: ${freshLatest.name} = ₹${freshLatest.ratePerGram}/gram)`);
                
                const ratesWithAdjustments = await applyManualAdjustments(freshRates);
                const ratesWithUSD = ratesWithAdjustments.map(rate => ({
                  ...rate,
                  usdInrRate: cachedBaseRate.usdInrRate || 89.25
                }));
                res.set({
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache',
                  'Expires': '0'
                });
                return res.json(ratesWithUSD);
              }
            } catch (updateErr) {
              console.error('❌ Update failed for stale rates:', updateErr.message);
              // If update fails, still serve current rates (better than error)
              // But log the failure
            }
          }
          
          // Warn if serving old rates (might indicate update failures)
          if (mongoAge > 5000) {
            console.warn(`⚠️ Serving rates that are ${Math.round(mongoAge/1000)}s old - updates may be failing!`);
          }
          
          // Check if we're about to serve old 99.9% rates - if so, don't serve them
          const hasOld99_9InResponse = mongoRates.some(rate => 
            rate.purity === '99.9%' && rate.ratePerGram < OLD_RATE_THRESHOLD
          );
          
          if (hasOld99_9InResponse) {
            console.error(`❌ BLOCKED: Attempted to serve old 99.9% rates (₹169 detected). Fetching fresh rates...`);
            try {
              await updateRatesHandler(req, null);
              const freshRates = await SilverRate.find({ location: 'Andhra Pradesh' })
                .sort({ name: 1 })
                .lean();
              if (freshRates && freshRates.length > 0) {
                const ratesWithAdjustments = await applyManualAdjustments(freshRates);
                const ratesWithUSD = ratesWithAdjustments.map(rate => ({
                  ...rate,
                  usdInrRate: cachedBaseRate.usdInrRate || 89.25
                }));
                res.set({
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache',
                  'Expires': '0'
                });
                return res.json(ratesWithUSD);
              }
            } catch (updateErr) {
              console.error('❌ Failed to fetch fresh rates:', updateErr.message);
              return res.status(503).json({ 
                error: 'Rate update in progress',
                message: 'Please retry in a moment'
              });
            }
          }
          
          // Only log occasionally to avoid spam (every 10th request)
          if (Math.random() < 0.1) {
            console.log(`📦 Serving ${mongoRates.length} rates from MongoDB (${Math.round(mongoAge/1000)}s old, latest: ${latestRate.name} = ₹${latestRate.ratePerGram}/gram)`);
          }
          
          let finalRates;
          if (showAsItIs) {
            // If "Show As It Is" is enabled, return original rates without adjustments
            // Fetch fresh base rate from source
            let baseRatePerGram = cachedBaseRate.ratePerGram;
            try {
              const { fetchSilverRatesFromMultipleSources } = require('../utils/multiSourceRateFetcher');
              const liveRate = await Promise.race([
                fetchSilverRatesFromMultipleSources(),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout after 5 seconds')), 5000)
                )
              ]);
              if (liveRate && liveRate.ratePerGram && liveRate.ratePerGram > 0) {
                baseRatePerGram = liveRate.ratePerGram;
                console.log(`✅ Fetched fresh base rate for "Show As It Is": ₹${baseRatePerGram.toFixed(2)}/gram`);
              }
            } catch (fetchError) {
              console.warn('Could not fetch fresh base rate, using cached:', fetchError.message);
              // Use cached base rate as fallback
            }
            
            // Get original rates from base rate
            finalRates = await getOriginalRates(baseRatePerGram);
            console.log(`✅ "Show As It Is" enabled - returning original rates (base: ₹${baseRatePerGram.toFixed(2)}/gram)`);
          } else {
            // Apply manual adjustments to rates from MongoDB
            // This ensures admin adjustments are reflected immediately
            finalRates = await applyManualAdjustments(mongoRates);
          }
          
          // Add USD rate to all rates if available
          const ratesWithUSD = finalRates.map(rate => ({
            ...rate,
            usdInrRate: cachedBaseRate.usdInrRate || 89.25
          }));
          
          // Set headers to prevent caching
          res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          });
          
          return res.json(ratesWithUSD);
        } else {
          console.warn('⚠️ No rates found in MongoDB, triggering update...');
          // If no rates exist, try to update immediately
          try {
            await updateRatesHandler(req, res);
            // After update, fetch again
            const updatedRates = await SilverRate.find({ location: 'Andhra Pradesh' })
              .sort({ name: 1 })
              .lean();
            if (updatedRates && updatedRates.length > 0) {
              const ratesWithUSD = updatedRates.map(rate => ({
                ...rate,
                usdInrRate: cachedBaseRate.usdInrRate || 89.25
              }));
              res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              });
              return res.json(ratesWithUSD);
            }
          } catch (updateErr) {
            console.error('Update failed:', updateErr.message);
          }
          console.warn('⚠️ Falling back to cache');
        }
      } else {
        console.warn('⚠️ MongoDB not connected, falling back to cache');
      }
    } catch (mongoErr) {
      console.error('❌ MongoDB read failed:', mongoErr.message);
      console.warn('⚠️ Falling back to cache');
    }
    
    // Fallback: Calculate rates from cache
    const baseRatePerGram = cachedBaseRate.ratePerGram;
    const currentTime = new Date();
    
    const rateDefinitions = [
      { name: 'Silver Coin 1 Gram', type: 'coin', weight: { value: 1, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Coin 5 Grams', type: 'coin', weight: { value: 5, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Coin 10 Grams', type: 'coin', weight: { value: 10, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Coin 50 Grams', type: 'coin', weight: { value: 50, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Coin 100 Grams', type: 'coin', weight: { value: 100, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Bar 100 Grams', type: 'bar', weight: { value: 100, unit: 'grams' }, purity: '99.99%' },
      { name: 'Silver Bar 500 Grams', type: 'bar', weight: { value: 500, unit: 'grams' }, purity: '99.99%' },
      { name: 'Silver Bar 1 Kg', type: 'bar', weight: { value: 1, unit: 'kg' }, purity: '99.99%' },
      { name: 'Silver Jewelry 92.5%', type: 'jewelry', weight: { value: 1, unit: 'grams' }, purity: '92.5%' },
      { name: 'Silver Jewelry 99.9%', type: 'jewelry', weight: { value: 1, unit: 'grams' }, purity: '99.9%' }
    ];
    
    // Check if "Show As It Is" is enabled (variable already declared at top of function)
    // Re-fetch setting in case it changed, but don't redeclare the variable
    try {
      const showAsItIsSetting = await Settings.getSetting('showAsItIs');
      showAsItIs = showAsItIsSetting.value;
    } catch (settingsError) {
      console.warn('Could not fetch showAsItIs setting in fallback, using previous value:', settingsError.message);
      // Keep existing showAsItIs value from top of function
    }
    
    let allRates;
    if (showAsItIs) {
      // If "Show As It Is" is enabled, return original rates without adjustments
      allRates = await getOriginalRates(baseRatePerGram);
      console.log(`✅ "Show As It Is" enabled - returning original rates from cache (base: ₹${baseRatePerGram.toFixed(2)}/gram)`);
    } else {
      // Fetch manual adjustments from MongoDB
      const adjustmentsMap = await fetchManualAdjustments(rateDefinitions.map(r => r.name));

      allRates = rateDefinitions.map(rateDef => {
        let ratePerGram = baseRatePerGram;
        if (rateDef.purity === '92.5%') {
          ratePerGram = baseRatePerGram * 0.96;
        } else if (rateDef.purity === '99.99%') {
          ratePerGram = baseRatePerGram * 1.005;
        }
        
        const manualAdjustment = adjustmentsMap[rateDef.name] || 0;
        ratePerGram = ratePerGram + manualAdjustment;
        ratePerGram = Math.max(0, Math.round(ratePerGram * 100) / 100);
        
        let weightInGrams = rateDef.weight.value;
        if (rateDef.weight.unit === 'kg') {
          weightInGrams = rateDef.weight.value * 1000;
        }
        
        const totalRate = Math.round(ratePerGram * weightInGrams * 100) / 100;
        const id = Buffer.from(rateDef.name).toString('base64').substring(0, 24);
        
        // Store original rate before adjustment
        const originalRatePerGram = ratePerGram - manualAdjustment;
        let originalWeightInGrams = rateDef.weight.value;
        if (rateDef.weight.unit === 'kg') {
          originalWeightInGrams = rateDef.weight.value * 1000;
        }
        const originalTotalRate = Math.round(originalRatePerGram * originalWeightInGrams * 100) / 100;
        
        return {
          _id: id,
          name: rateDef.name,
          type: rateDef.type,
          weight: rateDef.weight,
          purity: rateDef.purity,
          ratePerGram: ratePerGram,
          rate: totalRate,
          originalRatePerGram: originalRatePerGram,
          originalRate: originalTotalRate,
          lastUpdated: currentTime,
          usdInrRate: cachedBaseRate.usdInrRate,
          source: cachedBaseRate.source,
          location: 'Andhra Pradesh',
          unit: 'INR',
          manualAdjustment: manualAdjustment
        };
      });
    }
    
    console.log(`📦 Serving ${allRates.length} rates from cache (base: ₹${baseRatePerGram.toFixed(2)}/gram)`);
    
    // Set headers to prevent caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    return res.json(allRates);
    
  } catch (error) {
    console.error('Get rates error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch rates', message: error.message });
  }
});

// Update silver rate (admin only) - Now saves to MongoDB
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rate, manualAdjustment } = req.body;

    const rateDefinitions = [
      { name: 'Silver Coin 1 Gram' },
      { name: 'Silver Coin 5 Grams' },
      { name: 'Silver Coin 10 Grams' },
      { name: 'Silver Coin 50 Grams' },
      { name: 'Silver Coin 100 Grams' },
      { name: 'Silver Bar 100 Grams' },
      { name: 'Silver Bar 500 Grams' },
      { name: 'Silver Bar 1 Kg' },
      { name: 'Silver Jewelry 92.5%' },
      { name: 'Silver Jewelry 99.9%' }
    ];
    
    const rateDef = rateDefinitions.find(r => {
      const rateId = Buffer.from(r.name).toString('base64').substring(0, 24);
      return rateId === id;
    });
    
    if (!rateDef) {
      return res.status(404).json({ message: 'Rate not found' });
    }

    // Update MongoDB with manual adjustment
    if (manualAdjustment !== undefined) {
      await SilverRate.updateOne(
        { name: rateDef.name, location: 'Andhra Pradesh' },
        { 
          $set: { 
            manualAdjustment: manualAdjustment,
            lastUpdated: new Date()
          } 
        },
        { upsert: true }
      );
    }

    // Fetch updated rate from MongoDB
    const updatedRate = await SilverRate.findOne({ 
      name: rateDef.name, 
      location: 'Andhra Pradesh' 
    });

    res.json({
      message: 'Rate adjustment updated successfully',
      rate: {
        name: rateDef.name,
        manualAdjustment: updatedRate?.manualAdjustment || 0
      }
    });
  } catch (error) {
    console.error('Update rate error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Force rate update (admin only)
router.post('/force-update', auth, async (req, res) => {
  try {
    lastUpdateAttempt = 0;
    rateHistory = []; // Clear history for fresh start
    await updateRatesFromEndpoints();
    res.json({ 
      message: 'Rate update triggered successfully.',
      currentRate: cachedBaseRate.ratePerGram,
      source: cachedBaseRate.source
    });
  } catch (error) {
    console.error('Force update error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Dedicated endpoint for cron jobs to update rates (no auth required for cron)
// This endpoint is designed to be called by Vercel Cron or external services
// Also supports GET method for easy manual triggering
// Can be called internally without response (for background updates)
const updateRatesHandler = async (req, res = null) => {
  const startTime = Date.now();
  try {
    // Only log occasionally to avoid spam (every 10th update)
    if (Math.random() < 0.1) {
      console.log('🔄 Updating rates from live source...');
    }
    
    // Import rate fetcher
    const { fetchSilverRatesFromMultipleSources } = require('../utils/multiSourceRateFetcher');
    
    // Fetch fresh rates with timeout (Vercel allows up to 120s, but use 30s for safety)
    const liveRate = await Promise.race([
      fetchSilverRatesFromMultipleSources(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000)
      )
    ]);

    if (!liveRate || !liveRate.ratePerGram || liveRate.ratePerGram <= 0) {
      console.error('❌ Invalid rate received:', liveRate);
      if (res) {
        return res.status(500).json({ 
          success: false,
          message: 'Failed to fetch valid rate from endpoints',
          timestamp: new Date().toISOString()
        });
      }
      return; // If no response object, just return silently
    }

    // ALWAYS log the fetched rate details (critical for debugging)
    console.log(`📊 Fetched LIVE rate: ₹${liveRate.ratePerGram.toFixed(2)}/gram (₹${liveRate.ratePerKg}/kg)`);
    console.log(`📊 Source: ${liveRate.source}, Raw Ask: ${liveRate.rawData?.ask || 'N/A'}, Raw High: ${liveRate.rawData?.high || 'N/A'}`);
    
    // Warn if rate seems too low (might be old/cached)
    if (liveRate.ratePerGram < 170) {
      console.warn(`⚠️ WARNING: Fetched rate (₹${liveRate.ratePerGram.toFixed(2)}/gram) seems low. Expected ~₹176-177/gram. Check source!`);
    }

    // Update MongoDB directly with fresh rate
    const mongoose = require('mongoose');
    
    // Ensure MongoDB connection (optimized for speed)
    if (mongoose.connection.readyState !== 1) {
      const mongoURI = process.env.MONGODB_URI;
      if (mongoURI) {
        // Use shorter timeout for faster connection
        await Promise.race([
          mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 3000, // Reduced from 5000
            socketTimeoutMS: 10000,
            maxPoolSize: 1,
            minPoolSize: 0
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('MongoDB connection timeout')), 5000)
          )
        ]);
        console.log('✅ MongoDB connected for rate update');
      } else {
        console.error('❌ MONGODB_URI not set');
        if (res) {
          return res.status(500).json({ 
            success: false,
            message: 'MongoDB URI not configured',
            timestamp: new Date().toISOString()
          });
        }
        return; // If no response object, just return silently
      }
    }

    // Use EXACT rate from source (no smoothing, no rounding of base rate)
    const baseRatePerGram = liveRate.ratePerGram;
    const baseRatePerKg = liveRate.ratePerKg; // Use exact value from source
    
    // ALWAYS log MongoDB update (critical for debugging)
    console.log(`💾 Updating MongoDB with LIVE base rate: ₹${baseRatePerGram.toFixed(2)}/gram (₹${baseRatePerKg}/kg)`);
    const rateDefinitions = [
      { name: 'Silver Coin 1 Gram', type: 'coin', weight: { value: 1, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Coin 5 Grams', type: 'coin', weight: { value: 5, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Coin 10 Grams', type: 'coin', weight: { value: 10, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Coin 50 Grams', type: 'coin', weight: { value: 50, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Coin 100 Grams', type: 'coin', weight: { value: 100, unit: 'grams' }, purity: '99.9%' },
      { name: 'Silver Bar 100 Grams', type: 'bar', weight: { value: 100, unit: 'grams' }, purity: '99.99%' },
      { name: 'Silver Bar 500 Grams', type: 'bar', weight: { value: 500, unit: 'grams' }, purity: '99.99%' },
      { name: 'Silver Bar 1 Kg', type: 'bar', weight: { value: 1, unit: 'kg' }, purity: '99.99%' },
      { name: 'Silver Jewelry 92.5%', type: 'jewelry', weight: { value: 1, unit: 'grams' }, purity: '92.5%' },
      { name: 'Silver Jewelry 99.9%', type: 'jewelry', weight: { value: 1, unit: 'grams' }, purity: '99.9%' }
    ];

    // Fetch current manual adjustments from MongoDB
    let adjustmentsMap = {};
    try {
      const existingRates = await SilverRate.find({ 
        location: 'Andhra Pradesh',
        name: { $in: rateDefinitions.map(r => r.name) }
      }).select('name manualAdjustment');
      
      existingRates.forEach(rate => {
        adjustmentsMap[rate.name] = rate.manualAdjustment || 0;
      });
    } catch (adjError) {
      console.warn('Could not fetch manual adjustments from MongoDB, using defaults:', adjError.message);
    }

    let updatedCount = 0;
    // Use bulk write for faster MongoDB updates (more efficient than individual updates)
    const bulkOps = rateDefinitions.map((rateDef) => {
      let ratePerGram = baseRatePerGram;
      if (rateDef.purity === '92.5%') {
        ratePerGram = baseRatePerGram * 0.96;
      } else if (rateDef.purity === '99.99%') {
        ratePerGram = baseRatePerGram * 1.005;
      }

      // Get manual adjustment from MongoDB (not in-memory)
      const manualAdjustment = adjustmentsMap[rateDef.name] || 0;
      ratePerGram = ratePerGram + manualAdjustment;
      ratePerGram = Math.max(0, Math.round(ratePerGram * 100) / 100);

      let weightInGrams = rateDef.weight.value;
      if (rateDef.weight.unit === 'kg') {
        weightInGrams = rateDef.weight.value * 1000;
      }

      const totalRate = Math.round(ratePerGram * weightInGrams * 100) / 100;

      return {
        updateOne: {
          filter: { name: rateDef.name, location: 'Andhra Pradesh' },
          update: {
            $set: {
              name: rateDef.name,
              type: rateDef.type,
              weight: rateDef.weight,
              purity: rateDef.purity,
              ratePerGram: ratePerGram,
              rate: totalRate,
              lastUpdated: new Date(),
              location: 'Andhra Pradesh',
              unit: 'INR',
              manualAdjustment: manualAdjustment,
              source: liveRate.source || 'cron-update'
            }
          },
          upsert: true
        }
      };
    });
    
    // Execute bulk write (much faster than individual updates)
    try {
      console.log(`🔄 Executing bulk write for ${bulkOps.length} rates...`);
      const bulkResult = await SilverRate.bulkWrite(bulkOps, { 
        ordered: false,
        writeConcern: { w: 1 } // Ensure write is acknowledged
      });
      updatedCount = bulkResult.modifiedCount + bulkResult.upsertedCount;
      
      // ALWAYS log bulk update result (critical for debugging)
      console.log(`✅ MongoDB bulk update: ${updatedCount} rates updated (${bulkResult.modifiedCount} modified, ${bulkResult.upsertedCount} upserted) from base ₹${baseRatePerGram.toFixed(2)}/gram`);
      console.log(`📊 Bulk write details: matched=${bulkResult.matchedCount}, modified=${bulkResult.modifiedCount}, upserted=${bulkResult.upsertedCount}`);
      
      // Warn if not all rates were updated
      if (updatedCount < rateDefinitions.length) {
        console.warn(`⚠️ WARNING: Only ${updatedCount}/${rateDefinitions.length} rates were updated! Some rates may be stale.`);
      }
      
      // Verify write actually happened
      if (bulkResult.modifiedCount === 0 && bulkResult.upsertedCount === 0) {
        console.error('❌ CRITICAL: Bulk write returned 0 updates! MongoDB may not be saving changes.');
        console.error('   This could indicate: connection issue, write permission issue, or filter mismatch');
      }
      
      // Log first rate for verification
      if (rateDefinitions.length > 0) {
        const firstRate = rateDefinitions[0];
        let firstRatePerGram = baseRatePerGram;
        if (firstRate.purity === '92.5%') {
          firstRatePerGram = baseRatePerGram * 0.96;
        } else if (firstRate.purity === '99.99%') {
          firstRatePerGram = baseRatePerGram * 1.005;
        }
        const manualAdj = adjustmentsMap[firstRate.name] || 0;
        firstRatePerGram = firstRatePerGram + manualAdj;
        let weightInGrams = firstRate.weight.value;
        if (firstRate.weight.unit === 'kg') {
          weightInGrams = firstRate.weight.value * 1000;
        }
        const totalRate = Math.round(firstRatePerGram * weightInGrams * 100) / 100;
        console.log(`✅ Sample update: ${firstRate.name} = ₹${firstRatePerGram.toFixed(2)}/gram (₹${totalRate}/total) from base ₹${baseRatePerGram.toFixed(2)}/gram`);
      }
    } catch (bulkErr) {
      console.error('❌ Bulk update failed, falling back to individual updates:', bulkErr.message);
      // Fallback to individual updates if bulk write fails
      const updatePromises = rateDefinitions.map(async (rateDef) => {
        try {
          let ratePerGram = baseRatePerGram;
          if (rateDef.purity === '92.5%') {
            ratePerGram = baseRatePerGram * 0.96;
          } else if (rateDef.purity === '99.99%') {
            ratePerGram = baseRatePerGram * 1.005;
          }
          
          const manualAdjustment = adjustmentsMap[rateDef.name] || 0;
          ratePerGram = ratePerGram + manualAdjustment;
          ratePerGram = Math.max(0, Math.round(ratePerGram * 100) / 100);

          let weightInGrams = rateDef.weight.value;
          if (rateDef.weight.unit === 'kg') {
            weightInGrams = rateDef.weight.value * 1000;
          }

          const totalRate = Math.round(ratePerGram * weightInGrams * 100) / 100;

          const updateResult = await SilverRate.findOneAndUpdate(
            { name: rateDef.name, location: 'Andhra Pradesh' },
            {
              $set: {
                name: rateDef.name,
                type: rateDef.type,
                weight: rateDef.weight,
                purity: rateDef.purity,
                ratePerGram: ratePerGram,
                rate: totalRate,
                lastUpdated: new Date(),
                location: 'Andhra Pradesh',
                unit: 'INR',
                manualAdjustment: manualAdjustment,
                source: liveRate.source || 'cron-update'
              }
            },
            { upsert: true, new: true, runValidators: true }
          );
          
          if (!updateResult) {
            console.error(`❌ Failed to update ${rateDef.name}: findOneAndUpdate returned null`);
          } else {
            console.log(`✅ Updated ${rateDef.name}: ₹${ratePerGram.toFixed(2)}/gram`);
          }
          updatedCount++;
        } catch (err) {
          console.error(`❌ Failed to update ${rateDef.name}:`, err.message);
        }
      });
      await Promise.all(updatePromises);
    }
    
    const duration = Date.now() - startTime;
    
    // ALWAYS log completion (critical for debugging)
    console.log(`✅ Rate update COMPLETED: Updated ${updatedCount} rates in MongoDB`);
    console.log(`   Base Rate: ₹${baseRatePerGram.toFixed(2)}/gram (₹${baseRatePerKg}/kg)`);
    console.log(`   Source: ${liveRate.source}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    
    // ALWAYS verify rates were actually updated in MongoDB
    console.log(`🔍 Verifying MongoDB updates...`);
    const allRatesAfterUpdate = await SilverRate.find({ location: 'Andhra Pradesh' }).sort({ lastUpdated: -1 });
    
    if (allRatesAfterUpdate && allRatesAfterUpdate.length > 0) {
      const verifyRate = allRatesAfterUpdate[0];
      const verifyAge = Date.now() - new Date(verifyRate.lastUpdated).getTime();
      console.log(`✅ VERIFICATION: Found ${allRatesAfterUpdate.length} rates in MongoDB`);
      console.log(`✅ Latest rate "${verifyRate.name}" = ₹${verifyRate.ratePerGram}/gram (updated ${Math.round(verifyAge/1000)}s ago)`);
      
      // Check if any rates are still old (not updated)
      const oldRates = allRatesAfterUpdate.filter(rate => {
        const age = Date.now() - new Date(rate.lastUpdated).getTime();
        return age > 5000; // Older than 5 seconds
      });
      
      if (oldRates.length > 0) {
        console.warn(`⚠️ WARNING: ${oldRates.length} rates are still old (>5s): ${oldRates.map(r => r.name).join(', ')}`);
      }
      
      // Calculate expected rate for this specific rate type (accounting for purity adjustments)
      let expectedRatePerGram = baseRatePerGram;
      if (verifyRate.purity === '92.5%') {
        expectedRatePerGram = baseRatePerGram * 0.96;
      } else if (verifyRate.purity === '99.99%') {
        expectedRatePerGram = baseRatePerGram * 1.005;
      }
      // Fetch adjustment for verification rate
      const verifyAdjustments = await fetchManualAdjustments([verifyRate.name]);
      const manualAdj = verifyAdjustments[verifyRate.name] || 0;
      expectedRatePerGram = expectedRatePerGram + manualAdj;
      expectedRatePerGram = Math.round(expectedRatePerGram * 100) / 100;
      
      // Warn if verified rate doesn't match expected rate (with tolerance for rounding)
      const difference = Math.abs(verifyRate.ratePerGram - expectedRatePerGram);
      if (difference > 0.1) { // Allow 0.1 difference for rounding
        console.warn(`⚠️ WARNING: Verified rate "${verifyRate.name}" (₹${verifyRate.ratePerGram}/gram) doesn't match expected (₹${expectedRatePerGram.toFixed(2)}/gram, base: ₹${baseRatePerGram.toFixed(2)}/gram, diff: ₹${difference.toFixed(2)})!`);
      } else {
        console.log(`✅ VERIFICATION PASSED: Rate matches expected value (₹${verifyRate.ratePerGram}/gram = ₹${expectedRatePerGram.toFixed(2)}/gram)`);
      }
      
      // Verify all 10 rates exist and are recent
      if (allRatesAfterUpdate.length < 10) {
        console.warn(`⚠️ WARNING: Only ${allRatesAfterUpdate.length}/10 rates found in MongoDB!`);
      }
    } else {
      console.error('❌ VERIFICATION FAILED: No rates found in MongoDB after update!');
      console.error('   This indicates MongoDB write failed or connection issue');
    }
    
    // Only send response if res object is provided (not for background calls)
    if (res) {
      res.json({ 
        success: true,
        message: `Successfully updated ${updatedCount} rates`,
        baseRate: baseRatePerGram,
        baseRatePerKg: baseRatePerKg,
        ratePerKg: liveRate.ratePerKg,
        source: liveRate.source,
        updatedCount: updatedCount,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        rawData: {
          ask: liveRate.rawData?.ask || null,
          high: liveRate.rawData?.high || null,
          bid: liveRate.rawData?.bid || null
        }
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Rate update FAILED (${duration}ms):`, error.message);
    if (error.stack) {
      console.error(`❌ Error stack:`, error.stack.substring(0, 500));
    }
    if (res) {
      res.status(500).json({ 
        success: false,
        message: 'Rate update failed',
        error: error.message,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }
    // If no response object, error is already logged, just return
  }
};

// Support both POST and GET for manual triggering
router.post('/update', updateRatesHandler);
router.get('/update', updateRatesHandler);

// Initialize rates - loads from MongoDB
router.post('/initialize', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const lastRate = await SilverRate.findOne({ location: 'Andhra Pradesh' }).sort({ lastUpdated: -1 });
      if (lastRate && lastRate.ratePerGram) {
        cachedBaseRate = {
          ratePerGram: lastRate.ratePerGram,
          ratePerKg: lastRate.ratePerGram * 1000,
          source: 'mongodb',
          lastUpdated: lastRate.lastUpdated || new Date(),
          usdInrRate: 89.25
        };
        // Pre-populate rate history with MongoDB rate
        rateHistory = [{ rate: lastRate.ratePerGram, timestamp: Date.now() }];
        console.log(`✅ Loaded rate from MongoDB: ₹${lastRate.ratePerGram}/gram`);
      }
    }
    
    // Trigger update
    updateRatesFromEndpoints().catch(() => {});
    
    res.json({ 
      message: 'Rate system initialized.',
      currentRate: cachedBaseRate.ratePerGram,
      source: cachedBaseRate.source
    });
  } catch (error) {
    console.error('Initialize rates error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Adjust base rate (admin only) - for quick +/- adjustments
router.post('/adjust', auth, async (req, res) => {
  try {
    const { adjustment } = req.body; // e.g., +100 or -100 (in rupees per kg)
    
    if (typeof adjustment !== 'number') {
      return res.status(400).json({ message: 'Adjustment must be a number (rupees per kg)' });
    }
    
    const adjustmentPerGram = adjustment / 1000;
    const oldRate = cachedBaseRate.ratePerGram;
    const newRate = Math.max(0, oldRate + adjustmentPerGram);
    
    cachedBaseRate = {
      ...cachedBaseRate,
      ratePerGram: Math.round(newRate * 100) / 100,
      ratePerKg: Math.round(newRate * 1000),
      lastUpdated: new Date(),
      source: 'admin-adjusted'
    };
    
    // Update MongoDB with adjusted rate
    await updateMongoDBRates(cachedBaseRate);
    
    console.log(`🔧 Admin adjusted rate: ₹${oldRate.toFixed(2)} → ₹${cachedBaseRate.ratePerGram.toFixed(2)}/gram (${adjustment > 0 ? '+' : ''}${adjustment}/kg)`);
    
    res.json({
      message: 'Rate adjusted successfully',
      oldRate: oldRate,
      newRate: cachedBaseRate.ratePerGram,
      adjustment: adjustment
    });
  } catch (error) {
    console.error('Adjust rate error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current base rate from source (without adjustments) - for "Show As It Is" feature
router.get('/base-rate', async (req, res) => {
  try {
    // Fetch current live rate from RB Gold
    const { fetchSilverRatesFromMultipleSources } = require('../utils/multiSourceRateFetcher');
    const liveRate = await Promise.race([
      fetchSilverRatesFromMultipleSources(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000)
      )
    ]);

    if (!liveRate || !liveRate.ratePerGram || liveRate.ratePerGram <= 0) {
      // Fallback to cached rate
      return res.json({
        baseRatePerGram: cachedBaseRate.ratePerGram,
        baseRatePerKg: cachedBaseRate.ratePerKg,
        source: cachedBaseRate.source,
        lastUpdated: cachedBaseRate.lastUpdated
      });
    }

    res.json({
      baseRatePerGram: liveRate.ratePerGram,
      baseRatePerKg: liveRate.ratePerKg,
      source: liveRate.source || 'rbgoldspot',
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Error fetching base rate:', error.message);
    // Return cached rate as fallback
    res.json({
      baseRatePerGram: cachedBaseRate.ratePerGram,
      baseRatePerKg: cachedBaseRate.ratePerKg,
      source: cachedBaseRate.source,
      lastUpdated: cachedBaseRate.lastUpdated
    });
  }
});

module.exports = router;

// Manual adjustments are now stored in MongoDB (SilverRate.manualAdjustment field)
// No longer using in-memory storage - all adjustments persist to database
module.exports.updateRatesHandler = updateRatesHandler;
module.exports.updateRatesFromEndpoints = updateRatesFromEndpoints;
module.exports.getCachedBaseRate = () => cachedBaseRate;
module.exports.setCachedBaseRate = (rate) => { cachedBaseRate = rate; };
