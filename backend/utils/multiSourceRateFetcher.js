const axios = require('axios');

/**
 * Fetches live silver rates from RB Goldspot ONLY.
 * Enforces normalization for high rates (3.5kg unit issue).
 */

// Normalization Helper (Keep this!)
const normalizeSafeRate = (ratePerKg) => {
  if (!ratePerKg || isNaN(ratePerKg)) return null;
  let normalizedRate = ratePerKg;

  // Check for Silver anomaly (> 1,000,000/kg)
  // Current silver price is ~3.5-3.7L/kg. Old 250k threshold was too low.
  if (ratePerKg > 1000000) {
    console.log(`⚠️ DETECTED HIGH SILVER RATE (${ratePerKg}). Applying 3.5kg normalization.`);
    normalizedRate = ratePerKg / 3.5;
  }
  return normalizedRate;
};

const normalizeSafeGoldRate = (ratePerGram) => {
  if (!ratePerGram || isNaN(ratePerGram)) return null;
  let normalizedRate = ratePerGram;

  // Check for Gold anomaly (> 100,000/g)
  if (ratePerGram > 100000) {
    console.log(`⚠️ DETECTED HIGH GOLD RATE (${ratePerGram}). Applying 20g normalization.`);
    normalizedRate = ratePerGram / 20;
  }
  return normalizedRate;
};

// Fetch from RB Goldspot (Using User Provided URL)
const fetchFromRBGoldspot = async () => {
  try {
    // console.log('📡 Fetching from RB Goldspot (Direct)...'); 

    const response = await axios.get('https://bcast.rbgoldspot.com:7768/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/rbgold', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      timeout: 5000,
      params: { _t: Date.now(), _r: Math.random() } // Anti-cache
    });

    if (!response.data) {
      console.warn('⚠️ RB Goldspot: Empty response received');
      return null;
    }

    // Parse Response - Robust splitting
    const lines = response.data.split('\n').filter(line => line.trim());
    let ratePerKg = null;
    let ratePerGram = null;
    let gold999Rate = null;
    let usdInrRate = null;
    let spotGoldUsd = null;
    let spotSilverUsd = null;

    for (const line of lines) {
      // Split by tab OR multiple spaces, and filter out empty strings
      const parts = line.trim().split(/\t|\s{2,}/).map(p => p.trim()).filter(p => p);
      if (parts.length < 4) continue;

      const id = parts[0];
      const name = parts[1] || '';

      // Try to find the numeric rate column (usually parts[2] or parts[3])
      // Index 2 is often Bid, Index 3 is Ask. We prefer Ask (price to buy).
      let bidValue = parseFloat(parts[2]);
      let askValue = parseFloat(parts[3]);

      // Handle cases where parts[2] or parts[3] might be "-"
      if (isNaN(askValue) || askValue <= 0) {
        askValue = isNaN(bidValue) ? null : bidValue;
      }

      if (!askValue || askValue <= 0) continue;

      // USD-INR (ID: 3103) - Often includes market duty/premiums for India
      if (id === '3103' || name.includes('USD-INR')) {
        usdInrRate = askValue;
      }
      // GOLD ($) (ID: 3101) - In many RB feeds this is for 2 Troy Ounces
      else if (id === '3101' || name.includes('GOLD ($)')) {
        spotGoldUsd = askValue;
      }
      // SILVER ($) (ID: 3107) - In many RB feeds this is for 3.5 Troy Ounces
      else if (id === '3107' || name.includes('SILVER ($)')) {
        spotSilverUsd = askValue;
      }
      // Silver 999 (ID: 2966) - Retail rate
      else if (id === '2966' || name.includes('Silver 999')) {
        ratePerKg = askValue;
      }
      // Gold 999 (ID: 945) - Retail rate
      else if (id === '945' || name.includes('Gold 999')) {
        gold999Rate = askValue;
      }
    }

    // CRITICAL: Calculate Live Rates from Spot if possible (User request: "fetch only lve price")
    // Spot prices are much more stable and reflect true market prices without retail markups.
    const effectiveUsdInr = usdInrRate || 91.675; // 91.675 is the specific bullion-market rate from the feed

    if (spotGoldUsd) {
      // Calculation: (Spot / 2 units) * USDINR / 31.1035 grams-per-ounce
      const spotGoldPerGram = (spotGoldUsd / 2) * effectiveUsdInr / 31.1035;
      console.log(`💎 RB Goldspot: Calculated Live Gold Spot -> ₹${spotGoldPerGram.toFixed(2)}/g (Spot: $${spotGoldUsd}, USDINR: ${effectiveUsdInr})`);
      gold999Rate = spotGoldPerGram;
    } else if (gold999Rate) {
      // Fallback: Normalize legacy Retail ID 945 (often 20g unit or high premium)
      gold999Rate = normalizeSafeGoldRate(gold999Rate);
    }

    if (spotSilverUsd) {
      // Calculation: (Spot / 3.5 units) * USDINR / 31.1035 grams-per-ounce
      const spotSilverPerGram = (spotSilverUsd / 3.5) * effectiveUsdInr / 31.1035;
      ratePerGram = spotSilverPerGram;
      ratePerKg = spotSilverPerGram * 1000;
      console.log(`💎 RB Goldspot: Calculated Live Silver Spot -> ₹${ratePerKg.toFixed(2)}/kg (Spot: $${spotSilverUsd}, USDINR: ${effectiveUsdInr})`);
    } else if (ratePerKg) {
      // Fallback: Normalize legacy Retail ID 2966
      ratePerKg = normalizeSafeRate(ratePerKg);
      ratePerGram = ratePerKg / 1000;
    }

    if (ratePerGram) {
      return {
        ratePerKg: ratePerKg,
        ratePerGram: ratePerGram,
        gold999Rate: gold999Rate,
        usdInrRate: effectiveUsdInr,
        source: 'rbgoldspot',
        timestamp: new Date()
      };
    }

    console.warn('⚠️ RB Goldspot: Could not find/calculate Silver rate in response');
    return null;

  } catch (error) {
    console.error('❌ Error fetching from RB Goldspot:', error.message);
    return null;
  }
};

/**
 * Simplified Fetcher - Always uses RB Goldspot
 */
const fetchSilverRatesFromMultipleSources = async () => {
  return await fetchFromRBGoldspot();
};

module.exports = { fetchSilverRatesFromMultipleSources };


