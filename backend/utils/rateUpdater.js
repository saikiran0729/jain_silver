const SilverRate = require('../models/SilverRate');
const SilverPriceTracker = require('../models/SilverPriceTracker');
const { fetchSilverRatesFromMultipleSources } = require('./multiSourceRateFetcher');

const UPDATE_INTERVAL = 1000; // 1s polling
let consecutiveFailures = 0;

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

/**
 * High-performance MongoDB update for all rates using bulkWrite
 */
const updateMongoDBRates = async (silverRatePerGram, source, goldRatePerGram = null) => {
  try {
    // 1. Fetch current adjustments/metadata once - use lean for speed
    const currentRates = await SilverRate.find({ location: 'Andhra Pradesh' }).lean();
    const metadata = {};
    currentRates.forEach(r => {
      metadata[r.name] = {
        adjustment: r.manualAdjustment || 0,
        normalPrice: r.normalPrice
      };
    });

    // 2. Prepare bulk operations
    const bulkOps = rateDefinitions.map(def => {
      let liveBase = (def.type === 'gold') ? (goldRatePerGram || 0) : silverRatePerGram;

      // Purity adjustment for Jewelry
      if (def.type === 'jewelry' && def.purity === '92.5%') {
        liveBase = silverRatePerGram * 0.96;
      }

      const meta = metadata[def.name] || {};
      const manualAdj = meta.adjustment || 0;
      const ratePerGram = Math.max(0, liveBase + manualAdj);
      const weight = def.weight.unit === 'kg' ? def.weight.value * 1000 : def.weight.value;
      const totalRate = ratePerGram * weight;

      // Keep normalPrice stable if already exists
      const normalPrice = meta.normalPrice || liveBase;

      return {
        updateOne: {
          filter: { name: def.name, location: 'Andhra Pradesh' },
          update: {
            $set: {
              type: def.type,
              weight: def.weight,
              purity: def.purity,
              ratePerGram: ratePerGram,
              rate: totalRate,
              normalPrice: normalPrice,
              manualAdjustment: manualAdj,
              source: source,
              lastUpdated: new Date()
            },
            $setOnInsert: { isVisible: true, displayName: null }
          },
          upsert: true
        }
      };
    });

    if (bulkOps.length > 0) {
      await SilverRate.bulkWrite(bulkOps);
    }
    return true;
  } catch (error) {
    console.error('❌ updateMongoDBRates Error:', error.message);
    return false;
  }
};

const updateRates = async (io) => {
  try {
    const liveRate = await fetchSilverRatesFromMultipleSources();
    if (!liveRate || !liveRate.ratePerGram) {
      consecutiveFailures++;
      return;
    }

    consecutiveFailures = 0;
    const success = await updateMongoDBRates(liveRate.ratePerGram, 'rbgoldspot', liveRate.gold999Rate);

    if (success && io) {
      io.emit('rateUpdate', {
        baseRate: liveRate.ratePerGram,
        goldRate: liveRate.gold999Rate,
        timestamp: new Date()
      });
    }
  } catch (err) {
    console.error('updateRates Error:', err.message);
  }
};

let intervalId = null;

const startRateUpdater = (io) => {
  if (intervalId) clearInterval(intervalId);
  console.log('🚀 Rate Updater Started (1s)');

  // Initial run
  updateRates(io);

  intervalId = setInterval(() => {
    updateRates(io);
  }, UPDATE_INTERVAL);
};

const stopRateUpdater = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

module.exports = {
  startRateUpdater,
  stopRateUpdater,
  updateRates,
  updateMongoDBRates,
  rateDefinitions
};
