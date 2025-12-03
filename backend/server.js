const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

// Platform detection - with comprehensive error handling
let platform, database, serverConfig;

// Safe platform config loading
function loadPlatformConfig() {
  try {
    const platformConfig = require('./config/platform');
    if (platformConfig && platformConfig.platform) {
      platform = platformConfig.platform;
      database = platformConfig.database;
      serverConfig = platformConfig.server;
      console.log(`🚀 Running on platform: ${platform.name.toUpperCase()}`);
      if (platformConfig.getConfig) {
        console.log(`📦 Platform details:`, platformConfig.getConfig());
      }
      return true;
    }
  } catch (error) {
    console.error('Error loading platform config:', error.message);
  }
  return false;
}

// Try to load platform config, use fallback if it fails
if (!loadPlatformConfig()) {
  console.log('⚠️  Using fallback platform configuration');
  const isVercel = process.env.VERCEL === 'true' || process.env.VERCEL_ENV || process.env.VERCEL;
  platform = {
    isVercel: !!isVercel,
    isAWS: false,
    isDocker: false,
    isLocal: !isVercel,
    name: isVercel ? 'vercel' : 'local'
  };
  database = {
    maxPoolSize: isVercel ? 1 : 10,
    minPoolSize: isVercel ? 0 : 1,
    serverSelectionTimeoutMS: isVercel ? 5000 : 10000,
    socketTimeoutMS: isVercel ? 45000 : 60000,
    retryWrites: !isVercel,
    retryReads: !isVercel
  };
  serverConfig = {
    enableSocketIO: !isVercel,
    enableRateUpdater: !isVercel,
    healthCheckPath: '/health'
  };
  console.log(`📦 Platform: ${platform.name}`);
}

const app = express();
const server = http.createServer(app);

// Socket.io setup - only if not on Vercel (Vercel doesn't support WebSockets)
let io = null;
if (!platform || !platform.isVercel) {
  try {
    io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    app.set('io', io);
  } catch (socketError) {
    console.error('Socket.io initialization error:', socketError.message);
    // Continue without Socket.io
  }
} else {
  // On Vercel, create a mock io object to prevent errors
  io = {
    emit: () => {},
    on: () => {},
    to: () => ({ emit: () => {} })
  };
  app.set('io', io);
}

