const axios = require('axios');
const { RATE_SOURCES, ACTIVE_RATE_SOURCE } = require('../config/rateSource');

/**
 * Fetches live silver rates from configured endpoints
 * Can use a single source or multiple sources (fallback)
 * Configure in backend/config/rateSource.js or via RATE_SOURCE environment variable
 */

// Fetch from RB Goldspot (tab-separated format)
// Format: ID	Name	Bid	Ask	High	Low	Status
// Live data example: 2966	Silver 999 	-	176845	176845	176845	InStock
// Ask price is the selling price in INR per KG
const fetchFromRBGoldspot = async () => {
  try {
    console.log('📡 Fetching from RB Goldspot...');
    const response = await axios.get('https://bcast.rbgoldspot.com:7768/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/rbgold', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/plain, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      timeout: 5000, // Reduced for serverless (Vercel has 10s limit)
      maxRedirects: 5,
      responseType: 'text',
      params: { 
        _t: Date.now(),
        _r: Math.random()
      },
      validateStatus: (status) => status >= 200 && status < 300
    });

    console.log('✅ RB Goldspot response received (status:', response.status, ')');

    // Parse tab-separated format - Extract ALL rates
    // Format from API: ID	Name	Bid	Ask	High	Low	Status
    // Example: 2966	Silver 999 	-	176845	176845	176845	InStock
    const lines = response.data.split('\n').filter(line => line.trim());
    const allRates = {};
    let ratePerKg = null;
    let ratePerGram = null;
    let silver999Data = null;
    let usdInrRate = null;
    let gold999Rate = null;
    let silverMini999Rate = null;

    // Parse ALL lines to extract all available rates
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Split by tabs (primary) or multiple spaces (fallback)
      // Format: ID	Name	Bid	Ask	High	Low	Status
      let parts = trimmedLine.split(/\t/);
      
      // If no tabs found, try splitting by multiple spaces
      if (parts.length < 6) {
        parts = trimmedLine.split(/\s{2,}/);
      }
      
      // Filter out empty parts
      parts = parts.map(p => p.trim()).filter(p => p.length > 0);
      
      if (parts.length >= 6) {
        const id = parts[0];
        const name = parts[1];
        const bid = parts[2] || '-';
        const ask = parts[3] || '-';
        const high = parts[4] || '-';
        const low = parts[5] || '-';
        const status = parts[6] || '';

        // Store all rates for reference
        allRates[id] = { id, name, bid, ask, high, low, status };

        // Extract Silver 999 (ID: 2966) - Primary rate
        // Match by ID first (most reliable), then by name
        if ((id === '2966' || (id && id.toString() === '2966')) && name && !name.toLowerCase().includes('mini')) {
          silver999Data = { id, name, bid, ask, high, low, status };
          
          // ALWAYS use Ask price (selling price, most consistent)
          // Format: Ask price is per kg, convert to per gram
          if (ask && ask !== '-' && ask !== '' && ask !== '0' && !isNaN(parseFloat(ask))) {
            const parsedAsk = parseFloat(ask);
            if (parsedAsk > 0) {
              ratePerKg = parsedAsk;
              ratePerGram = ratePerKg / 1000;
            }
          }
          // Fallback to High if Ask unavailable
          if (!ratePerGram && high && high !== '-' && high !== '' && high !== '0' && !isNaN(parseFloat(high))) {
            const parsedHigh = parseFloat(high);
            if (parsedHigh > 0) {
              ratePerKg = parsedHigh;
              ratePerGram = ratePerKg / 1000;
            }
          }
          // Try Bid price as last resort
          if (!ratePerGram && bid && bid !== '-' && bid !== '' && bid !== '0' && !isNaN(parseFloat(bid))) {
            const parsedBid = parseFloat(bid);
            if (parsedBid > 0) {
              ratePerKg = parsedBid;
              ratePerGram = ratePerKg / 1000;
            }
          }
        }

        // Extract USD-INR rate (ID: 3103)
        if ((id === '3103' || (id && id.toString() === '3103')) || (name && (name.toLowerCase().includes('usd-inr') || name.toLowerCase().includes('usdinr')))) {
          if (ask && ask !== '-' && ask !== '' && ask !== '0' && !isNaN(parseFloat(ask))) {
            usdInrRate = parseFloat(ask);
          } else if (high && high !== '-' && high !== '' && high !== '0' && !isNaN(parseFloat(high))) {
            usdInrRate = parseFloat(high);
          }
        }

        // Extract Gold 999 rate (ID: 945)
        if ((id === '945' || (id && id.toString() === '945')) && name && name.toLowerCase().includes('gold 999')) {
          if (ask && ask !== '-' && ask !== '' && ask !== '0' && !isNaN(parseFloat(ask))) {
            gold999Rate = parseFloat(ask);
          } else if (high && high !== '-' && high !== '' && high !== '0' && !isNaN(parseFloat(high))) {
            gold999Rate = parseFloat(high);
          }
        }

        // Extract Silver Mini 999 rate (ID: 2987)
        if ((id === '2987' || (id && id.toString() === '2987')) && name && name.toLowerCase().includes('silver mini 999')) {
          if (ask && ask !== '-' && ask !== '' && ask !== '0' && !isNaN(parseFloat(ask))) {
            silverMini999Rate = parseFloat(ask);
          } else if (high && high !== '-' && high !== '' && high !== '0' && !isNaN(parseFloat(high))) {
            silverMini999Rate = parseFloat(high);
          }
        }
      }
    }

    // Log all extracted rates
    console.log(`📊 Extracted rates: Silver 999=${ratePerKg || 'N/A'}, USD-INR=${usdInrRate || 'N/A'}, Gold 999=${gold999Rate || 'N/A'}, Silver Mini 999=${silverMini999Rate || 'N/A'}`);
    console.log(`📊 Total rates found: ${Object.keys(allRates).length}`);

    if (ratePerGram && ratePerGram > 0 && !isNaN(ratePerGram)) {
      // Use EXACT values from source - NO rounding to preserve accuracy
      // Keep ratePerKg exactly as received from RB Gold
      const exactRatePerKg = ratePerKg; // Keep original value from source (no rounding)
      const exactRatePerGram = ratePerGram; // Keep exact per gram value (no rounding)
      
      const result = {
        ratePerKg: exactRatePerKg, // Use exact value from source (no rounding)
        ratePerGram: exactRatePerGram, // Use exact value (no rounding)
        source: 'bcast.rbgoldspot.com',
        timestamp: new Date(),
        rawData: silver999Data,
        usdInrRate: usdInrRate || 89.25,
        gold999Rate: gold999Rate || null,
        silverMini999Rate: silverMini999Rate || null,
        allRates: allRates // Include all rates for reference
      };
      console.log(`✅ Successfully extracted EXACT rate from RB Goldspot: ₹${result.ratePerGram.toFixed(2)}/gram (₹${result.ratePerKg}/kg) [Raw Ask: ${silver999Data?.ask || 'N/A'}, Raw High: ${silver999Data?.high || 'N/A'}, Raw Bid: ${silver999Data?.bid || 'N/A'}]`);
      console.log(`📊 Rate breakdown: Source=${silver999Data?.ask || silver999Data?.high || 'N/A'}, PerKg=${exactRatePerKg} (exact), PerGram=${exactRatePerGram} (exact)`);
      return result;
    }
    
    console.warn('⚠️ Could not extract valid rate from RB Goldspot response');
    console.warn('  Parsed lines:', lines.length);
    console.warn('  Silver 999 data:', silver999Data);
    console.warn('  ratePerGram:', ratePerGram);
    console.warn('  ratePerKg:', ratePerKg);
    console.warn('  All rates:', Object.keys(allRates));
    return null;
  } catch (error) {
    console.error('❌ Error fetching from RB Goldspot:', error.message);
    if (error.response) {
      console.error('  Response status:', error.response.status);
      console.error('  Response data:', error.response.data?.substring(0, 500));
    }
    if (error.code) {
      console.error('  Error code:', error.code);
    }
    return null;
  }
};

