const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Donation = require('../models/Donation');
const { getCompatibleDonors, calculateMatchScore, checkDonorEligibility, calculateDistance } = require('../utils/bloodCompatibility');

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

// Smart matching: Get compatible donors for a blood request
router.get('/match/:requestId', async (req, res) => {
  try {
    const Request = require('../models/Request');
    const request = await Request.findById(req.params.requestId);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Get compatible blood groups for this request
    const compatibleBloodGroups = getCompatibleDonors(request.bloodGroup);
    
    // Get all eligible donors with compatible blood groups
    const usersWithDonations = await Donation.distinct('userId');
    
    let query = {
      _id: { $in: usersWithDonations },
      bloodGroup: { $in: compatibleBloodGroups },
      isAvailable: true,
      $or: [
        { role: { $ne: 'admin' } },
        { role: { $exists: false } },
        { role: null }
      ]
    };

    const donors = await User.find(query)
      .select('-password')
      .lean();

    // Calculate match scores and eligibility for each donor
    const userLocation = req.query.latitude && req.query.longitude 
      ? { latitude: parseFloat(req.query.latitude), longitude: parseFloat(req.query.longitude) }
      : null;

    const matchedDonors = donors.map(donor => {
      const eligibility = checkDonorEligibility(donor);
      const matchScore = calculateMatchScore(donor, request, userLocation);
      
      return {
        ...donor,
        eligibility,
        matchScore,
        distance: userLocation && donor.latitude && donor.longitude
          ? calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              donor.latitude,
              donor.longitude
            )
          : null
      };
    })
    .filter(donor => donor.matchScore > 0) // Only compatible donors
    .sort((a, b) => b.matchScore - a.matchScore) // Sort by match score (best first)
    .slice(0, 50); // Limit to top 50 matches

    res.json({
      success: true,
      count: matchedDonors.length,
      request: {
        bloodGroup: request.bloodGroup,
        urgency: request.urgency,
        location: request.location
      },
      donors: matchedDonors
    });
  } catch (error) {
    console.error('Smart matching error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get donor dashboard with eligibility info
// IMPORTANT: This route must be defined BEFORE /:id to avoid route conflicts
router.get('/dashboard/:id', async (req, res) => {
  try {
    console.log('Dashboard route called with ID:', req.params.id);
    const donor = await User.findById(req.params.id).select('-password').lean();
    
    if (!donor) {
      return res.status(404).json({
        success: false,
        message: 'Donor not found'
      });
    }

    // Get eligibility information
    const eligibility = checkDonorEligibility(donor);
    
    // Get donation history
    const donations = await Donation.find({ userId: req.params.id })
      .sort({ donationDate: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      donor: {
        ...donor,
        eligibility
      },
      donations,
      stats: {
        totalDonations: donor.donationsCount || 0,
        isEligible: eligibility.eligible,
        daysUntilEligible: eligibility.daysUntilEligible,
        nextEligibleDate: eligibility.nextEligibleDate,
        daysSinceLastDonation: eligibility.daysSinceLastDonation
      }
    });
  } catch (error) {
    console.error('Get donor dashboard error:', error);
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
    const donor = await User.findById(req.params.id).select('-password').lean();
    
    if (!donor) {
      return res.status(404).json({
        success: false,
        message: 'Donor not found'
      });
    }

    // Add eligibility info
    const eligibility = checkDonorEligibility(donor);

    res.json({
      success: true,
      donor: {
        ...donor,
        eligibility
      }
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

