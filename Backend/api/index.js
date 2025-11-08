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

// Connect to MongoDB
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log('✅ MongoDB Connected Successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    isConnected = false;
  }
};

// Initialize connection
connectDB();

// Routes
app.use('/api/auth', require('../routes/auth'));
app.use('/api/users', require('../routes/users'));
app.use('/api/donors', require('../routes/donors'));
app.use('/api/requests', require('../routes/requests'));
app.use('/api/stats', require('../routes/stats'));
app.use('/api/admin', require('../routes/admin'));
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
  res.status(404).json({ 
    success: false, 
    message: 'Route not found',
    path: req.path
  });
});

// Export for Vercel serverless
// @vercel/node automatically handles Express apps
module.exports = app;

