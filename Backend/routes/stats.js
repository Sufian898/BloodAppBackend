const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Request = require('../models/Request');

// Get statistics
router.get('/', async (req, res) => {
  try {
    // Ensure MongoDB connection
    const mongoose = require('mongoose');
    
    // Wait for connection if not ready
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected in stats, waiting...');
      let attempts = 0;
      while (mongoose.connection.readyState !== 1 && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          success: false,
          message: 'Database connection unavailable. Please try again.',
          error: 'Database not connected'
        });
      }
    }

    // Total donors (users who are available) - with timeout and maxTimeMS
    const totalDonors = await Promise.race([
      User.countDocuments({ isAvailable: true }).maxTimeMS(10000),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 12000))
    ]).catch(() => 0);

    // Total lives saved (sum of all donations count) - with timeout and maxTimeMS
    const users = await Promise.race([
      User.find({}).limit(1000).maxTimeMS(10000).lean(), // Limit to prevent huge queries
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 12000))
    ]).catch(() => []);
    const livesSaved = users.reduce((sum, user) => sum + (user.donationsCount || 0), 0);

    // Requests today - with timeout and maxTimeMS
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requestsToday = await Promise.race([
      Request.countDocuments({
        createdAt: { $gte: today }
      }).maxTimeMS(10000),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 12000))
    ]).catch(() => 0);

    // Recent requests (last 10) - all statuses (Pending, Completed, Fulfilled) - with timeout and maxTimeMS
    const recentRequests = await Promise.race([
      Request.find({})
        .maxTimeMS(10000)
        .populate('userId', 'name phone bloodGroup location email')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('bloodGroup location city urgency createdAt _id userId contact status')
        .lean(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 12000))
    ]).catch(() => []);

    res.json({
      success: true,
      stats: {
        totalDonors,
        livesSaved,
        requestsToday
      },
      recentRequests: recentRequests.map(req => ({
        _id: req._id,
        bloodGroup: req.bloodGroup,
        location: req.location || req.city,
        urgency: req.urgency,
        status: req.status || 'Pending', // Include status field
        createdAt: req.createdAt,
        userId: req.userId, // Ensure userId is included for chat functionality
        contact: req.contact // Ensure contact is included
      }))
    });
  } catch (error) {
    console.error('Get stats error:', error);
    console.error('Get stats error stack:', error.stack);
    
    // Handle specific error types
    if (error.message && (error.message.includes('timeout') || error.message.includes('buffering'))) {
      return res.status(503).json({
        success: false,
        message: 'Database connection timeout. Please try again in a moment.',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message || 'Unknown error'
    });
  }
});

module.exports = router;