// Middleware - CORS configuration (must be before routes)
// Allow all origins and headers for React Native compatibility
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Content-Length',
    'Origin',
    'X-HTTP-Method-Override',
    'Access-Control-Allow-Origin',
    'Cache-Control',
    'Pragma',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods'
  ],
  exposedHeaders: ['Content-Length', 'Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Handle preflight requests explicitly - must be before other routes
app.options('*', (req, res) => {
  console.log('🔄 OPTIONS preflight request:', req.path);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  res.header('Access-Control-Allow-Headers', 
    'Content-Type, Authorization, X-Requested-With, Accept, Content-Length, Origin, X-HTTP-Method-Override, Cache-Control, Pragma');
  res.header('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});

// IMPORTANT: Only parse JSON and URL-encoded bodies
// DO NOT parse multipart/form-data - multer will handle it
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  const contentLength = req.headers['content-length'];
  
  // Log ALL incoming requests for debugging
  console.log('🌐 Incoming request:', {
    method: req.method,
    path: req.path,
    contentType: contentType.substring(0, 50),
    contentLength: contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB` : 'unknown',
    timestamp: new Date().toISOString()
  });
  
  // Log request details for debugging
  if (contentType.includes('multipart/form-data')) {
    console.log('📎 Multipart request detected:', {
      contentType,
      contentLength: contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB` : 'unknown',
      method: req.method,
      path: req.path
    });
    
    // Check if request is too large (Vercel has 4.5MB limit on Hobby plan)
    if (contentLength && parseInt(contentLength) > 4.5 * 1024 * 1024) {
      console.warn('⚠️  Request body size exceeds Vercel limit (4.5MB)');
      return res.status(413).json({
        message: 'Request too large',
        error: 'Total file size exceeds 4.5MB limit. Please compress images or reduce file size.',
        maxSize: '4.5MB',
        receivedSize: `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB`
      });
    }
    
    // Skip body parsing for multipart/form-data - multer needs the raw stream
    return next();
  }
  
  // Parse JSON and URL-encoded for other content types
  next();
});

// Parse JSON bodies (but not multipart/form-data)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Note: File uploads now go to S3, but keep static route for backward compatibility
app.use('/uploads', express.static('uploads'));

// Database connection - optimized for Vercel serverless
const connectDB = async () => {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB already connected');
      return mongoose.connection;
    }

    // If connecting, wait for it
    if (mongoose.connection.readyState === 2) {
      console.log('⏳ MongoDB connection in progress, waiting...');
      await new Promise((resolve) => {
        mongoose.connection.once('connected', resolve);
        mongoose.connection.once('error', resolve);
      });
      if (mongoose.connection.readyState === 1) {
        console.log('✅ MongoDB connected (was in progress)');
        return mongoose.connection;
      }
    }

    // Get MongoDB URI
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jain_silver';
    
    // Log connection attempt (but hide password)
    const uriForLogging = mongoURI.replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://$1:***@');
    console.log('🔌 Attempting MongoDB connection...');
    console.log('   URI:', uriForLogging);
    console.log('   Has MONGODB_URI:', !!process.env.MONGODB_URI);
    
    // Connect with platform-optimized settings
    const dbConfig = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: (database && database.serverSelectionTimeoutMS) || 10000, // Increased to 10s
      socketTimeoutMS: (database && database.socketTimeoutMS) || 45000,
      maxPoolSize: (database && database.maxPoolSize) || 10,
      minPoolSize: (database && database.minPoolSize) || 1,
      retryWrites: (database && database.retryWrites) !== undefined ? database.retryWrites : true,
      retryReads: (database && database.retryReads) !== undefined ? database.retryReads : true,
    };
    
    const conn = await mongoose.connect(mongoURI, dbConfig);
    console.log('✅ MongoDB Connected successfully');
    console.log('   Database:', conn.connection.name);
    console.log('   Host:', conn.connection.host);
    return conn;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message || err);
    console.error('   Error name:', err.name);
    console.error('   Error code:', err.code);
    
    // Provide specific error messages
    if (err.message && err.message.includes('whitelist')) {
      console.error('⚠️  IP Whitelist Issue: Add 0.0.0.0/0 to MongoDB Atlas Network Access');
      console.error('📖 See: backend/MONGODB_VERCEL_SETUP.md for instructions');
    } else if (err.message && err.message.includes('authentication failed')) {
      console.error('⚠️  Authentication failed: Check MongoDB username and password in MONGODB_URI');
    } else if (err.message && err.message.includes('ENOTFOUND') || err.message && err.message.includes('getaddrinfo')) {
      console.error('⚠️  DNS/Network issue: Check if MongoDB URI is correct');
      console.error('   Make sure MONGODB_URI is set in Vercel environment variables');
    } else if (err.message && err.message.includes('timeout')) {
      console.error('⚠️  Connection timeout: MongoDB Atlas might be unreachable');
      console.error('   Check MongoDB Atlas cluster status');
    }
    
    // Don't throw in serverless - let routes handle it gracefully
    if (!process.env.VERCEL) {
      throw err;
    }
    return null;
  }
};

// Connect to database
connectDB();

// Helper function to ensure DB connection before operations
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }
  try {
    await connectDB();
    return mongoose.connection.readyState === 1;
  } catch (error) {
    console.error('Failed to ensure DB connection:', error);
    return false;
  }
};

// Make helper available to routes
app.locals.ensureDBConnection = ensureDBConnection;

