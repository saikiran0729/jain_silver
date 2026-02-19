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
      $or: [
        { name: { $in: rateNames } },
        { originalName: { $in: rateNames } }
      ]
    }).select('name originalName manualAdjustment manualAdjustmentPercentage').lean();

    adjustments.forEach(adj => {
      const adjData = {
        amount: adj.manualAdjustment || 0,
        percentage: adj.manualAdjustmentPercentage || 0
      };

      // Store by name
      if (adj.name) adjustmentsMap[adj.name] = adjData;
      // Also store by originalName so we can look it up by the static definition name
      if (adj.originalName) adjustmentsMap[adj.originalName] = adjData;
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
    const adjData = adjustmentsMap[productName] || {
      amount: rate.manualAdjustment || 0,
      percentage: rate.manualAdjustmentPercentage || 0
    };

    const manualAdjustment = adjData.amount;
    const manualAdjustmentPercentage = adjData.percentage;

    // Recalculate everything from current market values
    // rate.ratePerGram from DB is just a snapshot - we should really re-calc from normalPrice
    // but normalPrice in DB is also baseRate.
    const currentRatePerGram = rate.ratePerGram || 0;

    // originalRatePerGram = (current - adjustmentAmount) / (1 + percentage/100)
    const originalRatePerGram = (currentRatePerGram - manualAdjustment) / (1 + manualAdjustmentPercentage / 100);

    // Calculate original total rate
    let weightInGrams = rate.weight.value;
    if (rate.weight.unit === 'kg') {
      weightInGrams = rate.weight.value * 1000;
    }
    const originalTotalRate = originalRatePerGram * weightInGrams;

    // adjustedTotalRate is what's in the DB usually, but let's be consistent
    const adjustedRatePerGram = currentRatePerGram;
    const adjustedTotalRate = adjustedRatePerGram * weightInGrams;

    // Use displayName if set, otherwise use name
    const displayName = rate.displayName || rate.name;
    const originalName = rate.originalName || rate.name;

    const isVisible = rate.isVisible !== undefined ? rate.isVisible : true;

    return {
      ...rate,
      name: displayName,
      originalName: originalName,
      displayName: displayName,
      isVisible: isVisible,
      ratePerGram: adjustedRatePerGram,
      rate: adjustedTotalRate,
      originalRatePerGram: Math.max(0, originalRatePerGram),
      originalRate: Math.max(0, originalTotalRate),
      manualAdjustment: manualAdjustment,
      manualAdjustmentPercentage: manualAdjustmentPercentage
    };
  });
};

