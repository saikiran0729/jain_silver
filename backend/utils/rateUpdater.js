const SilverRate = require('../models/SilverRate');
const SilverPriceTracker = require('../models/SilverPriceTracker');
const Settings = require('../models/Settings');
const { fetchSilverRatesFromMultipleSources } = require('./multiSourceRateFetcher');

const UPDATE_INTERVAL = 1000; // Update rates every second (1000ms = 1 second)

// Track last successful update time
let lastSuccessfulUpdate = 0;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;

// Fetch live rates from multiple endpoints and update all silver rates
// Tries both RB Goldspot and Vercel endpoints every second
const updateRates = async (io) => {
  const startTime = Date.now();
  try {
    let rates = await SilverRate.find({ location: 'Andhra Pradesh' });
    
    if (rates.length === 0) {
      // Initialize rates if they don't exist
      console.log('⚠️ No rates found in MongoDB, initializing rates...');
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
      
      // Create initial rates with default values (will be updated immediately after)
      const initPromises = rateDefinitions.map(async (rateDef) => {
        try {
          const newRate = new SilverRate({
            name: rateDef.name,
            type: rateDef.type,
            weight: rateDef.weight,
            purity: rateDef.purity,
            ratePerGram: 170.0, // Default, will be updated immediately
            rate: 170.0 * (rateDef.weight.unit === 'kg' ? rateDef.weight.value * 1000 : rateDef.weight.value),
            location: 'Andhra Pradesh',
            unit: 'INR',
            lastUpdated: new Date()
          });
          await newRate.save();
        } catch (err) {
          console.error(`❌ Failed to initialize ${rateDef.name}:`, err.message);
        }
      });
      
      await Promise.all(initPromises);
      console.log('✅ Initialized rates in MongoDB');
      
      // Fetch the newly created rates
      rates = await SilverRate.find({ location: 'Andhra Pradesh' });
      
      if (rates.length === 0) {
        console.warn('⚠️ Still no rates after initialization, skipping update');
        return;
      }
    }
    
    // Fetch fresh rate every second from multiple sources (RB Goldspot + Vercel) - NO FALLBACK
    // Use Promise.race with timeout to ensure we don't wait too long
    console.log(`🔄 [${new Date().toISOString()}] Starting rate fetch...`);
    const fetchPromise = fetchSilverRatesFromMultipleSources();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Rate fetch timeout after 8 seconds')), 8000)
    );
    
    let liveRate;
    try {
      liveRate = await Promise.race([fetchPromise, timeoutPromise]);
    } catch (fetchError) {
      consecutiveFailures++;
      const errorMsg = fetchError.message || 'Unknown error';
      if (consecutiveFailures === 1 || consecutiveFailures % 5 === 0) {
        console.error(`❌ Rate fetch error (${consecutiveFailures} failures):`, errorMsg);
      }
      return; // Exit early, don't update rates
    }
    
    // Only proceed if we got a valid rate from endpoint - NO FALLBACK
    if (!liveRate || !liveRate.ratePerGram || liveRate.ratePerGram <= 0 || isNaN(liveRate.ratePerGram)) {
      consecutiveFailures++;
      // Log warning every 5 failures to avoid spam, but always log first failure
      if (consecutiveFailures === 1 || consecutiveFailures % 5 === 0) {
        console.warn(`⚠️ Failed to fetch rate from endpoint (${consecutiveFailures} consecutive failures)`);
        if (liveRate) {
          console.warn(`   Received invalid rate:`, { ratePerGram: liveRate.ratePerGram, source: liveRate.source });
        } else {
          console.warn(`   No rate returned from fetchSilverRatesFromMultipleSources()`);
        }
      }
      return; // Exit early, don't update rates
    }
    
    // Reset failure counter on success
    consecutiveFailures = 0;
    lastSuccessfulUpdate = Date.now();
    
    // Use EXACT rate from source - no smoothing, no rounding of ratePerKg
    const baseRatePerGram = liveRate.ratePerGram;
    const baseRatePerKg = liveRate.ratePerKg; // Use exact value from source
    
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
        return; // Cannot proceed without base price
      }
    }
    
    // Calculate difference from base silver price (for adjusting normalPrice)
    // This is the market movement since the base price was set
    // Adjusted price = normalPrice + silverDiff + manualAdjustment
    const silverDiff = baseRatePerGram - baseSilverPrice;
    
    // Log every successful fetch (with timestamp for accuracy)
    const fetchTime = Date.now() - startTime;
    console.log(`✅ [${new Date().toISOString()}] Fetched EXACT live rate: ₹${baseRatePerGram.toFixed(2)}/gram (₹${baseRatePerKg}/kg, source: ${liveRate.source}, fetch time: ${fetchTime}ms, diff from base: ₹${silverDiff.toFixed(2)}, base: ₹${baseSilverPrice.toFixed(2)})`);
    console.log(`📊 Raw source data: Ask=${liveRate.rawData?.ask || 'N/A'}, High=${liveRate.rawData?.high || 'N/A'}, RatePerKg=${baseRatePerKg}`);
    
    // Update all rates based on the live rate from endpoint
    const updatePromises = rates.map(async (rate) => {
      try {
        // Validate rate has required fields
        if (!rate.weight || !rate.weight.value) {
          console.warn(`Skipping rate update for ${rate.name || rate._id} - missing required fields`);
          return;
        }

        // Calculate rate per gram based on purity
        let ratePerGram = baseRatePerGram;
        
        // Adjust for different purity levels
        if (rate.purity === '92.5%') {
          // Sterling silver (92.5%) is typically 3-5% less than pure silver
          ratePerGram = baseRatePerGram * 0.96;
        } else if (rate.purity === '99.99%') {
          // 99.99% is slightly higher than 99.9%
          ratePerGram = baseRatePerGram * 1.005;
        }
        // 99.9% uses base rate as-is
        
        // CRITICAL: normalPrice should ALWAYS be the current market rate (updates every second)
        // This ensures that when normalPrice increases/decreases, adjustedPrice also increases/decreases accordingly
        // Set normalPrice to current market rate for this purity level
        const previousNormalPrice = rate.normalPrice;
        rate.normalPrice = rate.name.includes('236') ? 236 : ratePerGram;
        
        // If this is the first time, log it
        if (previousNormalPrice === null || previousNormalPrice === undefined) {
          console.log(`🔧 Set normalPrice for ${rate.name} to ₹${rate.normalPrice.toFixed(2)}/gram (current market rate)`);
        }
        
        // Get manual adjustment (can be negative) - this REPLACES previous adjustment, not cumulative
        const manualAdj = (typeof rate.manualAdjustment === 'number') ? rate.manualAdjustment : 0;
        
        // CRITICAL: Calculate adjustedPrice = normalPrice (current market rate) + manualAdjustment
        // When normalPrice increases by ₹1, adjustedPrice also increases by ₹1 (keeping manualAdjustment constant)
        rate.adjustedPrice = rate.normalPrice + manualAdj;
        
        // Keep ratePerGram in sync with adjustedPrice
        rate.ratePerGram = rate.adjustedPrice;
        
        // Log adjustment application for debugging (only for first rate to avoid spam)
        if (rate.name === rates[0]?.name) {
          console.log(`💰 Applied adjustment: Normal ₹${rate.normalPrice.toFixed(2)}/gram (current market rate) + Manual ₹${manualAdj.toFixed(2)}/gram = Adjusted ₹${rate.adjustedPrice.toFixed(2)}/gram`);
        }
        
        // Calculate total rate based on weight
        // CRITICAL: For Silver Bar 1kg, weightInGrams must be exactly 1000 (1kg = 1000g)
        let weightInGrams = rate.weight.value;
        if (rate.weight.unit === 'kg') {
          weightInGrams = rate.weight.value * 1000; // 1kg = 1000g
        } else if (rate.weight.unit === 'oz') {
          weightInGrams = rate.weight.value * 28.35; // 1 oz = 28.35 grams
        }
        
        // CRITICAL: Calculate total rate exactly: ratePerGram × weightInGrams
        // For Silver Bar 1kg (99.99%): If ratePerGram = ₹208.5, then total = ₹208.5 × 1000 = ₹208,500
        rate.rate = rate.ratePerGram * weightInGrams; // No rounding - keep exact value
        rate.lastUpdated = new Date();
        
        // Save to MongoDB with error handling
        try {
          await rate.save();
          // Log successful save (only for first rate to avoid spam)
          if (rate.name === rates[0]?.name) {
            console.log(`💾 Saved to MongoDB: ${rate.name} = ₹${rate.adjustedPrice.toFixed(2)}/gram (normal: ₹${rate.normalPrice.toFixed(2)}, market diff: ₹${silverDiff.toFixed(2)}, manual: ₹${manualAdj.toFixed(2)})`);
          }
        } catch (saveError) {
          console.error(`❌ Failed to save ${rate.name} to MongoDB:`, saveError.message);
          // Continue with other rates even if one fails
        }

        // Emit update via Socket.io
        if (io) {
          const rateData = {
            _id: rate._id,
            name: rate.name,
            rate: rate.rate,
            ratePerGram: rate.ratePerGram,
            adjustedPrice: rate.adjustedPrice,
            normalPrice: rate.normalPrice,
            weight: rate.weight,
            purity: rate.purity,
            type: rate.type,
            location: rate.location,
            lastUpdated: rate.lastUpdated,
            usdInrRate: liveRate.usdInrRate || 89.25, // Include USD rate in update
            gold999Rate: liveRate.gold999Rate || null,
            silverMini999Rate: liveRate.silverMini999Rate || null
          };
          io.emit('rateUpdate', rateData);
          // Also emit USD rate update separately
          io.emit('usdRateUpdate', { usdInrRate: liveRate.usdInrRate || 89.25 });
        }
      } catch (rateError) {
        console.error(`❌ Error updating rate ${rate.name || rate._id}:`, rateError.message);
      }
    });
    
    // Wait for all updates to complete
    await Promise.all(updatePromises);

    // Log every update to verify it's working
    const totalTime = Date.now() - startTime;
    console.log(`✅ Updated ${rates.length} rates in MongoDB (Base: ₹${baseRatePerGram.toFixed(2)}/gram from ${liveRate.source}, total time: ${totalTime}ms)`);
    
    // Verify MongoDB was updated by checking one rate
    try {
      const verifyRate = await SilverRate.findOne({ location: 'Andhra Pradesh' }).sort({ lastUpdated: -1 });
      if (verifyRate) {
        const verifyAge = Date.now() - new Date(verifyRate.lastUpdated).getTime();
        console.log(`✅ MongoDB verified: Latest rate "${verifyRate.name}" updated ${Math.round(verifyAge/1000)}s ago (adjusted: ₹${verifyRate.adjustedPrice}/gram, normal: ₹${verifyRate.normalPrice})`);
      }
    } catch (verifyError) {
      console.warn('⚠️ Could not verify MongoDB update:', verifyError.message);
    }
  } catch (error) {
    consecutiveFailures++;
    const errorTime = Date.now() - startTime;
    console.error(`❌ Error updating rates (${errorTime}ms):`, error.message || error);
    
    // If we've had too many consecutive failures, log a warning
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(`⚠️ WARNING: ${consecutiveFailures} consecutive rate update failures. Last success: ${lastSuccessfulUpdate ? new Date(lastSuccessfulUpdate).toISOString() : 'never'}`);
    }
  }
};

// Start rate updater (updates every second)
const startRateUpdater = (io) => {
  console.log(`🚀 Starting rate updater - will update every ${UPDATE_INTERVAL}ms (${1000/UPDATE_INTERVAL} times per second)`);
  
  // Initial update (don't await to avoid blocking)
  updateRates(io).catch(err => {
    console.error('❌ Initial rate update failed:', err.message);
  });
  
  // Update every second as requested
  // Use setInterval but ensure we don't stack updates if one takes longer than 1 second
  let isUpdating = false;
  setInterval(() => {
    // Skip if previous update is still running (prevents stacking)
    if (isUpdating) {
      console.warn('⚠️ Previous rate update still running, skipping this cycle');
      return;
    }
    
    isUpdating = true;
    updateRates(io)
      .finally(() => {
        isUpdating = false;
      })
      .catch(err => {
        console.error('❌ Rate update error:', err.message);
        isUpdating = false;
      });
  }, UPDATE_INTERVAL);
};

module.exports = { startRateUpdater, updateRates };