// Handle favicon requests (prevent 404 errors)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content
});

app.get('/favicon.png', (req, res) => {
  res.status(204).end(); // No Content
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Jain Silver API Server',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      admin: '/api/admin',
      rates: '/api/rates',
      store: '/api/store',
      news: '/api/news'
    }
  });
});

// Routes
// Load routes with error handling - prevent server from crashing if a route fails to load
const loadRoute = (routePath, routeName) => {
  try {
    // Use absolute path to ensure it works on Vercel
    const routeFile = path.join(__dirname, 'routes', routeName + '.js');
    const route = require(routeFile);
    app.use(`/api/${routeName}`, route);
    console.log(`✅ Route loaded: /api/${routeName} from ${routeFile}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to load route /api/${routeName}:`, error.message);
    console.error(`   Attempted path: ${path.join(__dirname, 'routes', routeName + '.js')}`);
    console.error(`   __dirname: ${__dirname}`);
    // Add error route for failed route
    app.use(`/api/${routeName}`, (req, res) => {
      res.status(500).json({ 
        error: 'Route initialization failed', 
        route: routeName,
        message: error.message,
        attemptedPath: path.join(__dirname, 'routes', routeName + '.js')
      });
    });
    return false;
  }
};

// Load all routes - use route name for both path and name
const routeNames = ['auth', 'users', 'admin', 'rates', 'store', 'news'];
routeNames.forEach(routeName => {
  const loaded = loadRoute(routeName, routeName);
  if (!loaded) {
    console.error(`⚠️  Route /api/${routeName} failed to load - server may have issues`);
  }
});

// Global error handler - must be after all routes
app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err.message);
  console.error('Error stack:', err.stack);
  console.error('Request details:', {
    method: req.method,
    path: req.path,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length']
  });
  
  // Don't send error if response already sent
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
});

// Add a catch-all for unregistered routes to help debug (only if route not found)
app.use('/api/*', (req, res) => {
  console.log(`⚠️  Unhandled API route: ${req.method} ${req.path}`);
  console.log(`   Available routes: /api/auth, /api/users, /api/admin, /api/rates, /api/store`);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path,
    availableRoutes: ['/api/auth', '/api/users', '/api/admin', '/api/rates', '/api/store']
  });
});

// Socket.io for real-time updates (only if enabled for platform)
if (serverConfig && serverConfig.enableSocketIO) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
  
  // Store io instance for use in routes
  app.set('io', io);
} else {
  console.log('⚠️  Socket.io disabled for this platform (serverless)');
  app.set('io', null);
}

// Platform-specific initialization
if (platform) {
  if (platform.isVercel) {
    console.log('🚀 Running on Vercel (serverless mode)');
    console.log('⚠️  Socket.io WebSocket connections are not supported on Vercel');
    console.log('📡 Real-time updates will use HTTP polling fallback');
  } else if (platform.isAWS) {
    console.log('☁️  Running on AWS');
    console.log('✅ Full features enabled (Socket.io, rate updater)');
  } else if (platform.isDocker) {
    console.log('🐳 Running in Docker container');
    console.log('✅ Full features enabled');
  } else {
    console.log('💻 Running locally');
    console.log('✅ Full features enabled');
  }
}

// Export app for both Vercel and local development
// Vercel will use this export, local dev will start server below
module.exports = app;

// Only start server if not on Vercel
if (!process.env.VERCEL) {
  // Start server - listen on all network interfaces (for local development)
  const PORT = process.env.PORT || 5000;
  const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

  // Get local IP address dynamically
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  let localIP = 'localhost';
  
  // Find the first non-internal IPv4 address
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
    if (localIP !== 'localhost') break;
  }

  server.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 Accessible from network at: http://${localIP}:${PORT}`);
    console.log(`🌐 API endpoints available at: http://${localIP}:${PORT}/api`);
    console.log(`\n💡 Update mobile app config with: http://${localIP}:${PORT}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use.`);
      console.error(`   Solution: Kill the process using port ${PORT} or change PORT in .env`);
      console.error(`   On Windows: netstat -ano | findstr :${PORT}`);
      console.error(`   Then: taskkill /PID <PID> /F`);
    } else {
      console.error('❌ Server error:', err.message);
    }
    process.exit(1);
  });
}