// Cache for live base rate (updated on every request)
let cachedBaseRate = {
  ratePerGram: 0,
  ratePerKg: 0,
  source: 'none',
  lastUpdated: new Date(0), // Far past
  usdInrRate: 0
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

// Unified function to sync rates with source and save to MongoDB
const syncRatesWithSource = async (retryCount = 0) => {
  const startTime = Date.now();
  console.log(`🔄 [syncRatesWithSource] Starting sync (attempt ${retryCount + 1})...`);

  try {
    // 1. Fetch live rates
    const liveRate = await Promise.race([
      fetchSilverRatesFromMultipleSources(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('RB Goldspot Timeout')), 5000)
      )
    ]);

    if (!liveRate || !liveRate.ratePerGram || liveRate.ratePerGram <= 0) {
      throw new Error('Invalid or zero rate received from source');
    }

    // 2. Update Cache immediately for fast GET /rates/base-rate
    cachedBaseRate = {
      ratePerGram: liveRate.ratePerGram,
      ratePerKg: liveRate.ratePerKg,
      source: liveRate.source || 'rbgoldspot',
      lastUpdated: new Date(),
      usdInrRate: liveRate.usdInrRate || 89.25
    };
    lastSuccessfulUpdate = Date.now();

    // 3. Ensure MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('🔌 Connecting to MongoDB for sync...');
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 10000
      });
    }

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

    // 4. Fetch existing adjustments
    // CRITICAL: If this fails, we MUST NOT proceed to updateMongoDBRates as it would reset adjustments to zero
    const adjustmentsMap = await fetchManualAdjustments(rateDefinitions.map(r => r.name));

    if (adjustmentsMap === null) {
      console.warn('⚠️ Manual adjustments fetch returned null (DB issue). Aborting DB update to prevent overwriting adjustments.');
      return false;
    }

    // 5. Prepare Gold Rate
    let goldRatePerGram = liveRate.gold999Rate || 0;
    if (goldRatePerGram > 500000) goldRatePerGram /= 1000;
    else if (goldRatePerGram > 5000) goldRatePerGram /= 10;

    // 6. Execute Bulk Update
    const bulkOps = rateDefinitions.map(rateDef => {
      let baseRate;
      if (rateDef.type === 'gold') {
        baseRate = goldRatePerGram;
      } else {
        baseRate = liveRate.ratePerGram;
        // Standardize multipliers for transparency
        if (rateDef.purity === '92.5%') {
          baseRate *= 0.96; // 92.5% silver + making charges/wastage buffer
        } else if (rateDef.purity === '99.9%') {
          baseRate *= 1.0; // Standard parity for 99.9%
        } else if (rateDef.purity === '99.99%') {
          baseRate *= 1.0; // Standard parity for 99.99%
        }
      }

      const adjData = adjustmentsMap[rateDef.name] || { amount: 0, percentage: 0 };
      const manualAdjustment = adjData.amount;
      const manualAdjustmentPercentage = adjData.percentage;

      // NEW FORMULA: baseRate * (1 + percentage/100) + amount
      const ratePerGram = Math.max(0, baseRate * (1 + manualAdjustmentPercentage / 100) + manualAdjustment);

      let weightInGrams = rateDef.weight.value;
      if (rateDef.weight.unit === 'kg') weightInGrams *= 1000;
      const totalRate = ratePerGram * weightInGrams;

      return {
        updateOne: {
          filter: { name: rateDef.name, location: 'Andhra Pradesh' },
          update: {
            $set: {
              type: rateDef.type,
              weight: rateDef.weight,
              purity: rateDef.purity,
              ratePerGram: ratePerGram,
              rate: totalRate,
              normalPrice: baseRate,
              adjustedPrice: ratePerGram,
              manualAdjustment: manualAdjustment,
              manualAdjustmentPercentage: manualAdjustmentPercentage,
              originalName: rateDef.name,
              lastUpdated: new Date(),
              source: liveRate.source || 'rbgoldspot'
            },
            $setOnInsert: {
              isVisible: true,
              displayName: null
            }
          },
          upsert: true
        }
      };
    });

    const result = await SilverRate.bulkWrite(bulkOps, { ordered: false });
    const duration = Date.now() - startTime;
    console.log(`✅ [syncRatesWithSource] Sync complete: ${result.modifiedCount} updated, ${result.upsertedCount} inserted (${duration}ms)`);
    return true;

  } catch (error) {
    console.error(`❌ [syncRatesWithSource] Sync failed: ${error.message}`);
    if (retryCount < 2) {
      console.log(`🔄 Retrying sync in 1s...`);
      await new Promise(r => setTimeout(r, 1000));
      return syncRatesWithSource(retryCount + 1);
    }
    return false;
  }
};

// Legacy function maintainers for background interval
const updateRatesFromEndpoints = async () => {
  const now = Date.now();
  if (now - lastUpdateAttempt < 1000) return;
  lastUpdateAttempt = now;
  return syncRatesWithSource();
};

const updateRatesHandler = async (req, res = null) => {
  const success = await syncRatesWithSource();
  if (res) {
    if (success) {
      res.json({ success: true, message: 'Rates updated successfully', baseRate: cachedBaseRate.ratePerGram });
    } else {
      res.status(500).json({ success: false, message: 'Failed to update rates' });
    }
  }
};


