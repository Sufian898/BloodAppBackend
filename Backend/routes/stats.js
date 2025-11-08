const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Request = require('../models/Request');

// Get statistics
router.get('/', async (req, res) => {
  try {
    // Total donors (users who are available)
    const totalDonors = await User.countDocuments({ isAvailable: true });

    // Total lives saved (sum of all donations count)
    const users = await User.find({});
    const livesSaved = users.reduce((sum, user) => sum + (user.donationsCount || 0), 0);

    // Requests today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requestsToday = await Request.countDocuments({
      createdAt: { $gte: today }
    });

    // Recent requests (last 5) - only non-deleted requests
    // Note: MongoDB doesn't have soft delete by default, so we just get existing requests
    const recentRequests = await Request.find({ status: 'Pending' })
      .populate('userId', 'name phone bloodGroup location email')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('bloodGroup location city urgency createdAt _id userId contact');

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
        createdAt: req.createdAt
      }))
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