// Initialize admin user (wait for MongoDB connection)
mongoose.connection.once('open', async () => {
  console.log('📦 Starting server initialization...');
  
  try {
    // Initialize admin user
    console.log('👤 Initializing admin user...');
    await require('./utils/initAdmin')();
    console.log('✅ Admin user check completed');
    
    // Check if rates exist, if not initialize them
    console.log('💰 Checking silver rates...');
    const SilverRate = require('./models/SilverRate');
    const rateCount = await SilverRate.countDocuments({ location: 'Andhra Pradesh' });
    
    if (rateCount === 0) {
      console.log('⚠️ No rates found. Initializing default rates...');
      try {
        // Initialize rates using the API endpoint logic
        const RATE_PER_GRAM_999 = 75.50;
        const RATE_PER_GRAM_9999 = 76.00;
        const RATE_PER_GRAM_925 = 69.50;

        const defaultRates = [
          { name: 'Silver Coin 1 Gram', type: 'coin', weight: { value: 1, unit: 'grams' }, purity: '99.9%', rate: RATE_PER_GRAM_999 * 1, ratePerGram: RATE_PER_GRAM_999, location: 'Andhra Pradesh' },
          { name: 'Silver Coin 5 Grams', type: 'coin', weight: { value: 5, unit: 'grams' }, purity: '99.9%', rate: RATE_PER_GRAM_999 * 5, ratePerGram: RATE_PER_GRAM_999, location: 'Andhra Pradesh' },
          { name: 'Silver Coin 10 Grams', type: 'coin', weight: { value: 10, unit: 'grams' }, purity: '99.9%', rate: RATE_PER_GRAM_999 * 10, ratePerGram: RATE_PER_GRAM_999, location: 'Andhra Pradesh' },
          { name: 'Silver Coin 50 Grams', type: 'coin', weight: { value: 50, unit: 'grams' }, purity: '99.9%', rate: RATE_PER_GRAM_999 * 50, ratePerGram: RATE_PER_GRAM_999, location: 'Andhra Pradesh' },
          { name: 'Silver Coin 100 Grams', type: 'coin', weight: { value: 100, unit: 'grams' }, purity: '99.9%', rate: RATE_PER_GRAM_999 * 100, ratePerGram: RATE_PER_GRAM_999, location: 'Andhra Pradesh' },
          { name: 'Silver Bar 100 Grams', type: 'bar', weight: { value: 100, unit: 'grams' }, purity: '99.99%', rate: RATE_PER_GRAM_9999 * 100, ratePerGram: RATE_PER_GRAM_9999, location: 'Andhra Pradesh' },
          { name: 'Silver Bar 500 Grams', type: 'bar', weight: { value: 500, unit: 'grams' }, purity: '99.99%', rate: RATE_PER_GRAM_9999 * 500, ratePerGram: RATE_PER_GRAM_9999, location: 'Andhra Pradesh' },
          { name: 'Silver Bar 1 Kg', type: 'bar', weight: { value: 1, unit: 'kg' }, purity: '99.99%', rate: RATE_PER_GRAM_9999 * 1000, ratePerGram: RATE_PER_GRAM_9999, location: 'Andhra Pradesh' },
          { name: 'Silver Jewelry 92.5%', type: 'jewelry', weight: { value: 1, unit: 'grams' }, purity: '92.5%', rate: RATE_PER_GRAM_925, ratePerGram: RATE_PER_GRAM_925, location: 'Andhra Pradesh' },
          { name: 'Silver Jewelry 99.9%', type: 'jewelry', weight: { value: 1, unit: 'grams' }, purity: '99.9%', rate: RATE_PER_GRAM_999, ratePerGram: RATE_PER_GRAM_999, location: 'Andhra Pradesh' }
        ];

        for (const rateData of defaultRates) {
          await SilverRate.findOneAndUpdate(
            { name: rateData.name, 'weight.value': rateData.weight.value, purity: rateData.purity },
            rateData,
            { upsert: true, new: true }
          );
        }
        console.log(`✅ Andhra Pradesh silver rates initialized successfully (${defaultRates.length} rates)`);
      } catch (initError) {
        console.error('❌ Error initializing rates:', initError.message || initError);
        console.error('Stack trace:', initError.stack);
      }
    } else {
      console.log(`✅ Found ${rateCount} silver rates in database`);
    }
    
    // Initialize store information if it doesn't exist
    console.log('🏪 Checking store information...');
    try {
      const StoreInfo = require('./models/Store');
      const storeInfo = await StoreInfo.getStoreInfo();
      console.log('✅ Store information initialized/verified');
    } catch (storeError) {
      console.error('❌ Error initializing store info:', storeError.message || storeError);
    }
    
    // Initialize rates cache from MongoDB and trigger fetch
    console.log('💰 Loading rates from MongoDB...');
    try {
      const SilverRate = require('./models/SilverRate');
      const lastRate = await SilverRate.findOne({ location: 'Andhra Pradesh' }).sort({ lastUpdated: -1 });
      
      // Get rates router (already loaded, Node.js caches modules)
      const ratesRouter = require('./routes/rates');
      
      if (lastRate && lastRate.ratePerGram) {
        // Set the cached base rate using the setter
        if (ratesRouter.setCachedBaseRate) {
          ratesRouter.setCachedBaseRate({
            ratePerGram: lastRate.ratePerGram,
            ratePerKg: lastRate.ratePerGram * 1000,
            source: 'mongodb',
            lastUpdated: lastRate.lastUpdated || new Date(),
            usdInrRate: 89.25
          });
          console.log(`✅ Loaded rate from MongoDB: ₹${lastRate.ratePerGram}/gram`);
        } else {
          console.warn('⚠️ setCachedBaseRate function not available');
        }
      } else {
        console.log('⚠️ No rates found in MongoDB, will fetch from endpoints');
      }
      
      // Trigger immediate rate update on server start
      console.log('🔄 Triggering initial rate fetch...');
      if (ratesRouter.updateRatesFromEndpoints) {
        ratesRouter.updateRatesFromEndpoints().catch((err) => {
          console.error('❌ Initial rate fetch failed:', err.message);
        });
      } else {
        console.warn('⚠️ updateRatesFromEndpoints function not available');
      }
    } catch (rateLoadError) {
      console.error('❌ Error initializing rates:', rateLoadError.message);
      if (rateLoadError.stack) {
        console.error('Stack:', rateLoadError.stack.substring(0, 500));
      }
    }
    
    // Start rate updater (only if enabled for platform - legacy)
    if (serverConfig && serverConfig.enableRateUpdater) {
      console.log('🔄 Starting legacy rate updater...');
      try {
        const { startRateUpdater } = require('./utils/rateUpdater');
        const io = app.get('io');
        if (io) {
          startRateUpdater(io);
          console.log('✅ Legacy rate updater started (updates every second)');
        } else {
          console.log('⚠️  Legacy rate updater skipped (Socket.io not available)');
        }
      } catch (updaterError) {
        console.error('❌ Error starting legacy rate updater:', updaterError.message || updaterError);
      }
    } else {
      console.log('⚠️  Legacy rate updater disabled for serverless platform');
    }
    
    console.log('🎉 Server initialization completed successfully!');
  } catch (error) {
    console.error('❌ Error during initialization:', error.message || error);
    console.error('Stack trace:', error.stack);
  }
});

