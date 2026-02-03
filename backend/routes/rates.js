const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const SilverRate = require('../models/SilverRate');
const Settings = require('../models/Settings');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { fetchSilverRatesFromMultipleSources } = require('../utils/multiSourceRateFetcher');
const SilverPriceTracker = require('../models/SilverPriceTracker');

// Helper function to fetch manual adjustments from MongoDB
const fetchManualAdjustments = async (rateNames) => {
  let adjustmentsMap = {};

  // CRITICAL FIX: Check connection state to avoid hanging if DB is down (causes 500/Timeout on Vercel)
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️ MongoDB not connected, skipping manual adjustments fetch (preserving existing)');
      return null; // Return null to indicate failure
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
const getOriginalRates = async (baseRatePerGram, goldRatePerGram = null) => {
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

  // Always include Gold products (default to 0 if rate not available)
  rateDefinitions.push(
    { name: 'Gold 999 1 Gram', type: 'gold', weight: { value: 1, unit: 'grams' }, purity: '99.9%' },
    { name: 'Gold 999 10 Grams', type: 'gold', weight: { value: 10, unit: 'grams' }, purity: '99.9%' } // Tola/10g
  );

  return rateDefinitions.map(rateDef => {
    let ratePerGram;

    if (rateDef.type === 'gold') {
      ratePerGram = goldRatePerGram;
      // No adjustment for purity for now, assuming base rate is for 99.9%
    } else {
      ratePerGram = baseRatePerGram;
      if (rateDef.purity === '92.5%') {
        ratePerGram = baseRatePerGram * 0.96;
      }
      // Both 99.9% and 99.99% use base rate as-is (no multiplier)
    }

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
    { name: 'Silver Jewelry 99.9%', type: 'jewelry', weight: { value: 1, unit: 'grams' }, purity: '99.9%' },
    { name: 'Gold 999 1 Gram', type: 'gold', weight: { value: 1, unit: 'grams' }, purity: '99.9%' },
    { name: 'Gold 999 10 Grams', type: 'gold', weight: { value: 10, unit: 'grams' }, purity: '99.9%' }
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

      if (def.type === 'gold') {
        // If baseRatePerGram (which is Silver) is passed, we can't use it for Gold
        // Use a reasonable gold fallback (~₹6500) if not provided
        ratePerGram = 6500;
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
  ratePerGram: 350.0, // Default fallback rate (updated for current market rate ~₹350,000/kg)
  ratePerKg: 350000,
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
  // On Vercel production, triggering updates might be different, but for this specific user request
  // we want to ensure 1-second updates if the process is running.

  const now = Date.now();
  const timeSinceLastAttempt = now - lastUpdateAttempt;

  // STRICT 1-SECOND INTERVAL (User request: "fetch every second")
  // We allow actual execution every ~1000ms
  if (timeSinceLastAttempt < 1000) {
    return;
  }

  lastUpdateAttempt = now;

  // console.log(`📡 Fetching rates...`); // Reduced log spam

  try {
    // Fetch with SHORT timeout to prevent hanging the API request
    // Backend fetch should be faster than frontend timeout (15s)
    const liveRate = await Promise.race([
      fetchSilverRatesFromMultipleSources(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RB Goldspot Timeout')), 3500)
      )
    ]);

    if (liveRate && liveRate.ratePerGram && liveRate.ratePerGram > 0) {

      // Update cache immediately
      cachedBaseRate = {
        ratePerGram: liveRate.ratePerGram,
        ratePerKg: liveRate.ratePerKg,
        source: 'rbgoldspot', // Hardcoded as we know it's RB
        lastUpdated: new Date(),
        usdInrRate: liveRate.usdInrRate || 89.25
      };

      // console.log(`✅ Rate updated: ₹${liveRate.ratePerGram.toFixed(2)}/gram`); // Reduced log spam

      lastSuccessfulUpdate = Date.now();

      // Update MongoDB with exact rate from source
      await updateMongoDBRates(liveRate.ratePerGram, 'rbgoldspot', liveRate.gold999Rate);

    } else {
      console.warn('⚠️ Invalid rate received -> Keeping old rate');
    }
  } catch (error) {
    console.error('❌ Rate fetch failed:', error.message);
  }
};

const updateMongoDBRates = async (baseRatePerGram, source, goldRatePerGram = null) => {
  try {
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

    // Get ALL product definitions (Coins, Bars, Jewelry, AND Gold)
    // Pass goldRatePerGram to include Gold products if available
    const ratesList = await getOriginalRates(baseRatePerGram, goldRatePerGram);


    // We need to re-map this to rateDefinitions format for the bulk update logic below
    // getOriginalRates returns calculated objects, but the logic below expects definitions + calculation
    // Actually, getOriginalRates returns the full object structure needed for the list response.
    // But the bulk update logic below re-calculates everything from `rateDefinitions` array.
    // So we should update `rateDefinitions` array inside this function too, or just reuse the logic from `getOriginalRates`?

    // Let's redefine `rateDefinitions` here including Gold if applicable, consistent with getOriginalRates
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

    // Always add Gold products to ensure they exist in DB (default to 0 if rate not available)
    rateDefinitions.push(
      { name: 'Gold 999 1 Gram', type: 'gold', weight: { value: 1, unit: 'grams' }, purity: '99.9%' },
      { name: 'Gold 999 10 Grams', type: 'gold', weight: { value: 10, unit: 'grams' }, purity: '99.9%' }
    );


    // Fetch manual adjustments from MongoDB
    const adjustmentsMap = await fetchManualAdjustments(rateDefinitions.map(r => r.name));

    let updatedCount = 0;
    const updatePromises = rateDefinitions.map(async (rateDef) => {
      try {
        let ratePerGram;
        if (rateDef.type === 'gold') {
          // CRITICAL FIX: Use Gold rate for Gold products
          // Pass 0 if undefined to avoid NaN
          ratePerGram = goldRatePerGram || 0;
        } else {
          // Use Silver rate for other products
          ratePerGram = baseRatePerGram;
          if (rateDef.purity === '92.5%') {
            ratePerGram = baseRatePerGram * 0.96;
          }
        }
        // Both 99.9% and 99.99% use base rate as-is (no multiplier)

        // Only apply adjustment if we successfully fetched them
        // If adjustmentsMap is null (fetch failed), preserve existing adjustment in DB by NOT including it in $set
        const manualAdjustment = adjustmentsMap ? (adjustmentsMap[rateDef.name] || 0) : 0;

        // If map is valid, apply adjustment to rate. If not, we can't accurately calculate rate with adjustment here.
        // But we must update the rate. 
        // Best approach: If we can't fetch adjustments, assume 0 for CALCULATION but don't overwrite in DB?
        // Actually, if we use 0 for calculation, the displayed rate will drop.
        // Ideally we should NOT update the rate if we can't fetch adjustments, to prevent price glitches.
        // But preventing updates might lead to stale rates.
        // Compromise: Use 0 for calculation (safe fallback) but DO NOT overwrite manualAdjustment field in DB.

        ratePerGram = ratePerGram + manualAdjustment;
        ratePerGram = Math.max(0, ratePerGram); // No rounding - keep exact value

        let weightInGrams = rateDef.weight.value;
        if (rateDef.weight.unit === 'kg') {
          weightInGrams = rateDef.weight.value * 1000; // 1kg = 1000g
        }

        // CRITICAL: Calculate total rate exactly: ratePerGram × weightInGrams
        const totalRate = ratePerGram * weightInGrams; // No rounding - keep exact value

        const updatePayload = {
          name: rateDef.name,
          type: rateDef.type,
          weight: rateDef.weight,
          purity: rateDef.purity,
          ratePerGram: ratePerGram,
          rate: totalRate,
          lastUpdated: new Date(),
          location: 'Andhra Pradesh',
          unit: 'INR',
          source: 'rbgoldspot'
        };

        // Only update manualAdjustment if we successfully fetched the map
        if (adjustmentsMap !== null) {
          updatePayload.manualAdjustment = manualAdjustment;
        }

        await SilverRate.findOneAndUpdate(
          { name: rateDef.name, location: 'Andhra Pradesh' },
          {
            $set: updatePayload,
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
    // STALE-WHILE-REVALIDATE PATTERN
    // 1. Return cached data immediately if available AND VALID (not anomalous)
    // STALE-WHILE-REVALIDATE PATTERN for 1s real-time updates
    if (cachedBaseRate && cachedBaseRate.ratePerGram > 0 && (Date.now() - cachedBaseRate.lastUpdated.getTime() < 2000)) {
      // Return mostly fresh cache immediately to be fast
      // User wants "every second", so 2s cache is acceptable buffer if system is busy
      // But let's trigger a background update anyway to keep it super fresh
      if (Date.now() - cachedBaseRate.lastUpdated.getTime() > 800) {
        updateRatesFromEndpoints().catch(e => console.error(e));
      }

      return res.json({
        baseRatePerGram: cachedBaseRate.ratePerGram,
        baseRatePerKg: cachedBaseRate.ratePerKg,
        source: cachedBaseRate.source,
        lastUpdated: cachedBaseRate.lastUpdated,
        usdInrRate: cachedBaseRate.usdInrRate
      });
    }

    // Cold start or Stale Cache? Fetch Live in background and return fallback if needed
    // DON'T block the main request
    updateRatesFromEndpoints().catch(e => console.error('Background update failed:', e.message));

    if (cachedBaseRate && cachedBaseRate.ratePerGram > 0) {
      return res.json({
        baseRatePerGram: cachedBaseRate.ratePerGram,
        baseRatePerKg: cachedBaseRate.ratePerKg,
        source: cachedBaseRate.source,
        lastUpdated: cachedBaseRate.lastUpdated,
        usdInrRate: cachedBaseRate.usdInrRate
      });
    }


    // Fallback if update failed
    return res.json({
      baseRatePerGram: 350.0,
      source: 'fallback'
    });
  } catch (error) {
    console.error('Error fetching base rate:', error.message);
    // Return cached base rate if we have it, even if it failed above (unlikely but safe)
    if (cachedBaseRate && cachedBaseRate.ratePerGram > 0) {
      return res.json({
        baseRatePerGram: cachedBaseRate.ratePerGram,
        baseRatePerKg: cachedBaseRate.ratePerKg,
        source: cachedBaseRate.source,
        lastUpdated: cachedBaseRate.lastUpdated
      });
    }

    // Fallback if no cache
    return res.json({
      baseRatePerGram: 350.0, // Default fallback
      source: 'fallback'
    });
  }
});

// Get all silver rates - First tries MongoDB, then live API
router.get('/', async (req, res) => {
  try {
    let skipUpdate = req.query.skipUpdate === 'true' || req.query.skipUpdate === true;
    const adminParam = req.query.admin === 'true' || req.query.admin === true;

    if (skipUpdate) {
      console.log('⚡ Fast path: skipUpdate=true, fetching from MongoDB only');
      try {
        if (mongoose.connection.readyState === 1) {
          let mongoRates = await SilverRate.find({ location: 'Andhra Pradesh' }).sort({ name: 1 }).lean();
          updateRatesFromEndpoints().catch(e => console.error('Background update failed:', e.message));
          if (mongoRates.length > 0) {
            const isAdmin = isAdminUser(req) || adminParam;
            const finalRates = await applyManualAdjustments(mongoRates, isAdmin, true);
            return res.json(finalRates);
          }
        }
      } catch (fastErr) {
        console.warn('⚠️ Fast path failed:', fastErr.message);
      }
    }

    const isAdminFromToken = isAdminUser(req);
    const isAdmin = isAdminFromToken || adminParam;

    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        jwt.verify(token, process.env.JWT_SECRET || 'jain_silver_secret_key_2024_change_in_production');
      }
    } catch (e) {}

    let showAsItIs = req.query.showAsItIs === 'true' || req.query.showAsItIs === true;
    if (!showAsItIs && Settings) {
       try {
         const setting = await Settings.getSetting('showAsItIs');
         if (setting) showAsItIs = setting.value;
       } catch(e){}
    }

    let mongoRates = [];
    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
      }
      if (mongoose.connection.readyState === 1) {
        mongoRates = await SilverRate.find({ location: 'Andhra Pradesh' }).sort({ name: 1 }).lean();
      }
    } catch (e) { console.error('DB fetch failed:', e.message); }

    if (mongoRates.length > 0) {
       const latestRate = mongoRates.reduce((l, r) => (r.lastUpdated > l.lastUpdated ? r : l), mongoRates[0]);
       const mongoAge = Date.now() - new Date(latestRate.lastUpdated).getTime();
       
       if (mongoAge > 1000) {
         setImmediate(() => updateRatesHandler(req, null).catch(e => {}));
       }

       const finalRates = await applyManualAdjustments(mongoRates, isAdmin, true);
       const ratesWithUSD = finalRates.map(r => ({ ...r, usdInrRate: cachedBaseRate.usdInrRate || 89.25 }));
       
       res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
       return res.json(ratesWithUSD);
    } else {
       // Fallback to cache if no DB rates
       const calculatedOriginalRates = await getOriginalRates(cachedBaseRate.ratePerGram);
       const finalRates = calculatedOriginalRates.map(r => ({ ...r, usdInrRate: cachedBaseRate.usdInrRate || 89.25 }));
       return res.json(finalRates);
    }
  } catch (error) {
    console.error('Final /rates error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: error.message });
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
      { name: 'Silver Jewelry 99.9%', type: 'jewelry', weight: { value: 1, unit: 'grams' }, purity: '99.9%' },
      { name: 'Gold 999 1 Gram', type: 'gold', weight: { value: 1, unit: 'grams' }, purity: '99.9%' },
      { name: 'Gold 999 10 Grams', type: 'gold', weight: { value: 10, unit: 'grams' }, purity: '99.9%' }
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
    console.log('🔄 Updating rates from live source...');
    console.log(`📅 Update triggered at: ${new Date().toISOString()}`);

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

    // Extract Gold 999 rate with fallback defaults
    // Usually Gold is ~75,000 per 10g. Need to normalize to per gram.
    let goldRatePerGram = 0;
    if (liveRate.gold999Rate && liveRate.gold999Rate > 0) {
      if (liveRate.gold999Rate > 500000) {
        // Assume per kg (e.g. 75,00,000)
        goldRatePerGram = liveRate.gold999Rate / 1000;
      } else if (liveRate.gold999Rate > 5000) {
        // Assume per 10g (e.g. 75,000) - Standard Indian Tola/10g price
        goldRatePerGram = liveRate.gold999Rate / 10;
      } else {
        // Assume per gram (e.g. 7,500)
        goldRatePerGram = liveRate.gold999Rate;
      }
      console.log(`✨ Gold Rate: ₹${liveRate.gold999Rate} (Calculated: ₹${goldRatePerGram.toFixed(2)}/gram)`);
    } else {
      console.warn('⚠️ No Gold rate found in live data, defaulting to 0');
    }

    // Get or set baseSilverPrice using SilverPriceTracker collection
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
      { name: 'Silver Jewelry 99.9%', type: 'jewelry', weight: { value: 1, unit: 'grams' }, purity: '99.9%' },
      { name: 'Gold 999 1 Gram', type: 'gold', weight: { value: 1, unit: 'grams' }, purity: '99.9%' },
      { name: 'Gold 999 10 Grams', type: 'gold', weight: { value: 10, unit: 'grams' }, purity: '99.9%' }
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
      let ratePerGramForPurity;

      if (rateDef.type === 'gold') {
        // For Gold, use the passed goldRatePerGram
        ratePerGramForPurity = goldRatePerGram;
        // If goldRatePerGram missing (shouldn't happen if pushed to list), fallback to 0 or safe default
        if (!ratePerGramForPurity) ratePerGramForPurity = 0;
      } else {
        // Silver logic
        ratePerGramForPurity = baseRatePerGram;
        if (rateDef.purity === '92.5%') {
          ratePerGramForPurity = baseRatePerGram * 0.96;
        } else if (rateDef.purity === '99.99%') {
          ratePerGramForPurity = baseRatePerGram; // 99.99% uses base rate as-is
        }
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