// Fetch from Vercel (SSE format) - Secondary source for live rates
const fetchFromVercel = async () => {
  try {
    console.log('📡 Fetching from Vercel stream...');
    // Always fetch fresh data - no caching
    const response = await axios.get('https://jainsilverpp1.vercel.app/prices/stream', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/event-stream, application/json, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      timeout: 5000, // Reduced for serverless (Vercel has 10s limit)
      maxRedirects: 5,
      responseType: 'text',
      params: {
        _t: Date.now(), // Cache busting - ensures fresh data every second
        _r: Math.random() // Additional cache busting
      },
      validateStatus: function (status) {
        return status >= 200 && status < 300; // Accept only 2xx responses
      }
    });

    console.log('✅ Received response from stream endpoint');
    console.log('Response length:', response.data?.length || 0);
    console.log('Response preview:', response.data?.substring(0, 200) || 'No data');

    // Try to parse as JSON first (in case it's not SSE format)
    let rateData = null;
    try {
      rateData = JSON.parse(response.data);
      console.log('✅ Parsed as JSON');
    } catch (jsonError) {
      // If not JSON, parse as SSE format - extract the last complete data line
      console.log('⚠️ Not JSON, trying SSE format...');
      const lines = response.data.split('\n');
      let lastDataLine = null;
      
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6);
          try {
            rateData = JSON.parse(jsonStr);
            console.log('✅ Parsed SSE data line');
            break;
          } catch (e) {
            continue;
          }
        } else if (line.startsWith('{') && line.endsWith('}')) {
          // Try parsing as direct JSON line
          try {
            rateData = JSON.parse(line);
            console.log('✅ Parsed direct JSON line');
            break;
          } catch (e) {
            continue;
          }
        }
      }
    }

    if (!rateData) {
      console.warn('⚠️ No valid data found in Vercel stream response');
      console.warn('Response data:', response.data?.substring(0, 500));
      return null;
    }

    console.log('📊 Rate data structure:', {
      hasPrices: !!rateData.prices,
      pricesLength: rateData.prices?.length || 0,
      hasRatePerGram: !!rateData.ratePerGram,
      hasRate: !!rateData.rate,
      keys: Object.keys(rateData)
    });

    let ratePerKg = null;
    let ratePerGram = null;
    let usdInrRate = null;
    let gold999Rate = null;
    let silverMini999Rate = null;
    const allRates = {};

    // Handle different response formats
    if (rateData.prices && Array.isArray(rateData.prices)) {
      // Format: { prices: [...] }
      console.log('📋 Found prices array with', rateData.prices.length, 'items');
      
      // Extract ALL rates from prices array
      rateData.prices.forEach((item, index) => {
        const itemId = item.id || item._id || index.toString();
        const itemName = (item.name || '').toLowerCase();
        
        // Store all rates
        allRates[itemId] = {
          id: itemId,
          name: item.name || '',
          ask: item.ask || null,
          bid: item.bid || null,
          high: item.high || null,
          low: item.low || null,
          price: item.price || null
        };

        // Extract Silver 999 (Primary rate)
        if (itemId === '2966' || (itemName === 'silver 999' && !itemName.includes('mini'))) {
          if (item.ask && item.ask !== '-' && item.ask !== '' && !isNaN(parseFloat(item.ask))) {
            const parsedAsk = parseFloat(item.ask);
            if (parsedAsk > 0) {
              ratePerKg = parsedAsk;
              ratePerGram = ratePerKg / 1000;
            }
          } else if (item.high && item.high !== '-' && item.high !== '' && !isNaN(parseFloat(item.high))) {
            const parsedHigh = parseFloat(item.high);
            if (parsedHigh > 0) {
              ratePerKg = parsedHigh;
              ratePerGram = ratePerKg / 1000;
            }
          } else if (item.bid && item.bid !== '-' && item.bid !== '' && !isNaN(parseFloat(item.bid))) {
            const parsedBid = parseFloat(item.bid);
            if (parsedBid > 0) {
              ratePerKg = parsedBid;
              ratePerGram = ratePerKg / 1000;
            }
          } else if (item.price && !isNaN(parseFloat(item.price))) {
            const price = parseFloat(item.price);
            if (price > 0) {
              ratePerKg = price > 1000 ? price : price * 1000;
              ratePerGram = price > 1000 ? price / 1000 : price;
            }
          } else if (item.ratePerGram && !isNaN(parseFloat(item.ratePerGram))) {
            ratePerGram = parseFloat(item.ratePerGram);
            ratePerKg = ratePerGram * 1000;
          }
        }

        // Extract USD-INR rate
        if (itemId === '3103' || itemName.includes('usd-inr') || itemName.includes('usdinr')) {
          if (item.ask && item.ask !== '-' && item.ask !== '' && !isNaN(parseFloat(item.ask))) {
            usdInrRate = parseFloat(item.ask);
          } else if (item.high && item.high !== '-' && item.high !== '' && !isNaN(parseFloat(item.high))) {
            usdInrRate = parseFloat(item.high);
          }
        }

        // Extract Gold 999 rate
        if (itemId === '945' || itemName.includes('gold 999')) {
          if (item.ask && item.ask !== '-' && item.ask !== '' && !isNaN(parseFloat(item.ask))) {
            gold999Rate = parseFloat(item.ask);
          } else if (item.high && item.high !== '-' && item.high !== '' && !isNaN(parseFloat(item.high))) {
            gold999Rate = parseFloat(item.high);
          }
        }

        // Extract Silver Mini 999 rate
        if (itemId === '2987' || itemName.includes('silver mini 999')) {
          if (item.ask && item.ask !== '-' && item.ask !== '' && !isNaN(parseFloat(item.ask))) {
            silverMini999Rate = parseFloat(item.ask);
          } else if (item.high && item.high !== '-' && item.high !== '' && !isNaN(parseFloat(item.high))) {
            silverMini999Rate = parseFloat(item.high);
          }
        }
      });

      // Log all extracted rates
      console.log(`📊 Extracted rates: Silver 999=${ratePerKg || 'N/A'}, USD-INR=${usdInrRate || 'N/A'}, Gold 999=${gold999Rate || 'N/A'}, Silver Mini 999=${silverMini999Rate || 'N/A'}`);
      console.log(`📊 Total rates found: ${Object.keys(allRates).length}`);
      
    } else if (rateData.ratePerGram) {
      // Direct format: { ratePerGram: 168.39, ... }
      console.log('✅ Found ratePerGram directly:', rateData.ratePerGram);
      ratePerGram = parseFloat(rateData.ratePerGram);
      ratePerKg = ratePerGram * 1000;
      usdInrRate = rateData.usdInrRate || rateData.usdRate || null;
    } else if (rateData.rate) {
      // Format: { rate: 168390, ... }
      console.log('✅ Found rate field:', rateData.rate);
      const rate = parseFloat(rateData.rate);
      ratePerGram = rate > 1000 ? rate / 1000 : rate;
      ratePerKg = rate > 1000 ? rate : rate * 1000;
      usdInrRate = rateData.usdInrRate || rateData.usdRate || null;
    } else {
      console.warn('⚠️ Unknown rate data format:', Object.keys(rateData));
    }

    // Fallback: Try to extract USD-INR from top-level fields
    if (!usdInrRate && (rateData.usdInrRate || rateData.usdRate)) {
      usdInrRate = parseFloat(rateData.usdInrRate || rateData.usdRate);
    }

    if (ratePerGram && ratePerGram > 0 && !isNaN(ratePerGram)) {
      // Use EXACT values from source - NO rounding to preserve accuracy
      const exactRatePerKg = ratePerKg; // Keep original value from source (no rounding)
      const exactRatePerGram = ratePerGram; // Keep exact per gram value (no rounding)
      
      const result = {
        ratePerKg: exactRatePerKg, // Use exact value from source (no rounding)
        ratePerGram: exactRatePerGram, // Use exact value (no rounding)
        source: 'jainsilverpp1.vercel.app',
        timestamp: new Date(),
        rawData: rateData,
        usdInrRate: usdInrRate || 89.25,
        gold999Rate: gold999Rate || null,
        silverMini999Rate: silverMini999Rate || null,
        allRates: allRates // Include all rates for reference
      };
      console.log(`✅ Successfully extracted EXACT rate from Vercel: ₹${result.ratePerGram.toFixed(2)}/gram (₹${result.ratePerKg}/kg)`);
      console.log(`📊 Rate breakdown: PerKg=${exactRatePerKg} (exact), PerGram=${exactRatePerGram} (exact)`);
      return result;
    }
    
    console.warn('⚠️ Could not extract valid rate from Vercel response');
    console.warn('  ratePerGram:', ratePerGram, 'ratePerKg:', ratePerKg);
    console.warn('  All rates found:', Object.keys(allRates).length);
    console.warn('  Full rateData:', JSON.stringify(rateData, null, 2).substring(0, 1000));
    return null;
  } catch (error) {
    console.error('❌ Error fetching from Vercel stream:', error.message);
    if (error.response) {
      console.error('  Response status:', error.response.status);
      console.error('  Response data:', error.response.data?.substring(0, 500));
    }
    if (error.code) {
      console.error('  Error code:', error.code);
    }
    return null;
  }
};

