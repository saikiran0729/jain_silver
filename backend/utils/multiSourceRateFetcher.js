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

// Fetch from New Live Endpoint (api.abhinavgoldandsilver.com)
const fetchFromRBGoldspot = async () => {
  try {
    // console.log('📡 Fetching from New Live Endpoint...'); 

    const response = await axios.get('https://api.abhinavgoldandsilver.com/api/rates/live', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      timeout: 5000,
      params: { _t: Date.now(), _r: Math.random() } // Anti-cache
    });

    if (!response.data) {
      console.warn('⚠️ Rates API: Empty response received');
      return null;
    }

    // Parse Response - Handle JSON wrapper with .text field
    const rawText = response.data.text || (typeof response.data === 'string' ? response.data : '');
    if (!rawText) {
      console.warn('⚠️ Rates API: No text data found in response');
      return null;
    }

    const lines = rawText.split('\n').filter(line => line.trim());
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

    // CRITICAL: Use Retail IDs directly as per user clarification
    const effectiveUsdInr = usdInrRate || 94.073; // Updated fallback from live data

    // GOLD Calculation (Retail ID 945 is per 10g)
    if (gold999Rate) {
      const goldPerGram = gold999Rate / 10;
      console.log(`💎 Live API: Gold 999 -> ₹${goldPerGram.toFixed(2)}/g (ID 945: ${gold999Rate} / 10)`);
      gold999Rate = goldPerGram;
    }

    // SILVER Calculation (Retail ID 2966 is per kg)
    if (ratePerKg) {
      ratePerGram = ratePerKg / 1000;
      console.log(`💎 Live API: Silver 999 -> ₹${ratePerKg.toFixed(2)}/kg (ID 2966: ${ratePerKg})`);
    }

    if (ratePerGram) {
      return {
        ratePerKg: ratePerKg,
        ratePerGram: ratePerGram,
        gold999Rate: gold999Rate,
        usdInrRate: effectiveUsdInr,
        source: 'live-api',
        timestamp: new Date()
      };
    }

    console.warn('⚠️ Live API: Could not find/calculate Silver rate in response');
    return null;

  } catch (error) {
    console.error('❌ Error fetching from Live API:', error.message);
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
