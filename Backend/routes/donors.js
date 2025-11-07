const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Donation = require('../models/Donation');

// Get all donors (only users who have filled the donation form)
router.get('/', async (req, res) => {
  try {
    const { bloodGroup, location, search } = req.query;
    
    // First, get all user IDs who have at least one donation record
    const usersWithDonations = await Donation.distinct('userId');
    
    console.log('Users with donations (count):', usersWithDonations.length);
    console.log('Sample user IDs:', usersWithDonations.slice(0, 3));
    
    if (usersWithDonations.length === 0) {
      console.log('No users with donations found');
      return res.json({
        success: true,
        count: 0,
        donors: []
      });
    }
    
    // Build base query - exclude admins
    let query = {
      _id: { $in: usersWithDonations }, // Only users who have donations
      $or: [
        { role: { $ne: 'admin' } },
        { role: { $exists: false } },
        { role: null }
      ]
    };
    
    if (bloodGroup) {
      query.bloodGroup = bloodGroup;
    }
    
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }
    
    // Handle search - combine with existing $or using $and
    if (search) {
      query.$and = [
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } }
          ]
        }
      ];
    }

    const donors = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    console.log('Donors found:', donors.length);
    console.log('Sample donor IDs:', donors.slice(0, 3).map(d => d._id));

    res.json({
      success: true,
      count: donors.length,
      donors
    });
  } catch (error) {
    console.error('Get donors error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get donor by ID
router.get('/:id', async (req, res) => {
  try {
    const donor = await User.findById(req.params.id).select('-password');
    
    if (!donor) {
      return res.status(404).json({
        success: false,
        message: 'Donor not found'
      });
    }

    res.json({
      success: true,
      donor
    });
  } catch (error) {
    console.error('Get donor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