// Get current base rate from source (without adjustments) - for "Show As It Is" feature
router.get('/base-rate', async (req, res) => {
  try {
    // Return cached base rate immediately for speed
    if (cachedBaseRate && cachedBaseRate.ratePerGram > 0) {
      // Trigger background update if cache is older than 800ms
      if (Date.now() - cachedBaseRate.lastUpdated.getTime() > 800) {
        syncRatesWithSource().catch(e => console.error(e));
      }

      return res.json({
        baseRatePerGram: cachedBaseRate.ratePerGram,
        baseRatePerKg: cachedBaseRate.ratePerKg,
        source: cachedBaseRate.source,
        lastUpdated: cachedBaseRate.lastUpdated,
        usdInrRate: cachedBaseRate.usdInrRate || 89.25
      });
    }

    // Safe failure for frontend stability
    return res.status(200).json({
      message: 'Live market rates currently unavailable',
      baseRatePerGram: 0,
      source: 'unavailable',
      unavailable: true
    });
  } catch (error) {
    console.error('Error fetching base rate:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get all silver rates - First tries MongoDB, then live API
router.get('/', async (req, res) => {
  try {
    const skipUpdate = req.query.skipUpdate === 'true' || req.query.skipUpdate === true;
    const adminParam = req.query.admin === 'true' || req.query.admin === true;

    // Check if user is admin
    const isAdmin = isAdminUser(req) || adminParam;

    let mongoRates = [];
    try {
      if (mongoose.connection.readyState === 1) {
        mongoRates = await SilverRate.find({ location: 'Andhra Pradesh' }).sort({ name: 1 }).lean();
      }
    } catch (e) { console.error('DB fetch failed:', e.message); }

    // ALWAYS trigger background sync if MongoDB data is older than 1 second
    // This ensures live rates are ALWAYS fresh regardless of skipUpdate flag.
    // skipUpdate=true just means "don't WAIT for sync, return cached data immediately"
    // but we must still kick off a background sync so the next poll gets fresh data.
    {
      const latestRate = mongoRates.length > 0 ? mongoRates.reduce((l, r) => (r.lastUpdated > l.lastUpdated ? r : l), mongoRates[0]) : null;
      const mongoAge = latestRate ? Date.now() - new Date(latestRate.lastUpdated).getTime() : 999999;

      if (mongoAge > 1000) {
        syncRatesWithSource().catch(() => { });
      }
    }
    if (mongoRates.length > 0) {
      const finalRates = await applyManualAdjustments(mongoRates, isAdmin, skipUpdate);
      // Ensure all products are present for admin view
      const completeRates = ensureAllProductsForAdmin(finalRates, isAdmin, cachedBaseRate.ratePerGram, skipUpdate);

      res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
      return res.json(completeRates);
    } else {
      // Return 200 with empty array to prevent frontend crashes/logouts
      console.log(`⚠️ Live rates not yet available. Returning empty response for stability.`);
      return res.status(200).json({
        message: 'Live market data currently unavailable',
        rates: [],
        unavailable: true
      });
    }
  } catch (error) {
    console.error('Final /rates error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// Support both POST and GET for manual triggering
router.post('/handle-update', updateRatesHandler);
router.get('/handle-update', updateRatesHandler);

// Initialize rates - Strictly triggers live update only
router.post('/initialize', async (req, res) => {
  try {
    console.log('🚀 [initialize] Triggering live rate fetch...');

    // Reset to none to ensure no stale data is accidentally served during init
    cachedBaseRate.source = 'none';

    // Trigger update
    updateRatesFromEndpoints().catch(() => { });

    res.json({
      message: 'Rate system initialization triggered (Live fetch started).',
      status: 'pending'
    });
  } catch (fatalError) {
    console.error('❌ FATAL ERROR in rates initialization:', fatalError);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Initialization failed', error: fatalError.message });
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
    await syncRatesWithSource();

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

// Update individual rate (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { manualAdjustment } = req.body;

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

    if (manualAdjustment !== undefined) {
      await SilverRate.findOneAndUpdate(
        { name: rateDef.name, location: 'Andhra Pradesh' },
        {
          $set: {
            manualAdjustment: manualAdjustment,
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );

      // Trigger sync to update calculated rates
      try {
        await syncRatesWithSource();
        console.log('✅ Rate adjustment triggered internal sync');
      } catch (e) {
        console.warn('⚠️ Post-update sync failed (will retry on next request):', e.message);
      }
    }

    res.json({ message: 'Rate adjustment updated successfully' });
  } catch (error) {
    console.error('Update rate error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Force rate update (admin only)
router.post('/force-update', auth, async (req, res) => {
  try {
    const success = await syncRatesWithSource();
    if (success) {
      res.json({
        message: 'Rate update triggered successfully.',
        currentRate: cachedBaseRate.ratePerGram,
        source: cachedBaseRate.source
      });
    } else {
      res.status(500).json({ message: 'Rate update failed' });
    }
  } catch (error) {
    console.error('Force update error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

// Manual adjustments are now stored in MongoDB (SilverRate.manualAdjustment field)
// No longer using in-memory storage - all adjustments persist to database
module.exports.updateRatesHandler = updateRatesHandler;
module.exports.updateRatesFromEndpoints = updateRatesFromEndpoints;
module.exports.syncRatesWithSource = syncRatesWithSource;
module.exports.getCachedBaseRate = () => cachedBaseRate;
module.exports.setCachedBaseRate = (rate) => { cachedBaseRate = rate; };
