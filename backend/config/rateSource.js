/**
 * Rate Source Configuration
 * Configure where to fetch silver rates from
 */

// Available rate sources
const RATE_SOURCES = {
  // Option 1: RB Goldspot (Primary source - reliable and working)
  RB_GOLDSPOT: {
    name: 'RB Goldspot',
    url: 'https://bcast.rbgoldspot.com:7768/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/rbgold',
    enabled: true,
    priority: 1, // Primary source - most reliable
  },
  
  // Option 2: Vercel endpoint (Secondary - fallback source)
  VERCEL: {
    name: 'Vercel',
    url: 'https://jainsilverpp1.vercel.app/prices/stream',
    enabled: true, // ENABLED - Use as fallback if RB Goldspot fails
    priority: 2, // Secondary source - fallback if RB Goldspot fails
  },
  
  // Option 3: Custom endpoint (add your own)
  CUSTOM: {
    name: 'Custom',
    url: process.env.CUSTOM_RATE_URL || '', // Set via environment variable
    enabled: false, // Set to true and provide URL to enable
    priority: 3,
  },
};

// Active rate source configuration
// Change this to use a different source
// Options: 'RB_GOLDSPOT', 'VERCEL', 'CUSTOM', or 'MULTI'
// 'MULTI' will try all enabled sources in priority order (recommended for reliability)
// Set via RATE_SOURCE environment variable or change default below
// Default to MULTI for maximum reliability (tries RB Goldspot first, then Vercel as fallback)
const ACTIVE_RATE_SOURCE = process.env.RATE_SOURCE || 'MULTI';

// If MULTI, it will try all enabled sources in priority order
// If a specific source name, it will only use that source

module.exports = {
  RATE_SOURCES,
  ACTIVE_RATE_SOURCE,
};

