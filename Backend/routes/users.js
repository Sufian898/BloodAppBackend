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

    // Convert user to plain object and ensure all fields are included
    const userObject = user.toObject ? user.toObject() : user;
    
    // Ensure healthQuestionnaire is included (even if null/empty)
    userObject.healthQuestionnaire = user.healthQuestionnaire || null;
    
    // Log for debugging
    console.log('Profile API - Returning user data for:', userObject.email);
    console.log('Profile fields:', Object.keys(userObject));
    console.log('Health Questionnaire:', userObject.healthQuestionnaire);

    res.json({
      success: true,
      user: userObject
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
    // Ensure MongoDB connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          success: false,
          message: 'Database connection unavailable. Please try again.',
          error: 'Database not connected'
        });
      }
    }

    const { 
      name, phone, location, bloodGroup, isAvailable,
      gender, dateOfBirth, age, city, area, postalCode,
      donorRecipientStatus, lastDonationDate, weight, height,
      medicalConditions, allergies, emergencyContact,
      preferredCommunication, nationality, showContactDetails
    } = req.body;
    
    const updateData = {};
    
    // Update basic fields
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (bloodGroup !== undefined) updateData.bloodGroup = bloodGroup;
    if (typeof isAvailable === 'boolean') updateData.isAvailable = isAvailable;
    
    // Update location fields
    if (city !== undefined) updateData.city = city || '';
    if (area !== undefined) updateData.area = area || '';
    if (postalCode !== undefined) updateData.postalCode = postalCode || '';
    
    // Update location string if city, area, postalCode are provided
    if (city !== undefined || area !== undefined || postalCode !== undefined) {
      const locationParts = [
        updateData.city || city || '',
        updateData.area || area || '',
        updateData.postalCode || postalCode || ''
      ].filter(Boolean);
      updateData.location = locationParts.length > 0 ? locationParts.join(', ') : (location || '');
    } else if (location !== undefined) {
      updateData.location = location;
    }
    
    // Update personal information
    if (gender !== undefined) updateData.gender = gender || '';
    if (dateOfBirth !== undefined) {
      updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }
    if (age !== undefined) updateData.age = age || '';
    if (donorRecipientStatus !== undefined) updateData.donorRecipientStatus = donorRecipientStatus || '';
    
    // Update physical information
    if (weight !== undefined) updateData.weight = weight || '';
    if (height !== undefined) updateData.height = height || '';
    
    // Update medical information
    if (medicalConditions !== undefined) updateData.medicalConditions = medicalConditions || '';
    if (allergies !== undefined) updateData.allergies = allergies || '';
    
    // Update contact information
    if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact || '';
    if (preferredCommunication !== undefined) updateData.preferredCommunication = preferredCommunication || '';
    if (nationality !== undefined) updateData.nationality = nationality || '';
    
    // Update donation date
    if (lastDonationDate !== undefined) {
      updateData.lastDonationDate = lastDonationDate ? new Date(lastDonationDate) : null;
    }
    
    // Update contact visibility setting
    if (typeof showContactDetails === 'boolean') {
      updateData.showContactDetails = showContactDetails;
    }

    console.log('Updating profile with data:', updateData);

    const user = await Promise.race([
      User.findByIdAndUpdate(
        req.userId,
        updateData,
        { new: true, runValidators: true }
      ).select('-password').lean(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), 8000))
    ]).catch((error) => {
      console.error('User update error:', error);
      throw error;
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('Profile updated successfully for user:', user.email);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    console.error('Update profile error stack:', error.stack);
    
    // Handle specific error types
    if (error.message && error.message.includes('timeout')) {
      return res.status(503).json({
        success: false,
        message: 'Database connection timeout. Please try again.',
        error: error.message
      });
    }
    
    if (error.message && error.message.includes('buffering')) {
      return res.status(503).json({
        success: false,
        message: 'Database is connecting. Please try again in a moment.',
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

