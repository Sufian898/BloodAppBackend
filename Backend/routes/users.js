const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Donation = require('../models/Donation');
const authMiddleware = require('../middleware/auth');

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, location, bloodGroup, isAvailable } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (location) updateData.location = location;
    if (bloodGroup) updateData.bloodGroup = bloodGroup;
    if (typeof isAvailable === 'boolean') updateData.isAvailable = isAvailable;

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get donations history
router.get('/donations', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get actual donation records from Donation collection
    const donationRecords = await Donation.find({ userId: req.userId })
      .sort({ donationDate: -1 })
      .select('_id donationDate location hospital units notes');

    // Format donations for response
    const donations = donationRecords.map(donation => ({
      _id: donation._id,
      date: donation.donationDate,
      location: donation.location,
      hospital: donation.hospital,
      units: donation.units,
      notes: donation.notes,
      bloodGroup: user.bloodGroup
    }));

    res.json({
      success: true,
      donations,
      totalDonations: user.donationsCount,
      lastDonationDate: user.lastDonationDate
    });
  } catch (error) {
    console.error('Get donations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update last donation date
router.put('/donation', authMiddleware, async (req, res) => {
  try {
    const { donationDate, location, hospital, units, notes } = req.body;
    
    const actualDonationDate = donationDate ? new Date(donationDate) : new Date();
    const donationUnits = units || 1;

    // Create donation record
    const donation = new Donation({
      userId: req.userId,
      donationDate: actualDonationDate,
      location: location || 'Not specified',
      hospital: hospital || '',
      units: donationUnits,
      notes: notes || ''
    });

    await donation.save();

    // Update user's donation count and last donation date
    const updateData = {
      lastDonationDate: actualDonationDate,
      $inc: { donationsCount: donationUnits }
    };

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Donation recorded successfully',
      user,
      donation
    });
  } catch (error) {
    console.error('Update donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Upload profile image
router.put('/profile-image', authMiddleware, async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Image is required'
      });
    }

    // Store base64 image string in database
    // In production, you might want to upload to cloud storage (AWS S3, Cloudinary, etc.)
    const imageDataUri = `data:image/jpeg;base64,${image}`;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { profileImage: imageDataUri },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile image updated successfully',
      user
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update donation
router.put('/donations/:id', authMiddleware, async (req, res) => {
  try {
    const { donationDate, location, hospital, units, notes } = req.body;
    const donationId = req.params.id;

    // Verify donation belongs to user
    const donation = await Donation.findOne({ _id: donationId, userId: req.userId });
    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    // Update donation
    const updateData = {};
    if (donationDate) updateData.donationDate = new Date(donationDate);
    if (location) updateData.location = location;
    if (hospital !== undefined) updateData.hospital = hospital;
    if (units) updateData.units = units;
    if (notes !== undefined) updateData.notes = notes;

    const updatedDonation = await Donation.findByIdAndUpdate(
      donationId,
      updateData,
      { new: true }
    );

    res.json({
      success: true,
      message: 'Donation updated successfully',
      donation: updatedDonation
    });
  } catch (error) {
    console.error('Update donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete donation
router.delete('/donations/:id', authMiddleware, async (req, res) => {
  try {
    const donationId = req.params.id;

    console.log('Delete request - Donation ID:', donationId, 'User ID:', req.userId);

    // Verify donation belongs to user
    const donation = await Donation.findOne({ _id: donationId, userId: req.userId });
    if (!donation) {
      console.log('Donation not found or does not belong to user');
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    console.log('Donation found, proceeding with deletion');

    // Delete donation
    await Donation.findByIdAndDelete(donationId);

    // Update user's donation count
    const user = await User.findById(req.userId);
    if (user) {
      const newCount = Math.max(0, (user.donationsCount || 0) - (donation.units || 1));
      
      // Get most recent remaining donation
      const mostRecentDonation = await Donation.findOne({ userId: req.userId })
        .sort({ donationDate: -1 });
      
      await User.findByIdAndUpdate(req.userId, {
        donationsCount: newCount,
        lastDonationDate: mostRecentDonation ? mostRecentDonation.donationDate : null
      });
    }

    res.json({
      success: true,
      message: 'Donation deleted successfully'
    });
  } catch (error) {
    console.error('Delete donation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