// Fetch from custom endpoint (configurable)
const fetchFromCustom = async (url) => {
  try {
    if (!url || !url.trim()) {
      return null;
    }

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 5000,
      maxRedirects: 5,
    });

    // Try to parse as JSON first
    let rateData;
    if (typeof response.data === 'string') {
      try {
        rateData = JSON.parse(response.data);
      } catch (e) {
        // If not JSON, try to extract rate from text
        const match = response.data.match(/[\d.]+/g);
        if (match && match.length > 0) {
          const rate = parseFloat(match[0]);
          if (!isNaN(rate) && rate > 0) {
            return {
              ratePerKg: rate > 1000 ? rate : rate * 1000,
              ratePerGram: rate > 1000 ? rate / 1000 : rate,
              source: 'custom',
              timestamp: new Date(),
              usdInrRate: 89.25,
            };
          }
        }
        return null;
      }
    } else {
      rateData = response.data;
    }

    // Try common JSON formats
    let ratePerKg = null;
    let ratePerGram = null;

    // Format 1: { rate: 168.39, ratePerGram: 168.39, ... }
    if (rateData.ratePerGram) {
      ratePerGram = parseFloat(rateData.ratePerGram);
      ratePerKg = ratePerGram * 1000;
    } else if (rateData.rate) {
      const rate = parseFloat(rateData.rate);
      ratePerGram = rate > 1000 ? rate / 1000 : rate;
      ratePerKg = rate > 1000 ? rate : rate * 1000;
    } else if (rateData.price) {
      const price = parseFloat(rateData.price);
      ratePerGram = price > 1000 ? price / 1000 : price;
      ratePerKg = price > 1000 ? price : price * 1000;
    } else if (rateData.data && rateData.data.ratePerGram) {
      ratePerGram = parseFloat(rateData.data.ratePerGram);
      ratePerKg = ratePerGram * 1000;
    }

    if (ratePerGram && ratePerGram > 0 && !isNaN(ratePerGram)) {
      return {
        ratePerKg: Math.round(ratePerKg),
        ratePerGram: Math.round(ratePerGram * 100) / 100,
        source: 'custom',
        timestamp: new Date(),
        usdInrRate: rateData.usdInrRate || rateData.usdRate || 89.25,
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching from custom endpoint:', error.message);
    return null;
  }
};

