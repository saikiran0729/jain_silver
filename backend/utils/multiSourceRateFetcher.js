const axios = require('axios');
const { RATE_SOURCES, ACTIVE_RATE_SOURCE } = require('../config/rateSource');

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
    // Reduced logging to avoid attempting to log every second if not needed

    const response = await axios.get('https://bcast.rbgoldspot.com:7768/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/rbgold', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      timeout: 3500,
      params: { _t: Date.now(), _r: Math.random() } // Anti-cache
    });

    // Parse Response
    const lines = response.data.split('\n').filter(line => line.trim());
    let ratePerKg = null;
    let ratePerGram = null;
    let gold999Rate = null;
    let usdInrRate = null;

    for (const line of lines) {
      const parts = line.split(/\t/);
      if (parts.length < 4) continue;

      const id = parts[0];
      const ask = parseFloat(parts[3]); // Column 4 is Ask

      if (isNaN(ask) || ask <= 0) continue;

      // Silver 999 (ID: 2966)
      if (id === '2966') {
        ratePerKg = ask;
        ratePerGram = ask / 1000;
      }
      // Gold 999 (ID: 945)
      else if (id === '945') {
        gold999Rate = ask;
      }
      // USD-INR (ID: 3103)
      else if (id === '3103') {
        usdInrRate = ask;
      }
    }

    if (ratePerKg) {
      // Enforce Normalization
      const normalizedKg = normalizeSafeRate(ratePerKg);
      const normalizedGram = normalizedKg / 1000;

      // Normalize Gold
      if (gold999Rate) {
        gold999Rate = normalizeSafeGoldRate(gold999Rate);
      }

      return {
        ratePerKg: normalizedKg,
        ratePerGram: normalizedGram,
        gold999Rate: gold999Rate,
        usdInrRate: usdInrRate || 89.25,
        source: 'rbgoldspot',
        timestamp: new Date()
      };
    }
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


