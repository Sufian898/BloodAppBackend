const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sufianali122nb:1234sufi@cluster0.0qnf0nx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB (for Vercel serverless)
let isConnected = false;
let connectionPromise = null;

const connectDB = async () => {
  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }

  // If connection is in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  // Start new connection
  connectionPromise = mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 20000, // Reduced timeout for faster response
    socketTimeoutMS: 30000,
    connectTimeoutMS: 20000,
    retryWrites: true,
    w: 'majority',
    maxPoolSize: 10, // Maintain up to 10 socket connections
    minPoolSize: 1, // Maintain at least 1 socket connection
  }).then(() => {
    isConnected = true;
    console.log('✅ MongoDB Connected Successfully');
    connectionPromise = null;
  }).catch((error) => {
    console.error('❌ MongoDB Connection Error:', error);
    isConnected = false;
    connectionPromise = null;
    throw error;
  });

  return connectionPromise;
};

// Initialize connection (non-blocking)
connectDB().catch(err => {
  console.error('Initial MongoDB connection failed:', err);
});

// Middleware to ensure MongoDB connection before handling requests
app.use(async (req, res, next) => {
  try {
    // Log all requests for debugging (only in development)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${req.method}] ${req.originalUrl || req.path}`);
    }
    
    // Ensure MongoDB is connected before processing any request
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected, attempting connection...');
      try {
        // Wait for connection with timeout
        await Promise.race([
          connectDB(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 15000))
        ]);
        console.log('MongoDB connection established in middleware');
      } catch (connectError) {
        console.error('Failed to connect MongoDB in middleware:', connectError);
        // Continue anyway - route handlers will handle the error
      }
    }
    next();
  } catch (error) {
    console.error('MongoDB connection error in middleware:', error);
    // Continue anyway - some routes might work with cached data
    next();
  }
});

// Routes
app.use('/api/auth', require('../routes/auth'));
app.use('/api/users', require('../routes/users'));
app.use('/api/donors', require('../routes/donors'));
app.use('/api/requests', require('../routes/requests'));
app.use('/api/stats', require('../routes/stats'));
app.use('/api/admin', require('../routes/admin'));
// Register ads routes
const adsRouter = require('../routes/ads');
app.use('/api/ads', adsRouter);
console.log('✅ Ads routes registered at /api/ads');
console.log('   Available endpoints:');
console.log('   - POST /api/ads (admin) - Create ad');
console.log('   - GET /api/ads/all (admin) - Get all ads');
console.log('   - GET /api/ads/position/:position (public) - Get ads by position');
console.log('   - GET /api/ads (public) - Get active ads');
console.log('   - POST /api/ads/:id/click (public) - Track ad click');
console.log('   - PUT /api/ads/:id (admin) - Update ad');
console.log('   - DELETE /api/ads/:id (admin) - Delete ad');
// Chat routes - IMPORTANT: Order matters for dynamic routes
app.use('/api/chats', require('../routes/chats'));

// Health check - handle both /api/health and /health
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Blood Donation API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Blood Donation API is running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'Blood Donation API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      donors: '/api/donors',
      requests: '/api/requests',
      stats: '/api/stats',
      admin: '/api/admin',
      chats: '/api/chats'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!', 
    error: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  console.log('❌ 404 - Route not found:', req.method, req.path, req.originalUrl);
  console.log('📋 Available routes:');
  console.log('  ✅ GET /api/ads/test');
  console.log('  ✅ POST /api/ads (admin) - CREATE AD');
  console.log('  ✅ GET /api/ads/all (admin)');
  console.log('  ✅ GET /api/ads/position/:position');
  console.log('  ✅ GET /api/ads');
  console.log('  ✅ POST /api/ads/:id/click');
  console.log('  ✅ PUT /api/ads/:id (admin)');
  console.log('  ✅ DELETE /api/ads/:id (admin)');
  console.log('🔍 Request details:');
  console.log('  Method:', req.method);
  console.log('  Path:', req.path);
  console.log('  OriginalUrl:', req.originalUrl);
  console.log('  Headers:', JSON.stringify(req.headers, null, 2));
  res.status(404).json({
    success: false,
    message: 'Route not found',
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    hint: 'Check if backend is deployed with latest changes'
  });
});

// Export for Vercel serverless
// Vercel expects the app to be exported directly
module.exports = app;

