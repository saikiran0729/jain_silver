const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const SilverRate = require('../models/SilverRate');
const Settings = require('../models/Settings');

// Helper function to fetch manual adjustments from MongoDB
const fetchManualAdjustments = async (rateNames) => {
  let adjustmentsMap = {};

  // CRITICAL FIX: Check connection state to avoid hanging if DB is down (causes 500/Timeout on Vercel)
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️ MongoDB not connected, skipping manual adjustments fetch (using defaults)');
      return adjustmentsMap; // Return empty map immediately
    }

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
    }
    // Both 99.9% and 99.99% use base rate as-is (no multiplier)

    // No rounding - keep exact value from RB Gold
    // ratePerGram stays as is

    let weightInGrams = rateDef.weight.value;
    if (rateDef.weight.unit === 'kg') {
      weightInGrams = rateDef.weight.value * 1000; // 1kg = 1000g
    }

    // CRITICAL: Calculate total rate exactly: ratePerGram × weightInGrams
    // For Silver Bar 1kg (99.99%): If ratePerGram = ₹208.5, then total = ₹208.5 × 1000 = ₹208,500
    const totalRate = ratePerGram * weightInGrams; // No rounding - keep exact value
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

// Helper function to check if user is admin from token
const isAdminUser = (req) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return false;
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jain_silver_secret_key_2024_change_in_production');
    return decoded.role === 'admin';
  } catch (error) {
    return false;
  }
};

// Helper function to ensure all defined products exist in rates array (for admin view)
// Also works when skipUpdate is true (admin dashboard requests)
const ensureAllProductsForAdmin = (rates, isAdmin, baseRatePerGram = null, skipUpdate = false) => {
  // Allow if admin OR skipUpdate (admin dashboard always uses skipUpdate)
  if ((!isAdmin && !skipUpdate) || !rates) return rates;

  const allRateDefinitions = [
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

  const existingNames = new Set();
  rates.forEach(r => {
    // Check both name and originalName to handle cases where displayName is set
    // In MongoDB, name is always the original name, but in API responses it might be displayName
    // Priority: originalName (if exists) > name
    const productName = r.originalName || r.name;
    if (productName) {
      existingNames.add(productName);
      // Also add the name field in case it's different
      if (r.name && r.name !== productName) {
        existingNames.add(r.name);
      }
    }
  });

  // Debug: log what products we found
  if ((isAdmin || skipUpdate) && existingNames.size > 0) {
    console.log(`🔍 ensureAllProductsForAdmin: Found ${existingNames.size} existing products:`, Array.from(existingNames).join(', '));
  }

  const missingProducts = allRateDefinitions.filter(def => !existingNames.has(def.name));

  // Debug: log missing products
  if ((isAdmin || skipUpdate) && missingProducts.length > 0) {
    console.log(`⚠️ ensureAllProductsForAdmin: Missing ${missingProducts.length} products:`, missingProducts.map(p => p.name).join(', '));
  }

  if (missingProducts.length > 0) {
    console.log(`⚠️ Missing products for admin view: ${missingProducts.map(p => p.name).join(', ')}`);
    console.log(`📋 All existing product names:`, Array.from(existingNames).join(', '));
    const ratesCopy = [...rates];

    missingProducts.forEach(def => {
      // Calculate rate if baseRatePerGram provided
      let ratePerGram = baseRatePerGram || 0;
      if (baseRatePerGram) {
        if (def.purity === '92.5%') {
          ratePerGram = baseRatePerGram * 0.96;
        }
        // Both 99.9% and 99.99% use base rate as-is (no multiplier)
        // No rounding - keep exact value
        // ratePerGram stays as is
      }

      let weightInGrams = def.weight.value;
      if (def.weight.unit === 'kg') {
        weightInGrams = def.weight.value * 1000;
      }
      const totalRate = ratePerGram * weightInGrams; // No rounding - keep exact value

      const newProduct = {
        _id: Buffer.from(def.name).toString('base64').substring(0, 24),
        name: def.name,
        type: def.type,
        weight: def.weight,
        purity: def.purity,
        ratePerGram: ratePerGram,
        rate: totalRate,
        manualAdjustment: 0,
        location: 'Andhra Pradesh',
        unit: 'INR',
        isVisible: true,
        displayName: null,
        originalName: def.name,
        lastUpdated: new Date()
      };
      ratesCopy.push(newProduct);
      console.log(`✅ Added missing product: ${def.name} (ratePerGram: ₹${ratePerGram.toFixed(2)}, total: ₹${totalRate.toFixed(2)})`);
    });

    return ratesCopy;
  }

  return rates;
};

// Helper function to apply manual adjustments to rates from MongoDB
// NOTE: Rates from MongoDB already have adjustments applied in ratePerGram
// This function just ensures the data structure is correct for the API response
const applyManualAdjustments = async (rates, isAdmin = false, skipUpdate = false) => {
  // Fetch current adjustments from MongoDB
  // Use originalName if available (for admin), otherwise use name
  // This ensures we fetch adjustments correctly even when displayName is set
  const rateNames = rates.map(r => r.originalName || r.name);
  const adjustmentsMap = await fetchManualAdjustments(rateNames);

  // Filter out invisible products for non-admin users
  // IMPORTANT: For admin OR skipUpdate (admin dashboard), include ALL products (including disabled ones)
  let filteredRates = rates;
  if (!isAdmin && !skipUpdate) {
    filteredRates = rates.filter(rate => rate.isVisible !== false); // Default to true if not set
    console.log(`🔒 applyManualAdjustments: Filtered ${rates.length} → ${filteredRates.length} products (non-admin)`);
  } else {
    // For admin, log disabled products for debugging
    const disabledProducts = rates.filter(rate => rate.isVisible === false);
    const enabledProducts = rates.filter(rate => rate.isVisible !== false);
    console.log(`👁️ applyManualAdjustments: Admin view - ${rates.length} total products (${enabledProducts.length} enabled, ${disabledProducts.length} disabled)`);
    if (disabledProducts.length > 0) {
      console.log(`👁️ Admin view: Including ${disabledProducts.length} disabled products:`,
        disabledProducts.map(p => p.name || p.originalName || 'unnamed').join(', '));
    }
  }

  return filteredRates.map(rate => {
    // Use originalName to fetch adjustment if available, otherwise use name
    const productName = rate.originalName || rate.name;
    const manualAdjustment = adjustmentsMap[productName] || rate.manualAdjustment || 0;

    // IMPORTANT: rate.ratePerGram in MongoDB already includes adjustments
    // So original = current - adjustment
    const currentRatePerGram = rate.ratePerGram || 0;
    const originalRatePerGram = currentRatePerGram - manualAdjustment;

    // Calculate original total rate
    let weightInGrams = rate.weight.value;
    if (rate.weight.unit === 'kg') {
      weightInGrams = rate.weight.value * 1000;
    }
    const originalTotalRate = originalRatePerGram * weightInGrams; // No rounding - keep exact value

    // Current rate (already has adjustments) is what customers see
    // Always recalculate from ratePerGram to ensure accuracy (don't rely on stored rate which might be stale)
    const adjustedRatePerGram = currentRatePerGram;
    const adjustedTotalRate = adjustedRatePerGram * weightInGrams; // No rounding - keep exact value

    // Use displayName if set, otherwise use name
    const displayName = rate.displayName || rate.name;
    // Preserve originalName if it exists (from ensureAllProductsForAdmin), otherwise use name
    const originalName = rate.originalName || rate.name;

    // CRITICAL: Preserve isVisible exactly as it is in MongoDB (false means disabled)
    // Do NOT default to true if it's explicitly false
    const isVisible = rate.isVisible !== undefined ? rate.isVisible : true;

    // Log disabled products for debugging
    if (isAdmin && !isVisible) {
      console.log(`🚫 applyManualAdjustments: Including disabled product: ${rate.name} (isVisible: ${isVisible})`);
    }

    return {
      ...rate,
      name: displayName, // Use displayName for the name field in response (what users see)
      originalName: originalName, // Keep original name for admin reference
      displayName: displayName, // Also include it as displayName
      isVisible: isVisible, // Preserve exact value from MongoDB
      ratePerGram: adjustedRatePerGram, // Current rate with adjustments (what customers see)
      rate: adjustedTotalRate,
      originalRatePerGram: Math.max(0, originalRatePerGram), // Original without adjustments
      originalRate: Math.max(0, originalTotalRate),
      manualAdjustment: manualAdjustment
    };
  });
};

// Cache for live base rate (updated on every request)
// This cache is updated frequently to ensure fresh rates
let cachedBaseRate = {
  ratePerGram: 290.0, // Default fallback rate (updated for current market rate ~₹290,000/kg)
  ratePerKg: 290000,
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
const MIN_UPDATE_INTERVAL = 500; // Update at most every 500ms for near real-time updates

// Rate smoothing: Update on ANY price change to reflect live market rates immediately
// Set to 0 to capture all price changes in real-time
const RATE_CHANGE_THRESHOLD = 0;

// Use exact rate from source (no smoothing) to reflect live market prices immediately
// This ensures rates update in real-time as market prices change
const calculateSmoothedRate = (newRate) => {
  // Return exact rate from source - no smoothing for live market updates
  // This ensures price changes are reflected immediately
  return Math.round(newRate * 100) / 100;
};

// Update rates from endpoints (non-blocking)
const updateRatesFromEndpoints = async () => {
  // On Vercel, we still allow updates but they should be called via the /update endpoint
  // This function can be called from the /rates endpoint when rates are stale
  // Skip only if we're in a cold start scenario to avoid timeouts
  if (process.env.VERCEL && process.env.VERCEL_ENV === 'production') {
    // On Vercel production, trigger update via internal call (non-blocking)
    // This ensures rates are updated even when cron hasn't run recently
    try {
      // Call update endpoint internally (fire and forget)
      const http = require('http');
      const url = require('url');
      const vercelUrl = process.env.VERCEL_URL || 'localhost:5000';
      const protocol = vercelUrl.includes('localhost') ? 'http' : 'https';
      const updateUrl = `${protocol}://${vercelUrl}/api/rates/update`;

      // Make non-blocking internal request
      http.get(updateUrl, () => { }).on('error', () => {
        // Silently fail - cron will handle updates
      });
    } catch (err) {
      // Silently fail - cron will handle updates
    }
    return; // Don't block the request
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

      // Log rate change
      const changeIndicator = liveRate.ratePerGram > oldRate ? '↑' : (liveRate.ratePerGram < oldRate ? '↓' : '≈');
      console.log(`📊 Live rate: ₹${liveRate.ratePerGram.toFixed(2)}/g (change: ₹${rateChange.toFixed(2)}) ${changeIndicator}`);

      // ALWAYS update on any price change to reflect live market rates immediately
      // Also update if cache is stale (older than 1 second for real-time updates)
      const cacheAge = Date.now() - cachedBaseRate.lastUpdated.getTime();
      const isStale = cacheAge > 1000; // Update every second for live rates
      const isInitial = (oldRate === 169.0 || oldRate === 207.0 || oldRate === 290.0) && cachedBaseRate.source === 'cache';

      // Update on ANY price change (threshold is 0) OR if stale OR initial
      // This ensures rates reflect market prices in real-time
      if (rateChange >= RATE_CHANGE_THRESHOLD || isStale || isInitial) {
        cachedBaseRate = {
          ratePerGram: liveRate.ratePerGram, // Use exact rate from source (no smoothing)
          ratePerKg: liveRate.ratePerKg, // Use exact rate from source
          source: liveRate.source || 'live',
          lastUpdated: new Date(),
          usdInrRate: liveRate.usdInrRate || 89.25
        };

        // Log updates with change indicator
        console.log(`✅ Rate updated: ₹${oldRate.toFixed(2)} → ₹${liveRate.ratePerGram.toFixed(2)}/gram ${changeIndicator}`);

        // Mark successful update
        lastSuccessfulUpdate = Date.now();

        // Update MongoDB with exact rate from source (no smoothing)
        try {
          await updateMongoDBRates(liveRate);
        } catch (mongoError) {
          console.error('❌ MongoDB update failed:', mongoError.message);
        }
      } else {
        // Rate unchanged - still update MongoDB if stale to ensure consistency
        if (isStale) {
          try {
            await updateMongoDBRates(liveRate);
          } catch (mongoError) {
            console.error('❌ MongoDB update failed:', mongoError.message);
          }
        }
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
        }
        // Both 99.9% and 99.99% use base rate as-is (no multiplier)

        const manualAdjustment = adjustmentsMap[rateDef.name] || 0;
        ratePerGram = ratePerGram + manualAdjustment;
        ratePerGram = Math.max(0, ratePerGram); // No rounding - keep exact value

        let weightInGrams = rateDef.weight.value;
        if (rateDef.weight.unit === 'kg') {
          weightInGrams = rateDef.weight.value * 1000; // 1kg = 1000g
        }

        // CRITICAL: Calculate total rate exactly: ratePerGram × weightInGrams
        // For Silver Bar 1kg (99.99%): If ratePerGram = ₹208.5, then total = ₹208.5 × 1000 = ₹208,500
        const totalRate = ratePerGram * weightInGrams; // No rounding - keep exact value

        await SilverRate.findOneAndUpdate(
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
              source: 'rbgoldspot'
            },
            $setOnInsert: {
              // Set defaults only when inserting new documents (not when updating existing)
              isVisible: true,
              displayName: null
            }
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
        baseRatePerGram: cachedBaseRate?.ratePerGram || 290,
        baseRatePerKg: cachedBaseRate?.ratePerKg || 290000,
        source: cachedBaseRate?.source || 'cache',
        lastUpdated: cachedBaseRate?.lastUpdated || new Date()
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
      baseRatePerGram: cachedBaseRate?.ratePerGram || 207,
      baseRatePerKg: cachedBaseRate?.ratePerKg || 207000,
      source: cachedBaseRate?.source || 'cache',
      lastUpdated: cachedBaseRate?.lastUpdated || new Date()
    });
  }
});