/**
 * Fetches silver rates based on configuration
 * Supports: single source, multiple sources (fallback), or custom endpoint
 */
const fetchSilverRatesFromMultipleSources = async () => {
  // If using a specific single source
  if (ACTIVE_RATE_SOURCE === 'RB_GOLDSPOT') {
    return await fetchFromRBGoldspot();
  }
  
  if (ACTIVE_RATE_SOURCE === 'VERCEL') {
    return await fetchFromVercel();
  }
  
  if (ACTIVE_RATE_SOURCE === 'CUSTOM') {
    const customSource = RATE_SOURCES.CUSTOM;
    if (!customSource.enabled || !customSource.url) {
      console.warn('⚠️ Custom rate source not configured. Set CUSTOM_RATE_URL environment variable.');
      return null;
    }
    return await fetchFromCustom(customSource.url);
  }

  // MULTI mode: Try all enabled sources in parallel for fastest response
  const enabledSources = Object.values(RATE_SOURCES)
    .filter(source => source.enabled)
    .sort((a, b) => a.priority - b.priority);

  if (enabledSources.length === 0) {
    console.error('❌ No rate sources enabled - cannot fetch rates');
    console.error('   Available sources:', Object.keys(RATE_SOURCES));
    console.error('   ACTIVE_RATE_SOURCE:', ACTIVE_RATE_SOURCE);
    return null;
  }

  console.log(`🔄 Fetching rates from ${enabledSources.length} source(s) in MULTI mode:`, enabledSources.map(s => s.name).join(', '));

  // Try sources in parallel - return first successful result (fastest)
  // Create promises for each source
  const fetchPromises = enabledSources.map(async (source) => {
    try {
      let result = null;
      if (source.name === 'RB Goldspot') {
        result = await fetchFromRBGoldspot();
      } else if (source.name === 'Vercel') {
        result = await fetchFromVercel();
      } else if (source.name === 'Custom' && source.url) {
        result = await fetchFromCustom(source.url);
      }
      
      if (result && result.ratePerGram && result.ratePerGram > 0) {
        console.log(`✅ ${source.name} succeeded: ₹${result.ratePerGram.toFixed(2)}/gram`);
        return { source: source.name, result, priority: source.priority };
      }
      console.warn(`⚠️ ${source.name} returned invalid result (ratePerGram: ${result?.ratePerGram || 'N/A'})`);
      return null;
    } catch (error) {
      console.error(`❌ ${source.name} failed:`, error.message);
      // Continue to try other sources
      return null;
    }
  });

  // Use Promise.allSettled to wait for all, then pick best result by priority
  const results = await Promise.allSettled(fetchPromises);
  const successfulResults = results
    .filter(r => r.status === 'fulfilled' && r.value !== null && r.value.result)
    .map(r => r.value)
    .sort((a, b) => a.priority - b.priority); // Sort by priority (RB Goldspot first)

  if (successfulResults.length > 0) {
    const bestResult = successfulResults[0];
    return bestResult.result;
  }

  // If parallel failed, try sequential as fallback (RB Goldspot first, then Vercel)
  // This gives each source a full chance to respond
  console.log('⚠️ Parallel fetch failed, trying sequential fallback...');
  for (const source of enabledSources) {
    try {
      console.log(`  🔄 Trying ${source.name} sequentially...`);
      let result = null;
      if (source.name === 'RB Goldspot') {
        result = await fetchFromRBGoldspot();
      } else if (source.name === 'Vercel') {
        result = await fetchFromVercel();
      } else if (source.name === 'Custom' && source.url) {
        result = await fetchFromCustom(source.url);
      }
      
      if (result && result.ratePerGram && result.ratePerGram > 0) {
        console.log(`  ✅ ${source.name} succeeded sequentially: ₹${result.ratePerGram}/gram`);
        return result;
      } else {
        console.log(`  ⚠️ ${source.name} returned invalid result sequentially`);
      }
    } catch (error) {
      console.error(`  ❌ ${source.name} failed sequentially:`, error.message);
      // Continue to next source
    }
  }

  // All sources failed
  console.error('❌ All rate sources failed (both parallel and sequential)');
  return null;
};

module.exports = { fetchSilverRatesFromMultipleSources };