// Get all silver rates - First tries MongoDB, then live API
router.get('/', async (req, res) => {
  try {
    // Check for skipUpdate query parameter (for admin dashboard to avoid waiting for slow external updates)
    const skipUpdate = req.query.skipUpdate === 'true' || req.query.skipUpdate === true;

    // Check for explicit admin parameter (for admin dashboard)
    // This allows admin dashboard to see all products including disabled ones
    const adminParam = req.query.admin === 'true' || req.query.admin === true;

    // Check if user is admin from token
    const isAdminFromToken = isAdminUser(req);

    // Admin is true if: token says admin OR explicit admin parameter is set
    // CRITICAL: This determines whether disabled products (isVisible=false) are shown
    const isAdmin = isAdminFromToken || adminParam;

    // Log admin detection for debugging
    if (isAdmin) {
      console.log('👤 Admin user detected in /rates endpoint', isAdminFromToken ? '(from token)' : '(from admin parameter)');
      console.log('🔍 Admin detection details:', {
        isAdminFromToken,
        adminParam,
        adminParamRaw: req.query.admin,
        skipUpdate,
        finalIsAdmin: isAdmin,
        queryParams: req.query
      });
    } else {
      console.log('👤 Regular user (non-admin) accessing /rates endpoint');
      console.log('🔍 Non-admin details:', {
        isAdminFromToken,
        adminParam,
        adminParamRaw: req.query.admin,
        skipUpdate
      });
    }

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
    // First check query parameter (from frontend), then fall back to Settings
    let showAsItIs = false;
    const showAsItIsFromQuery = req.query.showAsItIs === 'true' || req.query.showAsItIs === true;

    if (showAsItIsFromQuery) {
      showAsItIs = true;
    } else {
      try {
        // Ensure Settings model is available
        if (Settings && typeof Settings.getSetting === 'function') {
          const showAsItIsSetting = await Settings.getSetting('showAsItIs');
          if (showAsItIsSetting && showAsItIsSetting.value !== undefined) {
            showAsItIs = showAsItIsSetting.value;
          }
        }
      } catch (settingsError) {
        console.warn('Could not fetch showAsItIs setting, defaulting to false:', settingsError.message);
        // Continue with default false value
      }
    }

    // Log showAsItIs state for debugging
    if (isAdmin || skipUpdate) {
      console.log(`👁️ "Show As It Is" state: ${showAsItIs} (from query: ${showAsItIsFromQuery}, final: ${showAsItIs})`);
    }

    // Declare mongoRates in outer scope to prevent ReferenceError if connection fails
    // This ensures fallback logic doesn't crash if it tries to access mongoRates
    let mongoRates = [];

    // ALWAYS try to get rates from MongoDB first (primary source)
    // In serverless, we need to ensure connection on each request
    try {
      const mongoose = require('mongoose');

      // Safety check: ensure mongoose is available
      if (!mongoose) {
        console.warn('⚠️ Mongoose not available, skipping MongoDB fetch');
        throw new Error('Mongoose not available');
      }

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
        // Fetch ALL products from MongoDB (including disabled ones) - no filter on isVisible
        // CRITICAL: Do NOT filter by isVisible here - admin needs to see all products
        let mongoRatesLocal;
        try {
          mongoRatesLocal = await SilverRate.find({ location: 'Andhra Pradesh' })
            .sort({ name: 1 })
            .lean();

          mongoRates = mongoRatesLocal; // Assign to outer scope variable

          // Ensure mongoRates is an array
          if (!Array.isArray(mongoRates)) {
            console.error('❌ MongoDB query returned non-array:', typeof mongoRates);
            mongoRates = [];
          }
        } catch (queryError) {
          console.error('❌ MongoDB query failed:', queryError.message);
          if (queryError.stack) {
            console.error('Query error stack:', queryError.stack.substring(0, 500));
          }
          // Set to empty array to continue with fallback
          mongoRates = [];
        }

        // Declare latestRate and mongoAge in broader scope so they're accessible later
        let latestRate = null;
        let mongoAge = 0;

        // Define thresholds at top level so they're accessible throughout the route handler
        const STALE_THRESHOLD = 500; // 500ms - trigger update if older than 0.5 seconds for near real-time
        const VERY_STALE_THRESHOLD = 2000; // 2 seconds - if very stale, wait for update before serving
        const OLD_RATE_THRESHOLD = 200; // If rate is below this, it's likely old cached data (updated for current rates ~₹290/gram)

        // Declare stale rate flags in broader scope
        let hasStaleRates = false;
        let hasStaleBaseRate = false;
        let hasOld99_9Rates = false;

        // Log for debugging - always log when skipUpdate is true (likely admin dashboard)
        if (skipUpdate || isAdmin) {
          const disabledCount = mongoRates.filter(r => r.isVisible === false).length;
          const enabledCount = mongoRates.filter(r => r.isVisible !== false).length;
          console.log(`📊 ${skipUpdate ? 'skipUpdate' : 'Admin'} view: Found ${mongoRates.length} total products (${enabledCount} enabled, ${disabledCount} disabled)`);

          // Log disabled products explicitly
          if (disabledCount > 0) {
            const disabledProducts = mongoRates.filter(r => r.isVisible === false);
            console.log(`🚫 DISABLED PRODUCTS FOUND:`, disabledProducts.map(r => `${r.name} (isVisible: ${r.isVisible})`).join(', '));
          }

          const productNames = mongoRates.map(r => `${r.name}${r.displayName ? ` (display: ${r.displayName})` : ''}${r.isVisible === false ? ' [DISABLED]' : ''}`);
          console.log(`📋 All products in MongoDB:`, productNames.join(', '));
        }

        // Ensure all defined products exist for admins OR when skipUpdate is true (admin dashboard)
        // This ensures admin dashboard always shows all products even if admin check fails
        if ((isAdmin || skipUpdate) && mongoRates) {
          const tempLatestRate = mongoRates.length > 0 ? mongoRates.reduce((latest, rate) => {
            return rate.lastUpdated > latest.lastUpdated ? rate : latest;
          }, mongoRates[0]) : null;
          // Use latest rate's ratePerGram to estimate base rate, or use cached
          let estimatedBaseRate = cachedBaseRate.ratePerGram;
          if (tempLatestRate && tempLatestRate.ratePerGram > 0) {
            // Reverse calculate base rate from latest rate
            if (tempLatestRate.purity === '92.5%') {
              estimatedBaseRate = tempLatestRate.ratePerGram / 0.96;
            } else if (tempLatestRate.purity === '99.99%') {
              estimatedBaseRate = tempLatestRate.ratePerGram; // 99.99% uses base rate as-is
            } else {
              estimatedBaseRate = tempLatestRate.ratePerGram;
            }
          }
          const ratesBeforeEnsure = mongoRates.length;
          mongoRates = ensureAllProductsForAdmin(mongoRates, isAdmin, estimatedBaseRate, skipUpdate);
          const ratesAfterEnsure = mongoRates.length;

          // Log after ensuring all products
          const disabledCountAfter = mongoRates.filter(r => r.isVisible === false).length;
          console.log(`📊 Admin view after ensureAllProducts: ${ratesBeforeEnsure} → ${ratesAfterEnsure} products (${disabledCountAfter} disabled)`);
          if (ratesAfterEnsure > ratesBeforeEnsure) {
            const addedProducts = mongoRates.slice(ratesBeforeEnsure).map(r => r.name || r.originalName);
            console.log(`✅ Added ${ratesAfterEnsure - ratesBeforeEnsure} missing products:`, addedProducts.join(', '));
          }
        }

        if (mongoRates && mongoRates.length > 0) {
          // Always use MongoDB rates if available (they're updated every second)
          latestRate = mongoRates.reduce((latest, rate) => {
            if (!rate || !rate.lastUpdated) return latest || rate;
            const rateTime = new Date(rate.lastUpdated).getTime();
            const latestTime = latest && latest.lastUpdated ? new Date(latest.lastUpdated).getTime() : 0;
            return rateTime > latestTime ? rate : latest;
          }, mongoRates[0]);

          if (!latestRate || !latestRate.lastUpdated) {
            throw new Error('Invalid rate data in MongoDB - missing lastUpdated');
          }

          mongoAge = Date.now() - new Date(latestRate.lastUpdated).getTime();
          // Thresholds are defined at top level above

          // Check if ANY 99.9% rate is old cached data (should be ~₹290, not below ₹200)
          hasOld99_9Rates = mongoRates.some(rate =>
            rate.purity === '99.9%' && rate.ratePerGram < OLD_RATE_THRESHOLD
          );

          // CRITICAL: Check if rates are significantly below current market rate (₹290/gram)
          // Lower threshold to ₹240 to catch rates like ₹235-236/gram
          // Check both 99.9% and 99.99% purity rates for staleness
          hasStaleRates = mongoRates.some(rate => {
            if (rate.purity === '99.9%' && rate.ratePerGram < 240) return true;
            if (rate.purity === '99.99%' && rate.ratePerGram < 240) return true;
            return false;
          });

          // Also check if base rate (from 99.9% rates) is significantly below expected
          // This catches cases where rates might be slightly above threshold but still old
          const baseRateFrom99_9 = mongoRates.find(r => r.purity === '99.9%')?.ratePerGram || 0;
          const baseRateFrom99_99 = mongoRates.find(r => r.purity === '99.99%')?.ratePerGram || 0;
          // 99.99% uses base rate as-is (no multiplier), so base = 99.99% rate directly
          const estimatedBaseFrom99_99 = baseRateFrom99_99 > 0 ? baseRateFrom99_99 : 0;
          const estimatedBase = Math.max(baseRateFrom99_9, estimatedBaseFrom99_99);
          // If estimated base rate is below ₹240, consider all rates stale
          hasStaleBaseRate = estimatedBase > 0 && estimatedBase < 240;

          // If skipUpdate is true, skip waiting for updates and return current rates immediately
          if (skipUpdate) {
            console.log('⏩ Skipping rate update (skipUpdate=true), returning current MongoDB rates immediately');
            if (isAdmin) {
              console.log(`📊 skipUpdate path: mongoRates has ${mongoRates.length} products`);
              const mongoProductNames = mongoRates.map(r => r.name || r.originalName || 'unnamed');
              console.log(`📋 skipUpdate path - MongoDB product names:`, mongoProductNames.join(', '));
            }
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
              // For "Show As It Is", merge with MongoDB visibility info
              // CRITICAL: For admin, start with ALL MongoDB products (including disabled), then merge calculated rates
              const calculatedOriginalRates = await getOriginalRates(baseRatePerGram);
              const calculatedRatesMap = new Map();
              calculatedOriginalRates.forEach(calcRate => {
                calculatedRatesMap.set(calcRate.name, calcRate);
              });

              let mergedRates = [];

              // For admin: Start with ALL MongoDB products (including disabled ones)
              // This ensures disabled products are always included
              if (isAdmin || skipUpdate) {
                console.log(`👁️ "Show As It Is" + Admin: Starting with ${mongoRates.length} MongoDB products`);

                mongoRates.forEach(mongoRate => {
                  const calculatedRate = calculatedRatesMap.get(mongoRate.name);

                  if (calculatedRate) {
                    // Product exists in both - use calculated rate but preserve MongoDB visibility and displayName
                    let weightInGrams = mongoRate.weight.value;
                    if (mongoRate.weight.unit === 'kg') {
                      weightInGrams = mongoRate.weight.value * 1000;
                    }

                    mergedRates.push({
                      ...calculatedRate,
                      isVisible: mongoRate.isVisible !== undefined ? mongoRate.isVisible : true,
                      displayName: mongoRate.displayName || null,
                      originalName: mongoRate.name,
                      // Preserve all MongoDB fields
                      _id: mongoRate._id,
                      weight: mongoRate.weight,
                      purity: mongoRate.purity,
                      type: mongoRate.type,
                      location: mongoRate.location
                    });

                    if (mongoRate.isVisible === false) {
                      console.log(`🚫 Including disabled product from MongoDB: ${mongoRate.name} (merged with calculated rate)`);
                    }
                  } else {
                    // Product exists in MongoDB but not in calculated rates - calculate rate and include it
                    let weightInGrams = mongoRate.weight.value;
                    if (mongoRate.weight.unit === 'kg') {
                      weightInGrams = mongoRate.weight.value * 1000;
                    }

                    // Calculate original rate for this product based on base rate and purity
                    let originalRatePerGram = baseRatePerGram;
                    if (mongoRate.purity === '92.5%') {
                      originalRatePerGram = baseRatePerGram * 0.96;
                    } else if (mongoRate.purity === '99.99%') {
                      originalRatePerGram = baseRatePerGram; // 99.99% uses base rate as-is
                    }
                    // 99.9% uses base rate as-is

                    const originalTotalRate = originalRatePerGram * weightInGrams; // No rounding - keep exact value

                    mergedRates.push({
                      ...mongoRate,
                      originalName: mongoRate.name,
                      name: mongoRate.displayName || mongoRate.name,
                      isVisible: mongoRate.isVisible !== undefined ? mongoRate.isVisible : true,
                      ratePerGram: originalRatePerGram,
                      rate: originalTotalRate,
                      // Preserve weight info
                      weight: mongoRate.weight || { value: 1, unit: 'kg' }
                    });

                    if (mongoRate.isVisible === false) {
                      console.log(`🚫 Including disabled product from MongoDB (not in calculated): ${mongoRate.name}`);
                    } else {
                      console.log(`✅ Added product from MongoDB (not in calculated): ${mongoRate.name}`);
                    }
                  }
                });

                // Log final count for admin
                const disabledCount = mergedRates.filter(r => r.isVisible === false).length;
                console.log(`👁️ "Show As It Is" + Admin: Showing ALL ${mergedRates.length} products (${disabledCount} disabled)`);
              } else {
                // For non-admin: Start with calculated rates and merge MongoDB visibility
                mergedRates = calculatedOriginalRates.map(calcRate => {
                  const mongoRate = mongoRates.find(r => r.name === calcRate.name);
                  return {
                    ...calcRate,
                    isVisible: mongoRate?.isVisible !== undefined ? mongoRate.isVisible : true,
                    displayName: mongoRate?.displayName || null,
                    originalName: calcRate.name
                  };
                });
              }

              // IMPORTANT: Only filter for non-admin users
              // Admin users (including those with admin=true parameter) should see ALL products
              if (!isAdmin) {
                mergedRates = mergedRates.filter(rate => rate.isVisible !== false);
                console.log(`🔒 Non-admin: Filtered to ${mergedRates.length} visible products`);
              } else {
                const disabledCount = mergedRates.filter(r => r.isVisible === false).length;
                console.log(`👁️ Admin view: Showing ALL ${mergedRates.length} products (${disabledCount} disabled)`);
              }
              // CRITICAL: Preserve isVisible when mapping - use spread to keep all fields
              finalRates = mergedRates.map(rate => {
                const result = {
                  ...rate,
                  name: rate.displayName || rate.name,
                  // Explicitly preserve isVisible
                  isVisible: rate.isVisible !== undefined ? rate.isVisible : true
                };
                // Log disabled products being included
                if (isAdmin && result.isVisible === false) {
                  console.log(`🚫 Final mapping: Including disabled product: ${result.name || result.originalName} (isVisible: ${result.isVisible})`);
                }
                return result;
              });
            } else {
              // Log before applying adjustments
              if (isAdmin || skipUpdate) {
                const disabledBefore = mongoRates.filter(r => r.isVisible === false).length;
                console.log(`📊 Before applyManualAdjustments: ${mongoRates.length} products (${disabledBefore} disabled)`);
                const productNames = mongoRates.map(r => `${r.name || r.originalName || 'unnamed'}${r.isVisible === false ? ' [DISABLED]' : ''}`);
                console.log(`📋 Product names:`, productNames.join(', '));
              }
              finalRates = await applyManualAdjustments(mongoRates, isAdmin, skipUpdate);
              // Log after applying adjustments
              if (isAdmin || skipUpdate) {
                const disabledAfter = finalRates.filter(r => r.isVisible === false).length;
                console.log(`📊 After applyManualAdjustments: ${finalRates.length} products (${disabledAfter} disabled)`);
                const finalProductNames = finalRates.map(r => `${r.name || r.originalName || 'unnamed'}${r.isVisible === false ? ' [DISABLED]' : ''}`);
                console.log(`📋 Final product names:`, finalProductNames.join(', '));

                // CRITICAL: Verify disabled products are in the response
                if (disabledAfter === 0 && disabledBefore > 0) {
                  console.error(`❌ ERROR: Disabled products were filtered out! Had ${disabledBefore} disabled, now have ${disabledAfter}`);
                }
              }
            }

            // CRITICAL: Filter out disabled products for non-admin users
            let filteredFinalRates = finalRates;
            if (!isAdmin && !skipUpdate) {
              filteredFinalRates = finalRates.filter(rate => rate.isVisible !== false);
              console.log(`🔒 skipUpdate=false: Filtered ${finalRates.length} → ${filteredFinalRates.length} products for non-admin`);
            }

            const ratesWithUSD = filteredFinalRates.map(rate => ({
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

        // If rates are very stale OR contain old 99.9% rates, trigger update
        // On Vercel, trigger non-blocking update. On other platforms, wait for update.
        if (mongoAge > VERY_STALE_THRESHOLD || hasOld99_9Rates) {
          if (process.env.VERCEL) {
            // On Vercel, trigger non-blocking update immediately
            const reason = hasOld99_9Rates
              ? `contains old 99.9% rates (below ₹100 detected, expected ~₹200-210)`
              : `very stale (${Math.round(mongoAge / 1000)}s old)`;
            console.log(`⚠️ Rates are ${reason}, triggering immediate update on Vercel...`);
            updateRatesHandler(req, null).catch(err => {
              console.error('❌ Immediate rate update failed:', err.message);
            });
            // Continue to serve current rates (they'll be updated in background)
          } else {
            const reason = hasOld99_9Rates
              ? `contains old 99.9% rates (below ₹100 detected, expected ~₹200-210)`
              : `very stale (${Math.round(mongoAge / 1000)}s old)`;
            console.log(`⚠️ Rates are ${reason}, fetching fresh rates before serving...`);
            try {
              await updateRatesHandler(req, null); // Wait for update
              // Fetch fresh rates after update
              let freshRates = await SilverRate.find({ location: 'Andhra Pradesh' })
                .sort({ name: 1 })
                .lean();

              // Ensure all defined products exist for admins
              if (isAdmin && freshRates) {
                const latestRate = freshRates.length > 0 ? freshRates.reduce((latest, rate) => {
                  return rate.lastUpdated > latest.lastUpdated ? rate : latest;
                }, freshRates[0]) : null;
                let estimatedBaseRate = cachedBaseRate.ratePerGram;
                if (latestRate && latestRate.ratePerGram > 0) {
                  if (latestRate.purity === '92.5%') {
                    estimatedBaseRate = latestRate.ratePerGram / 0.96;
                  } else if (latestRate.purity === '99.99%') {
                    estimatedBaseRate = latestRate.ratePerGram; // 99.99% uses base rate as-is
                  } else {
                    estimatedBaseRate = latestRate.ratePerGram;
                  }
                }
                freshRates = ensureAllProductsForAdmin(freshRates, isAdmin, estimatedBaseRate);
              }

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
                  let retryRates = await SilverRate.find({ location: 'Andhra Pradesh' })
                    .sort({ name: 1 })
                    .lean();

                  // Ensure all defined products exist for admins
                  if (isAdmin && retryRates) {
                    const latestRate = retryRates.length > 0 ? retryRates.reduce((latest, rate) => {
                      return rate.lastUpdated > latest.lastUpdated ? rate : latest;
                    }, retryRates[0]) : null;
                    let estimatedBaseRate = cachedBaseRate.ratePerGram;
                    if (latestRate && latestRate.ratePerGram > 0) {
                      if (latestRate.purity === '92.5%') {
                        estimatedBaseRate = latestRate.ratePerGram / 0.96;
                      } else if (latestRate.purity === '99.99%') {
                        estimatedBaseRate = latestRate.ratePerGram / 1.005;
                      } else {
                        estimatedBaseRate = latestRate.ratePerGram;
                      }
                    }
                    retryRates = ensureAllProductsForAdmin(retryRates, isAdmin, estimatedBaseRate);
                  }

                  if (retryRates && retryRates.length > 0) {
                    // For "Show As It Is", handle specially
                    let processedRates;
                    if (showAsItIs) {
                      let baseRatePerGram = cachedBaseRate.ratePerGram;
                      const calculatedOriginalRates = await getOriginalRates(baseRatePerGram);
                      const retryRatesMap = new Map();
                      retryRates.forEach(rate => {
                        retryRatesMap.set(rate.name, rate);
                      });
                      let mergedRates = calculatedOriginalRates.map(calcRate => {
                        const mongoRate = retryRatesMap.get(calcRate.name);
                        return {
                          ...calcRate,
                          isVisible: mongoRate?.isVisible !== undefined ? mongoRate.isVisible : true,
                          displayName: mongoRate?.displayName || null,
                          originalName: calcRate.name
                        };
                      });

                      // For admin users, ensure ALL MongoDB products are included (including disabled ones)
                      // This ensures disabled products still appear for admin even in "Show As It Is" mode
                      if (isAdmin) {
                        const calculatedNames = new Set(calculatedOriginalRates.map(r => r.name));
                        const mergedNames = new Set(mergedRates.map(r => r.originalName || r.name));

                        retryRates.forEach(mongoRate => {
                          // Include if not already in merged rates (by originalName or name)
                          const mongoName = mongoRate.name;
                          const isAlreadyIncluded = mergedNames.has(mongoName) ||
                            mergedRates.some(r => (r.originalName || r.name) === mongoName);

                          if (!isAlreadyIncluded) {
                            // Product exists in MongoDB but not in calculated rates - include it for admin
                            let weightInGrams = mongoRate.weight.value;
                            if (mongoRate.weight.unit === 'kg') {
                              weightInGrams = mongoRate.weight.value * 1000;
                            }

                            // Calculate original rate for this product based on base rate and purity
                            let originalRatePerGram = baseRatePerGram;
                            if (mongoRate.purity === '92.5%') {
                              originalRatePerGram = baseRatePerGram * 0.96;
                            } else if (mongoRate.purity === '99.99%') {
                              originalRatePerGram = baseRatePerGram * 1.005;
                            }
                            // 99.9% uses base rate as-is

                            const originalTotalRate = Math.round(originalRatePerGram * weightInGrams * 100) / 100;

                            mergedRates.push({
                              ...mongoRate,
                              originalName: mongoRate.name,
                              name: mongoRate.displayName || mongoRate.name,
                              isVisible: mongoRate.isVisible !== undefined ? mongoRate.isVisible : true,
                              ratePerGram: originalRatePerGram,
                              rate: originalTotalRate,
                              // Preserve weight info
                              weight: mongoRate.weight || { value: 1, unit: 'kg' }
                            });

                            console.log(`✅ Added disabled product to "Show As It Is" view (retry): ${mongoRate.name} (isVisible: ${mongoRate.isVisible})`);
                          }
                        });
                      }

                      // IMPORTANT: Only filter for non-admin users
                      if (!isAdmin) {
                        mergedRates = mergedRates.filter(rate => rate.isVisible !== false);
                        console.log(`🔒 Non-admin: Filtered to ${mergedRates.length} visible products`);
                      } else {
                        const disabledCount = mergedRates.filter(r => r.isVisible === false).length;
                        console.log(`👁️ Admin view: Showing ALL ${mergedRates.length} products (${disabledCount} disabled)`);
                      }
                      processedRates = mergedRates.map(rate => ({
                        ...rate,
                        name: rate.displayName || rate.name
                      }));
                    } else {
                      processedRates = await applyManualAdjustments(retryRates, isAdmin);
                    }
                    // CRITICAL: Filter out disabled products for non-admin users
                    let filteredProcessedRates = processedRates;
                    if (!isAdmin) {
                      filteredProcessedRates = processedRates.filter(rate => rate.isVisible !== false);
                      console.log(`🔒 Filtered ${processedRates.length} → ${filteredProcessedRates.length} products for non-admin`);
                    }

                    const ratesWithUSD = filteredProcessedRates.map(rate => ({
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
                  console.log(`✅ Fresh rates loaded: ${freshRates.length} rates (${Math.round(freshAge / 1000)}s old, latest: ${freshLatest.name} = ₹${freshLatest.ratePerGram}/gram)`);

                  // For "Show As It Is", handle specially
                  let processedRates;
                  if (showAsItIs) {
                    let baseRatePerGram = cachedBaseRate.ratePerGram;
                    const calculatedOriginalRates = await getOriginalRates(baseRatePerGram);
                    const freshRatesMap = new Map();
                    freshRates.forEach(rate => {
                      freshRatesMap.set(rate.name, rate);
                    });
                    let mergedRates = calculatedOriginalRates.map(calcRate => {
                      const mongoRate = freshRatesMap.get(calcRate.name);
                      return {
                        ...calcRate,
                        isVisible: mongoRate?.isVisible !== undefined ? mongoRate.isVisible : true,
                        displayName: mongoRate?.displayName || null,
                        originalName: calcRate.name
                      };
                    });
                    // IMPORTANT: Only filter for non-admin users
                    if (!isAdmin) {
                      mergedRates = mergedRates.filter(rate => rate.isVisible !== false);
                      console.log(`🔒 Non-admin: Filtered to ${mergedRates.length} visible products`);
                    } else {
                      const disabledCount = mergedRates.filter(r => r.isVisible === false).length;
                      console.log(`👁️ Admin view: Showing ALL ${mergedRates.length} products (${disabledCount} disabled)`);
                    }
                    processedRates = mergedRates.map(rate => ({
                      ...rate,
                      name: rate.displayName || rate.name
                    }));
                  } else {
                    processedRates = await applyManualAdjustments(freshRates, isAdmin);
                  }
                  // CRITICAL: Filter out disabled products for non-admin users
                  let filteredProcessedRates = processedRates;
                  if (!isAdmin) {
                    filteredProcessedRates = processedRates.filter(rate => rate.isVisible !== false);
                    console.log(`🔒 Filtered ${processedRates.length} → ${filteredProcessedRates.length} products for non-admin`);
                  }

                  const ratesWithUSD = filteredProcessedRates.map(rate => ({
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

          // If rates are stale (older than 1 second) OR if rates are below current market rate (₹250), trigger update.
          // Since mobile app polls every second, this ensures rates update every second.
          // On Vercel, always trigger non-blocking update (even with skipUpdate) to keep rates fresh
          // This ensures adjustedPrice = normalPrice (current market rate) + manualAdjustment updates every second
          // ALWAYS trigger update if rates are stale (even slightly stale) OR if rates are old (below ₹240) to ensure fresh data
          if (mongoAge > STALE_THRESHOLD || hasStaleRates || hasStaleBaseRate) {
            if (process.env.VERCEL) {
              // On Vercel, ALWAYS trigger non-blocking update when stale (even for admin/skipUpdate)
              // This ensures rates are constantly being updated in the background
              updateRatesHandler(req, null).catch(err => {
                // Only log errors occasionally to avoid spam
                if (Math.random() < 0.1) {
                  console.error('❌ Background rate update failed:', err.message);
                }
              });

              // CRITICAL: For customer requests (non-admin, non-skipUpdate), recalculate rates on-the-fly
              // This ensures customers always see current prices even if MongoDB hasn't updated yet
              if (!skipUpdate && !isAdmin && mongoRates && Array.isArray(mongoRates) && mongoRates.length > 0) {
                try {
                  // Get current base rate - ALWAYS fetch fresh for customer requests to ensure accuracy
                  let currentBaseRate = (cachedBaseRate && cachedBaseRate.ratePerGram) ? cachedBaseRate.ratePerGram : 290.0;
                  let fetchSuccess = false;
                  try {
                    const { fetchSilverRatesFromMultipleSources } = require('../utils/multiSourceRateFetcher');
                    // Use shorter timeout for faster response to customers
                    const liveRate = await Promise.race([
                      fetchSilverRatesFromMultipleSources(),
                      new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout after 2 seconds')), 2000)
                      )
                    ]);
                    if (liveRate && liveRate.ratePerGram && liveRate.ratePerGram > 0) {
                      currentBaseRate = liveRate.ratePerGram;
                      fetchSuccess = true;
                      // Update cache immediately
                      cachedBaseRate = {
                        ...cachedBaseRate,
                        ratePerGram: liveRate.ratePerGram,
                        ratePerKg: liveRate.ratePerKg,
                        lastUpdated: new Date(),
                        source: liveRate.source || 'live',
                        usdInrRate: liveRate.usdInrRate || cachedBaseRate.usdInrRate || 89.25
                      };
                    }
                  } catch (fetchError) {
                    // Use cached rate if fetch fails - still better than stale MongoDB data
                    const errorMsg = fetchError?.message || 'Unknown error';
                    if (cachedBaseRate && cachedBaseRate.ratePerGram > 0) {
                      console.log(`Using cached base rate ₹${cachedBaseRate.ratePerGram.toFixed(2)}/gram (fetch failed: ${errorMsg.substring(0, 50)})`);
                    } else {
                      console.warn('Could not fetch fresh base rate and no valid cache, using MongoDB rates:', errorMsg);
                      // Don't throw - just use MongoDB rates as-is
                      currentBaseRate = 290.0; // Fallback default (current market rate)
                    }
                  }

                  // Validate we have a valid base rate
                  if (!currentBaseRate || currentBaseRate <= 0 || isNaN(currentBaseRate)) {
                    console.warn('Invalid base rate for recalculation, using default');
                    currentBaseRate = 290.0; // Fallback default (current market rate)
                  }

                  // Fetch all manual adjustments at once (with error handling)
                  let adjustmentsMap = {};
                  try {
                    const rateNames = mongoRates.map(r => r.originalName || r.name).filter(Boolean);
                    if (rateNames.length > 0) {
                      adjustmentsMap = await fetchManualAdjustments(rateNames);
                    }
                  } catch (adjError) {
                    console.warn('Could not fetch manual adjustments, using defaults:', adjError?.message || 'Unknown error');
                    adjustmentsMap = {}; // Use empty map as fallback
                  }

                  // Recalculate rates on-the-fly from current base rate + manual adjustments
                  const recalculatedRates = mongoRates.map((rate) => {
                    // Validate rate object
                    if (!rate || typeof rate !== 'object') {
                      console.error('❌ Invalid rate object in recalculation:', rate);
                      return null;
                    }

                    // Get manual adjustment for this rate
                    const rateName = (rate.originalName || rate.name);
                    if (!rateName) {
                      console.error('❌ Rate missing name:', rate);
                      return null;
                    }
                    // If "Show As It Is" is enabled, ignore manual adjustments
                    const manualAdjustment = showAsItIs ? 0 : (adjustmentsMap[rateName] || (rate.manualAdjustment || 0));

                    // Calculate ratePerGram based on purity
                    let ratePerGram = currentBaseRate;
                    if (rate.purity === '92.5%') {
                      ratePerGram = currentBaseRate * 0.96;
                    } else if (rate.purity === '99.99%') {
                      ratePerGram = currentBaseRate; // 99.99% uses base rate as-is
                    }

                    // Apply manual adjustment
                    // Use Math.round to avoid floating point errors (1 rupee difference)
                    ratePerGram = ratePerGram + manualAdjustment;
                    ratePerGram = Math.round((ratePerGram + Number.EPSILON) * 100) / 100; // Precise rounding to 2 decimals
                    ratePerGram = Math.max(0, ratePerGram);

                    // Calculate total rate
                    let weightInGrams = (rate.weight && rate.weight.value) ? rate.weight.value : 1;
                    if (rate.weight && rate.weight.unit === 'kg') {
                      weightInGrams = rate.weight.value * 1000;
                    }
                    // Round the total rate as well to be safe
                    const totalRate = Math.round((ratePerGram * weightInGrams + Number.EPSILON) * 100) / 100;

                    return {
                      ...rate,
                      ratePerGram: ratePerGram,
                      rate: totalRate,
                      originalRatePerGram: ratePerGram - manualAdjustment,
                      originalRate: (ratePerGram - manualAdjustment) * weightInGrams,
                      manualAdjustment: manualAdjustment,
                      lastUpdated: new Date() // Mark as fresh
                    };
                  }).filter(rate => rate !== null); // Filter out any null rates

                  // Filter visible products for non-admin
                  const visibleRates = recalculatedRates.filter(rate => rate.isVisible !== false);

                  // Apply display names
                  const finalRates = visibleRates.map(rate => ({
                    ...rate,
                    name: rate.displayName || rate.name,
                    originalName: rate.originalName || rate.name
                  }));

                  const ratesWithUSD = finalRates.map(rate => ({
                    ...rate,
                    usdInrRate: cachedBaseRate.usdInrRate || 89.25
                  }));

                  if (!finalRates || finalRates.length === 0) {
                    console.warn('⚠️ No rates calculated from recalculation, falling back to MongoDB rates');
                    // Don't throw - fall through to serve MongoDB rates
                  } else if (!currentBaseRate || currentBaseRate <= 0 || isNaN(currentBaseRate)) {
                    console.warn(`⚠️ Invalid base rate: ${currentBaseRate}, falling back to MongoDB rates`);
                    // Don't throw - fall through to serve MongoDB rates
                  } else {
                    console.log(`✅ Recalculated ${finalRates.length} rates on-the-fly for customer (base: ₹${currentBaseRate.toFixed(2)}/gram, MongoDB was ${Math.round(mongoAge / 1000)}s old)`);

                    res.set({
                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                      'Pragma': 'no-cache',
                      'Expires': '0'
                    });
                    return res.json(ratesWithUSD);
                  }
                } catch (recalcError) {
                  console.error('❌ On-the-fly recalculation failed, serving MongoDB rates:', recalcError.message);
                  if (recalcError.stack) {
                    console.error('Recalculation error stack:', recalcError.stack.substring(0, 300));
                  }
                  // Fall through to serve MongoDB rates - don't throw, let it continue
                }
              }
              // Continue to serve current rates (they'll be updated in background)
            } else {
              console.log(`🔄 Rates are stale (${Math.round(mongoAge / 1000)}s old), fetching fresh rates...`);
              try {
                // Wait for update to complete (blocking) to ensure fresh rates
                console.log(`🔄 Rates are stale (${Math.round(mongoAge / 1000)}s old), fetching fresh rates...`);
                await updateRatesHandler(req, null);
                // Fetch fresh rates after update
                let freshRates = await SilverRate.find({ location: 'Andhra Pradesh' })
                  .sort({ name: 1 })
                  .lean();

                // Ensure all defined products exist for admins
                if (isAdmin && freshRates) {
                  const latestRate = freshRates.length > 0 ? freshRates.reduce((latest, rate) => {
                    return rate.lastUpdated > latest.lastUpdated ? rate : latest;
                  }, freshRates[0]) : null;
                  let estimatedBaseRate = cachedBaseRate.ratePerGram;
                  if (latestRate && latestRate.ratePerGram > 0) {
                    if (latestRate.purity === '92.5%') {
                      estimatedBaseRate = latestRate.ratePerGram / 0.96;
                    } else if (latestRate.purity === '99.99%') {
                      estimatedBaseRate = latestRate.ratePerGram; // 99.99% uses base rate as-is
                    } else {
                      estimatedBaseRate = latestRate.ratePerGram;
                    }
                  }
                  freshRates = ensureAllProductsForAdmin(freshRates, isAdmin, estimatedBaseRate);
                }

                if (freshRates && freshRates.length > 0) {
                  const freshLatest = freshRates.reduce((latest, rate) => {
                    return rate.lastUpdated > latest.lastUpdated ? rate : latest;
                  }, freshRates[0]);
                  const freshAge = Date.now() - new Date(freshLatest.lastUpdated).getTime();
                  console.log(`✅ Fresh rates fetched: ${freshRates.length} rates (${Math.round(freshAge / 1000)}s old, latest: ${freshLatest.name} = ₹${freshLatest.ratePerGram}/gram)`);

                  const ratesWithAdjustments = await applyManualAdjustments(freshRates, isAdmin);

                  // CRITICAL: Filter out disabled products for non-admin users
                  let filteredRatesWithAdjustments = ratesWithAdjustments;
                  if (!isAdmin) {
                    filteredRatesWithAdjustments = ratesWithAdjustments.filter(rate => rate.isVisible !== false);
                    console.log(`🔒 Filtered ${ratesWithAdjustments.length} → ${filteredRatesWithAdjustments.length} products for non-admin`);
                  }

                  const ratesWithUSD = filteredRatesWithAdjustments.map(rate => ({
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
              console.warn(`⚠️ Serving rates that are ${Math.round(mongoAge / 1000)}s old - updates may be failing!`);
            }

            // If rates are extremely stale (more than 1 hour), trigger immediate update
            const EXTREMELY_STALE_THRESHOLD = 3600000; // 1 hour in milliseconds
            if (mongoAge > EXTREMELY_STALE_THRESHOLD) {
              console.error(`🚨 CRITICAL: Rates are extremely stale (${Math.round(mongoAge / 3600000)} hours old)! Triggering immediate update...`);
              // Trigger update immediately (non-blocking on Vercel, blocking on other platforms)
              if (process.env.VERCEL) {
                updateRatesHandler(req, null).catch(err => {
                  console.error('❌ Critical rate update failed:', err.message);
                });
              } else {
                try {
                  await updateRatesHandler(req, null);
                  // Re-fetch rates after update
                  mongoRates = await SilverRate.find({ location: 'Andhra Pradesh' })
                    .sort({ name: 1 })
                    .lean();
                  if (isAdmin && mongoRates) {
                    const latestRate = mongoRates.length > 0 ? mongoRates.reduce((latest, rate) => {
                      return rate.lastUpdated > latest.lastUpdated ? rate : latest;
                    }, mongoRates[0]) : null;
                    let estimatedBaseRate = cachedBaseRate.ratePerGram;
                    if (latestRate && latestRate.ratePerGram > 0) {
                      if (latestRate.purity === '92.5%') {
                        estimatedBaseRate = latestRate.ratePerGram / 0.96;
                      } else if (latestRate.purity === '99.99%') {
                        estimatedBaseRate = latestRate.ratePerGram / 1.005;
                      } else {
                        estimatedBaseRate = latestRate.ratePerGram;
                      }
                    }
                    mongoRates = ensureAllProductsForAdmin(mongoRates, isAdmin, estimatedBaseRate);
                  }
                } catch (updateErr) {
                  console.error('❌ Critical update failed:', updateErr.message);
                }
              }
            }

            // Check if we're about to serve old 99.9% rates - if so, don't serve them
            const hasOld99_9InResponse = mongoRates.some(rate =>
              rate.purity === '99.9%' && rate.ratePerGram < OLD_RATE_THRESHOLD
            );

            // On Vercel, avoid blocking here as well – better to serve the latest
            // known values than to time out the client while waiting for an update.
            if (!process.env.VERCEL && hasOld99_9InResponse) {
              console.error(`❌ BLOCKED: Attempted to serve old 99.9% rates (below ₹100 detected). Fetching fresh rates...`);
              try {
                await updateRatesHandler(req, null);
                let freshRates = await SilverRate.find({ location: 'Andhra Pradesh' })
                  .sort({ name: 1 })
                  .lean();

                // Ensure all defined products exist for admins
                if (isAdmin && freshRates) {
                  const latestRate = freshRates.length > 0 ? freshRates.reduce((latest, rate) => {
                    return rate.lastUpdated > latest.lastUpdated ? rate : latest;
                  }, freshRates[0]) : null;
                  let estimatedBaseRate = cachedBaseRate.ratePerGram;
                  if (latestRate && latestRate.ratePerGram > 0) {
                    if (latestRate.purity === '92.5%') {
                      estimatedBaseRate = latestRate.ratePerGram / 0.96;
                    } else if (latestRate.purity === '99.99%') {
                      estimatedBaseRate = latestRate.ratePerGram; // 99.99% uses base rate as-is
                    } else {
                      estimatedBaseRate = latestRate.ratePerGram;
                    }
                  }
                  freshRates = ensureAllProductsForAdmin(freshRates, isAdmin, estimatedBaseRate);
                }

                if (freshRates && freshRates.length > 0) {
                  const ratesWithAdjustments = await applyManualAdjustments(freshRates, isAdmin);

                  // CRITICAL: Filter out disabled products for non-admin users
                  let filteredRatesWithAdjustments = ratesWithAdjustments;
                  if (!isAdmin) {
                    filteredRatesWithAdjustments = ratesWithAdjustments.filter(rate => rate.isVisible !== false);
                    console.log(`🔒 Filtered ${ratesWithAdjustments.length} → ${filteredRatesWithAdjustments.length} products for non-admin`);
                  }

                  const ratesWithUSD = filteredRatesWithAdjustments.map(rate => ({
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

            // Ensure latestRate and mongoAge are defined (might not be if coming from Vercel recalculation path)
            if ((!latestRate || mongoAge === undefined) && mongoRates && mongoRates.length > 0) {
              latestRate = mongoRates.reduce((latest, rate) => {
                if (!rate || !rate.lastUpdated) return latest || rate;
                const rateTime = new Date(rate.lastUpdated).getTime();
                const latestTime = latest && latest.lastUpdated ? new Date(latest.lastUpdated).getTime() : 0;
                return rateTime > latestTime ? rate : latest;
              }, mongoRates[0]);
              if (latestRate && latestRate.lastUpdated) {
                mongoAge = Date.now() - new Date(latestRate.lastUpdated).getTime();
              }
            }

            // Only log occasionally to avoid spam (every 10th request)
            if (Math.random() < 0.1 && latestRate && mongoRates) {
              console.log(`📦 Serving ${mongoRates.length} rates from MongoDB (${Math.round(mongoAge / 1000)}s old, latest: ${latestRate.name} = ₹${latestRate.ratePerGram}/gram)`);
            }

            // CRITICAL: If MongoDB rates are stale (below ₹240/gram), force recalculation with live rate
            // This ensures users always see current market rates (₹290/gram) instead of old cached rates
            // Check both hasStaleRates and hasStaleBaseRate to catch all stale cases
            if ((hasStaleRates || hasStaleBaseRate) && !skipUpdate && !isAdmin) {
              const staleReason = hasStaleRates ? 'rates below ₹240/gram' : 'base rate below ₹240/gram';
              console.log(`⚠️ MongoDB rates are stale (${staleReason}), forcing recalculation with live rate...`);
              try {
                const { fetchSilverRatesFromMultipleSources } = require('../utils/multiSourceRateFetcher');
                const liveRate = await Promise.race([
                  fetchSilverRatesFromMultipleSources(),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout after 3 seconds')), 3000)
                  )
                ]);
                if (liveRate && liveRate.ratePerGram && liveRate.ratePerGram > 0 && liveRate.ratePerGram >= 240) {
                  // Update cache with fresh rate
                  cachedBaseRate = {
                    ...cachedBaseRate,
                    ratePerGram: liveRate.ratePerGram,
                    ratePerKg: liveRate.ratePerKg,
                    lastUpdated: new Date(),
                    source: liveRate.source || 'live',
                    usdInrRate: liveRate.usdInrRate || cachedBaseRate.usdInrRate || 89.25
                  };
                  console.log(`✅ Updated cache with fresh rate: ₹${liveRate.ratePerGram.toFixed(2)}/gram (was using stale ₹${latestRate?.ratePerGram || 'N/A'}/gram)`);

                  // CRITICAL: Save updated rates to MongoDB so they persist for future requests
                  console.log('💾 Saving updated rates to MongoDB...');
                  await updateMongoDBRates(liveRate);
                  console.log('✅ Updated rates saved to MongoDB');

                  // Recalculate rates on-the-fly with fresh base rate
                  let currentBaseRate = liveRate.ratePerGram;
                  const rateNames = mongoRates.map(r => r.originalName || r.name).filter(Boolean);
                  const adjustmentsMap = await fetchManualAdjustments(rateNames);

                  const recalculatedRates = mongoRates.map((rate) => {
                    try {
                      if (!rate || typeof rate !== 'object') return null;
                      const rateName = (rate.originalName || rate.name);
                      if (!rateName) return null;
                      const manualAdjustment = adjustmentsMap[rateName] || (rate.manualAdjustment || 0) || 0;

                      let ratePerGram = currentBaseRate;
                      if (rate.purity === '92.5%') {
                        ratePerGram = currentBaseRate * 0.96;
                      } else if (rate.purity === '99.99%') {
                        ratePerGram = currentBaseRate * 1.005;
                      }
                      ratePerGram = ratePerGram + manualAdjustment;
                      ratePerGram = Math.max(0, ratePerGram);

                      let weightInGrams = (rate.weight && rate.weight.value) ? rate.weight.value : 1;
                      if (rate.weight && rate.weight.unit === 'kg') {
                        weightInGrams = rate.weight.value * 1000;
                      }
                      const totalRate = ratePerGram * weightInGrams;

                      return {
                        ...rate,
                        ratePerGram: ratePerGram,
                        rate: totalRate,
                        originalRatePerGram: ratePerGram - manualAdjustment,
                        originalRate: (ratePerGram - manualAdjustment) * weightInGrams,
                        manualAdjustment: manualAdjustment,
                        lastUpdated: new Date()
                      };
                    } catch (rateError) {
                      return null;
                    }
                  }).filter(rate => rate !== null);

                  const visibleRates = recalculatedRates.filter(rate => rate.isVisible !== false);
                  const finalRates = visibleRates.map(rate => ({
                    ...rate,
                    name: rate.displayName || rate.name,
                    originalName: rate.originalName || rate.name
                  }));
                  const ratesWithUSD = finalRates.map(rate => ({
                    ...rate,
                    usdInrRate: cachedBaseRate.usdInrRate || 89.25
                  }));

                  console.log(`✅ Recalculated ${finalRates.length} rates with fresh live rate: ₹${currentBaseRate.toFixed(2)}/gram`);
                  res.set({
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                  });
                  return res.json(ratesWithUSD);
                }
              } catch (staleRecalcError) {
                console.warn('⚠️ Failed to recalculate stale rates, continuing with MongoDB rates:', staleRecalcError.message);
              }
            }

            let finalRates;
            if (showAsItIs) {
              // If "Show As It Is" is enabled, return original rates without adjustments
              // But still need to filter by visibility for non-admin users
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

              // Get original rates from base rate, but merge with MongoDB data for visibility info
              // CRITICAL: For admin, start with ALL MongoDB products (including disabled), then merge calculated rates
              const calculatedOriginalRates = await getOriginalRates(baseRatePerGram);
              const calculatedRatesMap = new Map();
              calculatedOriginalRates.forEach(calcRate => {
                calculatedRatesMap.set(calcRate.name, calcRate);
              });

              let mergedRates = [];

              // For admin: Start with ALL MongoDB products (including disabled ones)
              if (isAdmin) {
                console.log(`👁️ "Show As It Is" + Admin (non-skipUpdate path): Starting with ${mongoRates.length} MongoDB products`);

                mongoRates.forEach(mongoRate => {
                  const calculatedRate = calculatedRatesMap.get(mongoRate.name);

                  if (calculatedRate) {
                    // Product exists in both - use calculated rate but preserve MongoDB visibility and displayName
                    mergedRates.push({
                      ...calculatedRate,
                      isVisible: mongoRate.isVisible !== undefined ? mongoRate.isVisible : true,
                      displayName: mongoRate.displayName || null,
                      originalName: mongoRate.name,
                      // Preserve all MongoDB fields
                      _id: mongoRate._id,
                      weight: mongoRate.weight,
                      purity: mongoRate.purity,
                      type: mongoRate.type,
                      location: mongoRate.location
                    });

                    if (mongoRate.isVisible === false) {
                      console.log(`🚫 Including disabled product from MongoDB: ${mongoRate.name} (merged with calculated rate)`);
                    }
                  } else {
                    // Product exists in MongoDB but not in calculated rates - calculate rate and include it
                    let weightInGrams = mongoRate.weight.value;
                    if (mongoRate.weight.unit === 'kg') {
                      weightInGrams = mongoRate.weight.value * 1000;
                    }

                    // Calculate original rate for this product based on base rate and purity
                    let originalRatePerGram = baseRatePerGram;
                    if (mongoRate.purity === '92.5%') {
                      originalRatePerGram = baseRatePerGram * 0.96;
                    } else if (mongoRate.purity === '99.99%') {
                      originalRatePerGram = baseRatePerGram; // 99.99% uses base rate as-is
                    }
                    // 99.9% uses base rate as-is

                    const originalTotalRate = Math.round(originalRatePerGram * weightInGrams * 100) / 100;

                    mergedRates.push({
                      ...mongoRate,
                      originalName: mongoRate.name,
                      name: mongoRate.displayName || mongoRate.name,
                      isVisible: mongoRate.isVisible !== undefined ? mongoRate.isVisible : true,
                      ratePerGram: originalRatePerGram,
                      rate: originalTotalRate,
                      weight: mongoRate.weight || { value: 1, unit: 'kg' }
                    });

                    if (mongoRate.isVisible === false) {
                      console.log(`🚫 Including disabled product from MongoDB (not in calculated): ${mongoRate.name}`);
                    }
                  }
                });
              } else {
                // For non-admin: Start with calculated rates and merge MongoDB visibility
                const mongoRatesMap = new Map();
                mongoRates.forEach(rate => {
                  mongoRatesMap.set(rate.name, rate);
                });

                mergedRates = calculatedOriginalRates.map(calcRate => {
                  const mongoRate = mongoRatesMap.get(calcRate.name);
                  return {
                    ...calcRate,
                    isVisible: mongoRate?.isVisible !== undefined ? mongoRate.isVisible : true,
                    displayName: mongoRate?.displayName || null,
                    originalName: calcRate.name
                  };
                });
              }

              // IMPORTANT: Only filter for non-admin users
              // Admin users (including those with admin=true parameter) should see ALL products
              if (!isAdmin) {
                mergedRates = mergedRates.filter(rate => rate.isVisible !== false);
                console.log(`🔒 Non-admin: Filtered to ${mergedRates.length} visible products`);
              } else {
                const disabledCount = mergedRates.filter(r => r.isVisible === false).length;
                console.log(`👁️ "Show As It Is" + Admin: Showing ALL ${mergedRates.length} products (${disabledCount} disabled)`);
              }

              // Apply displayName if set
              // CRITICAL: Preserve isVisible when mapping
              finalRates = mergedRates.map(rate => {
                const result = {
                  ...rate,
                  name: rate.displayName || rate.name,
                  // Explicitly preserve isVisible
                  isVisible: rate.isVisible !== undefined ? rate.isVisible : true
                };
                // Log disabled products being included
                if (isAdmin && result.isVisible === false) {
                  console.log(`🚫 Final mapping (non-skipUpdate): Including disabled product: ${result.name || result.originalName} (isVisible: ${result.isVisible})`);
                }
                return result;
              });

              console.log(`✅ "Show As It Is" enabled - returning original rates (base: ₹${baseRatePerGram.toFixed(2)}/gram)`);
            } else {
              // Apply manual adjustments to rates from MongoDB
              // This ensures admin adjustments are reflected immediately
              // CRITICAL: Pass skipUpdate to ensure disabled products are included
              if (!mongoRates || !Array.isArray(mongoRates) || mongoRates.length === 0) {
                console.error('❌ mongoRates is invalid before applyManualAdjustments:', { mongoRates, type: typeof mongoRates, isArray: Array.isArray(mongoRates) });
                throw new Error('Failed to process rates - mongoRates is invalid');
              }
              finalRates = await applyManualAdjustments(mongoRates, isAdmin, skipUpdate);
            }

            // Validate finalRates before proceeding
            if (!finalRates || !Array.isArray(finalRates) || finalRates.length === 0) {
              console.error('❌ finalRates is invalid:', { finalRates, type: typeof finalRates, isArray: Array.isArray(finalRates) });
              throw new Error('Failed to process rates - finalRates is invalid');
            }

            // CRITICAL: Filter out disabled products for non-admin users BEFORE adding USD rate
            // This ensures customers NEVER see disabled products, even if filtering was missed earlier
            let filteredFinalRates = finalRates;
            if (!isAdmin && !skipUpdate) {
              const beforeFilter = filteredFinalRates.length;
              filteredFinalRates = finalRates.filter(rate => {
                const isVisible = rate.isVisible !== undefined ? rate.isVisible : true;
                return isVisible !== false;
              });
              const afterFilter = filteredFinalRates.length;
              if (beforeFilter !== afterFilter) {
                console.log(`🔒 FINAL FILTER: Non-admin - Filtered ${beforeFilter} → ${afterFilter} products (removed ${beforeFilter - afterFilter} disabled)`);
              }
            }

            // Add USD rate to all rates if available
            // CRITICAL: Preserve isVisible field when mapping
            const ratesWithUSD = filteredFinalRates.map(rate => ({
              ...rate,
              usdInrRate: cachedBaseRate.usdInrRate || 89.25,
              // Explicitly preserve isVisible to ensure it's not lost
              isVisible: rate.isVisible !== undefined ? rate.isVisible : true
            }));

            // Log final response for admin
            if (isAdmin || skipUpdate) {
              const disabledInResponse = ratesWithUSD.filter(r => r.isVisible === false).length;
              console.log(`📤 skipUpdate response: Returning ${ratesWithUSD.length} rates to admin (${disabledInResponse} disabled)`);
              const responseProductNames = ratesWithUSD.map(r => `${r.name || r.originalName || 'unnamed'}${r.isVisible === false ? ' [DISABLED]' : ''}`);
              console.log(`📋 skipUpdate response product names:`, responseProductNames.join(', '));

              // CRITICAL: Verify disabled products are in response
              if (disabledInResponse === 0) {
                console.warn(`⚠️ WARNING: No disabled products in response! Check if they were filtered out.`);
              }
            } else {
              // Log for non-admin to verify no disabled products
              const disabledInResponse = ratesWithUSD.filter(r => r.isVisible === false).length;
              if (disabledInResponse > 0) {
                console.error(`❌ ERROR: Non-admin response contains ${disabledInResponse} disabled products! This should never happen.`);
              } else {
                console.log(`🔒 FINAL RESPONSE: Non-admin - Returning ${ratesWithUSD.length} visible products only (no disabled products)`);
              }
            }

            // Set headers to prevent caching
            res.set({
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            });

            // Final verification before sending response
            if (isAdmin || skipUpdate) {
              const finalDisabledCount = ratesWithUSD.filter(r => r.isVisible === false).length;
              console.log(`📤 FINAL RESPONSE: Sending ${ratesWithUSD.length} rates (${finalDisabledCount} disabled)`);
              if (finalDisabledCount > 0) {
                const disabledInFinal = ratesWithUSD.filter(r => r.isVisible === false);
                console.log(`🚫 FINAL RESPONSE - Disabled products:`, disabledInFinal.map(r => `${r.name || r.originalName} (isVisible: ${r.isVisible})`).join(', '));
              } else {
                console.warn(`⚠️ FINAL RESPONSE WARNING: No disabled products in final response!`);
              }
            }

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
      if (Settings && typeof Settings.getSetting === 'function') {
        const showAsItIsSetting = await Settings.getSetting('showAsItIs');
        if (showAsItIsSetting && showAsItIsSetting.value !== undefined) {
          showAsItIs = showAsItIsSetting.value;
        }
      }
    } catch (settingsError) {
      console.warn('Could not fetch showAsItIs setting in fallback, using previous value:', settingsError.message);
      // Keep existing showAsItIs value from top of function
    }

    let allRates;
    if (showAsItIs) {
      // If "Show As It Is" is enabled, return original rates without adjustments
      // But still filter by visibility for non-admin users
      const calculatedOriginalRates = await getOriginalRates(baseRatePerGram);

      // In fallback mode, we don't have MongoDB rates, so we can't filter by visibility
      // Default all to visible, but this is fallback only
      // CRITICAL: Try to get visibility from MongoDB even in fallback mode
      let visibilityMap = {};
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
          const mongoRatesForVisibility = await SilverRate.find({ location: 'Andhra Pradesh' })
            .select('name isVisible')
            .lean();
          mongoRatesForVisibility.forEach(rate => {
            visibilityMap[rate.name] = rate.isVisible !== undefined ? rate.isVisible : true;
          });
        }
      } catch (visError) {
        console.warn('Could not fetch visibility in fallback:', visError.message);
      }

      allRates = calculatedOriginalRates.map(rate => ({
        ...rate,
        isVisible: visibilityMap[rate.name] !== undefined ? visibilityMap[rate.name] : true, // Use MongoDB visibility if available
        displayName: null,
        originalName: rate.name
      }));

      // For non-admin users, filter by visibility even in fallback mode
      if (!isAdmin) {
        allRates = allRates.filter(rate => rate.isVisible !== false);
        console.log(`🔒 Fallback mode: Filtered to ${allRates.length} visible products for non-admin`);
      }

      console.log(`✅ "Show As It Is" enabled - returning original rates from cache (base: ₹${baseRatePerGram.toFixed(2)}/gram)`);
    } else {
      // Fetch manual adjustments from MongoDB
      const adjustmentsMap = await fetchManualAdjustments(rateDefinitions.map(r => r.name));

      allRates = rateDefinitions.map(rateDef => {
        let ratePerGram = baseRatePerGram;
        if (rateDef.purity === '92.5%') {
          ratePerGram = baseRatePerGram * 0.96;
        }
        // Both 99.9% and 99.99% use base rate as-is (no multiplier)

        const manualAdjustment = adjustmentsMap[rateDef.name] || 0;
        ratePerGram = ratePerGram + manualAdjustment;
        ratePerGram = Math.max(0, ratePerGram); // No rounding - keep exact value

        let weightInGrams = rateDef.weight.value;
        if (rateDef.weight.unit === 'kg') {
          weightInGrams = rateDef.weight.value * 1000; // 1kg = 1000g
        }

        // CRITICAL: Calculate total rate exactly: ratePerGram × weightInGrams
        // For Silver Bar 1kg (99.99%): If ratePerGram = ₹208.5, then total = ₹208.5 × 1000 = ₹208,500
        const totalRate = ratePerGram * weightInGrams; // No rounding - keep exact value
        const id = Buffer.from(rateDef.name).toString('base64').substring(0, 24);

        // Store original rate before adjustment
        const originalRatePerGram = ratePerGram - manualAdjustment;
        let originalWeightInGrams = rateDef.weight.value;
        if (rateDef.weight.unit === 'kg') {
          originalWeightInGrams = rateDef.weight.value * 1000;
        }
        const originalTotalRate = originalRatePerGram * originalWeightInGrams; // No rounding - keep exact value

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

    // CRITICAL: Filter out disabled products for non-admin users
    let filteredAllRates = allRates;
    if (!isAdmin) {
      filteredAllRates = allRates.filter(rate => rate.isVisible !== false);
      console.log(`🔒 Cache fallback: Filtered ${allRates.length} → ${filteredAllRates.length} products for non-admin`);
    }

    console.log(`📦 Serving ${filteredAllRates.length} rates from cache (base: ₹${baseRatePerGram.toFixed(2)}/gram)`);

    // Set headers to prevent caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    return res.json(filteredAllRates);

  } catch (error) {
    const errorMsg = error?.message || 'Unknown error';
    console.error('❌ Get rates error:', errorMsg);
    if (error.stack) {
      console.error('Error stack:', error.stack.substring(0, 500));
    }

    // Ensure we haven't already sent a response
    if (res.headersSent) {
      console.error('❌ Response already sent, cannot send error response');
      return;
    }

    // Return a more detailed error in development, generic in production
    // Ensure error message is safe for JSON (no special characters that break parsing)
    const safeErrorMsg = String(errorMsg).replace(/[^\x20-\x7E]/g, ''); // Remove non-printable characters
    const errorDetails = process.env.NODE_ENV === 'development'
      ? { error: 'Failed to fetch rates', message: safeErrorMsg, stack: (error.stack?.substring(0, 500) || '').replace(/[^\x20-\x7E]/g, '') }
      : { error: 'Failed to fetch rates', message: 'An error occurred while fetching rates. Please try again.' };

    try {
      return res.status(500).json(errorDetails);
    } catch (jsonError) {
      // If JSON.stringify fails, send a simple text response
      console.error('❌ Failed to send JSON error response:', jsonError.message);
      return res.status(500).send('Internal Server Error');
    }
  }
});

// Update silver rate (admin only) - Now saves to MongoDB
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rate, manualAdjustment } = req.body;

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

    const rateDef = rateDefinitions.find(r => {
      const rateId = Buffer.from(r.name).toString('base64').substring(0, 24);
      return rateId === id;
    });

    if (!rateDef) {
      return res.status(404).json({ message: 'Rate not found' });
    }

    // Get current base rate (from cache or fetch fresh)
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
      console.warn('Could not fetch fresh base rate for manual adjustment update, using cached:', fetchError.message);
    }

    // Calculate ratePerGram based on purity
    let calculatedRatePerGram = baseRatePerGram;
    if (rateDef.purity === '92.5%') {
      calculatedRatePerGram = baseRatePerGram * 0.96;
    } else if (rateDef.purity === '99.99%') {
      calculatedRatePerGram = baseRatePerGram; // 99.99% uses base rate as-is
    }

    // Apply manual adjustment if provided
    const finalManualAdjustment = manualAdjustment !== undefined ? manualAdjustment : 0;
    calculatedRatePerGram = calculatedRatePerGram + finalManualAdjustment;
    calculatedRatePerGram = Math.max(0, calculatedRatePerGram);

    // Calculate total rate
    let weightInGrams = rateDef.weight.value;
    if (rateDef.weight.unit === 'kg') {
      weightInGrams = rateDef.weight.value * 1000;
    }
    const totalRate = calculatedRatePerGram * weightInGrams;

    // Update MongoDB with manual adjustment AND recalculated rates
    const updateData = {
      name: rateDef.name,
      type: rateDef.type,
      weight: rateDef.weight,
      purity: rateDef.purity,
      ratePerGram: calculatedRatePerGram,
      rate: totalRate,
      manualAdjustment: finalManualAdjustment,
      lastUpdated: new Date(),
      location: 'Andhra Pradesh',
      unit: 'INR'
    };

    if (manualAdjustment !== undefined) {
      await SilverRate.findOneAndUpdate(
        { name: rateDef.name, location: 'Andhra Pradesh' },
        {
          $set: updateData
        },
        { upsert: true, new: true }
      );

      console.log(`✅ Updated ${rateDef.name}: ratePerGram=₹${calculatedRatePerGram.toFixed(2)}, total=₹${totalRate.toFixed(2)}, manualAdjustment=₹${finalManualAdjustment.toFixed(2)}`);
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
        ratePerGram: updatedRate?.ratePerGram || calculatedRatePerGram,
        rate: updatedRate?.rate || totalRate,
        manualAdjustment: updatedRate?.manualAdjustment || finalManualAdjustment
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
    // ALWAYS log for cron jobs and manual triggers (critical for debugging)
    console.log('🔄 Updating rates from live source...');
    console.log(`📅 Update triggered at: ${new Date().toISOString()}`);

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

    // CRITICAL: Update cached base rate immediately so on-the-fly recalculation uses fresh data
    cachedBaseRate = {
      ratePerGram: liveRate.ratePerGram,
      ratePerKg: liveRate.ratePerKg,
      source: liveRate.source || 'live',
      lastUpdated: new Date(),
      usdInrRate: liveRate.usdInrRate || cachedBaseRate.usdInrRate || 89.25
    };
    lastSuccessfulUpdate = Date.now();

    // Warn if rate seems too low (might be old/cached)
    // Updated threshold: current rates are ~207 per gram, so flag anything below 100 as suspicious
    if (liveRate.ratePerGram < 100) {
      console.warn(`⚠️ WARNING: Fetched rate (₹${liveRate.ratePerGram.toFixed(2)}/gram) seems unusually low. Expected ~₹200-210/gram. Check source!`);
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

    // Get or set baseSilverPrice using SilverPriceTracker collection
    const SilverPriceTracker = require('../models/SilverPriceTracker');
    let baseSilverPrice = null;
    try {
      baseSilverPrice = await SilverPriceTracker.getOrCreateBasePrice('Andhra Pradesh');
    } catch (err) {
      console.warn('Could not fetch baseSilverPrice from tracker:', err.message);
    }

    if (baseSilverPrice === null) {
      // Set baseSilverPrice to current baseRatePerGram (stored once only)
      try {
        await SilverPriceTracker.setBasePriceIfNotExists(baseRatePerGram, 'Andhra Pradesh');
        baseSilverPrice = baseRatePerGram;
        console.log(`🔧 Set baseSilverPrice to ₹${baseSilverPrice.toFixed(2)}/gram`);
      } catch (err) {
        console.error('Could not set baseSilverPrice:', err.message);
        baseSilverPrice = baseRatePerGram; // Use current rate as fallback
      }
    }

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

    // Fetch existing rates from MongoDB to get normalPrice and manualAdjustment
    let existingRatesMap = {};
    try {
      const existingRates = await SilverRate.find({
        location: 'Andhra Pradesh',
        name: { $in: rateDefinitions.map(r => r.name) }
      });

      existingRates.forEach(rate => {
        existingRatesMap[rate.name] = {
          normalPrice: rate.normalPrice,
          manualAdjustment: rate.manualAdjustment || 0
        };
      });
    } catch (fetchError) {
      console.warn('Could not fetch existing rates from MongoDB, using defaults:', fetchError.message);
    }

    let updatedCount = 0;
    // Use bulk write for faster MongoDB updates (more efficient than individual updates)
    const bulkOps = rateDefinitions.map((rateDef) => {
      // Calculate rate per gram based on purity
      let ratePerGramForPurity = baseRatePerGram;
      if (rateDef.purity === '92.5%') {
        ratePerGramForPurity = baseRatePerGram * 0.96;
      } else if (rateDef.purity === '99.99%') {
        ratePerGramForPurity = baseRatePerGram; // 99.99% uses base rate as-is
      }

      // Get existing rate data (normalPrice and manualAdjustment)
      const existingRate = existingRatesMap[rateDef.name] || {};
      const manualAdjustment = existingRate.manualAdjustment || 0;

      // CRITICAL: normalPrice should ALWAYS be the current market rate (updates every second)
      // This ensures that when normalPrice increases/decreases, adjustedPrice also increases/decreases accordingly
      // Set normalPrice to current market rate for this purity level
      let normalPrice = ratePerGramForPurity;

      // If this is the first time (normalPrice doesn't exist), use current rate
      // Otherwise, always update normalPrice to current market rate
      if (existingRate.normalPrice === null || existingRate.normalPrice === undefined) {
        normalPrice = rateDef.name.includes('236') ? 236 : ratePerGramForPurity;
      } else {
        // Always update normalPrice to current market rate
        normalPrice = ratePerGramForPurity;
      }

      // CRITICAL: Calculate adjustedPrice = normalPrice (current market rate) + manualAdjustment
      // When normalPrice increases by ₹1, adjustedPrice also increases by ₹1 (keeping manualAdjustment constant)
      const adjustedPrice = normalPrice + manualAdjustment;
      const ratePerGram = Math.max(0, adjustedPrice); // Ensure non-negative

      // Log adjustment application for first rate (to verify adjustments are being applied)
      if (rateDef.name === rateDefinitions[0]?.name) {
        console.log(`💰 updateRatesHandler: Normal ₹${normalPrice.toFixed(2)}/gram (current market rate) + Manual ₹${manualAdjustment.toFixed(2)}/gram = Adjusted ₹${adjustedPrice.toFixed(2)}/gram`);
      }

      let weightInGrams = rateDef.weight.value;
      if (rateDef.weight.unit === 'kg') {
        weightInGrams = rateDef.weight.value * 1000; // 1kg = 1000g
      }

      // CRITICAL: Calculate total rate exactly: ratePerGram × weightInGrams
      // For Silver Bar 1kg (99.99%): If ratePerGram = ₹208.5, then total = ₹208.5 × 1000 = ₹208,500
      const totalRate = ratePerGram * weightInGrams; // No rounding - keep exact value

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
              normalPrice: normalPrice,
              adjustedPrice: adjustedPrice,
              lastUpdated: new Date(),
              location: 'Andhra Pradesh',
              unit: 'INR',
              manualAdjustment: manualAdjustment,
              source: liveRate.source || 'cron-update'
            },
            $setOnInsert: {
              // Set defaults only when inserting new documents (not when updating existing)
              isVisible: true,
              displayName: null
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
        console.error('   Attempting individual updates as fallback...');
        // Fall through to individual update fallback
        throw new Error('Bulk write failed - no documents updated');
      }

      // Log first rate for verification
      if (rateDefinitions.length > 0) {
        const firstRate = rateDefinitions[0];
        const existingFirstRate = existingRatesMap[firstRate.name] || {};
        // Use current market rate as normalPrice (updates every second)
        let firstRatePerGramForPurity = baseRatePerGram;
        if (firstRate.purity === '92.5%') {
          firstRatePerGramForPurity = baseRatePerGram * 0.96;
        } else if (firstRate.purity === '99.99%') {
          firstRatePerGramForPurity = baseRatePerGram * 1.005;
        }
        const firstNormalPrice = firstRatePerGramForPurity; // Current market rate
        const firstManualAdj = existingFirstRate.manualAdjustment || 0;
        const firstAdjustedPrice = firstNormalPrice + firstManualAdj;
        let weightInGrams = firstRate.weight.value;
        if (firstRate.weight.unit === 'kg') {
          weightInGrams = firstRate.weight.value * 1000;
        }
        const totalRate = firstAdjustedPrice * weightInGrams;
        console.log(`✅ Sample update: ${firstRate.name} = ₹${firstAdjustedPrice.toFixed(2)}/gram (₹${totalRate.toFixed(2)}/total, normal: ₹${firstNormalPrice.toFixed(2)}, manual: ₹${firstManualAdj.toFixed(2)})`);
      }
    } catch (bulkErr) {
      console.error('❌ Bulk update failed, falling back to individual updates:', bulkErr.message);
      // Fallback to individual updates if bulk write fails
      const updatePromises = rateDefinitions.map(async (rateDef) => {
        try {
          // Calculate rate per gram based on purity
          let ratePerGramForPurity = baseRatePerGram;
          if (rateDef.purity === '92.5%') {
            ratePerGramForPurity = baseRatePerGram * 0.96;
          } else if (rateDef.purity === '99.99%') {
            ratePerGramForPurity = baseRatePerGram * 1.005;
          }

          // Get existing rate data
          const existingRate = existingRatesMap[rateDef.name] || {};
          const manualAdjustment = existingRate.manualAdjustment || 0;

          // CRITICAL: normalPrice = current market rate (updates every second)
          const normalPrice = rateDef.name.includes('236') ? 236 : ratePerGramForPurity;

          // CRITICAL: adjustedPrice = normalPrice + manualAdjustment
          let ratePerGram = normalPrice + manualAdjustment;
          ratePerGram = Math.max(0, ratePerGram); // No rounding - keep exact value

          let weightInGrams = rateDef.weight.value;
          if (rateDef.weight.unit === 'kg') {
            weightInGrams = rateDef.weight.value * 1000;
          }

          const totalRate = ratePerGram * weightInGrams; // No rounding - keep exact value

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
                normalPrice: normalPrice,
                adjustedPrice: ratePerGram,
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
      console.log(`✅ Latest rate "${verifyRate.name}" = ₹${verifyRate.ratePerGram}/gram (updated ${Math.round(verifyAge / 1000)}s ago)`);

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
        expectedRatePerGram = baseRatePerGram; // 99.99% uses base rate as-is
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

    // ALWAYS send response (even for cron) so we can see if updates are working
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
    } else {
      // For cron jobs, log success even without response object
      console.log(`✅ Cron update completed: ${updatedCount} rates updated in ${duration}ms`);
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
    updateRatesFromEndpoints().catch(() => { });

    res.json({
      message: 'Rate system initialized.',
      currentRate: cachedBaseRate.ratePerGram,
      source: cachedBaseRate.source
    });
  } catch (fatalError) {
    console.error('❌ FATAL ERROR in rates endpoint:', fatalError);
    // Absolute failsafe fallback to prevent 500 loops
    try {
      if (!res.headersSent) {
        res.status(200).json([
          {
            _id: 'fallback_silver_1kg',
            name: 'Silver Bar 1 Kg',
            rate: cachedBaseRate?.ratePerKg || 290000,
            ratePerGram: cachedBaseRate?.ratePerGram || 290,
            purity: '99.99%',
            weight: { value: 1, unit: 'kg' },
            type: 'bar',
            isVisible: true,
            location: 'Andhra Pradesh'
          }
        ]);
      }
    } catch (e) {
      console.error('Failed to send failsafe response:', e);
    }
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



module.exports = router;

// Manual adjustments are now stored in MongoDB (SilverRate.manualAdjustment field)
// No longer using in-memory storage - all adjustments persist to database
module.exports.updateRatesHandler = updateRatesHandler;
module.exports.updateRatesFromEndpoints = updateRatesFromEndpoints;
module.exports.getCachedBaseRate = () => cachedBaseRate;
module.exports.setCachedBaseRate = (rate) => { cachedBaseRate = rate; };
