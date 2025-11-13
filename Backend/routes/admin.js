const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Request = require('../models/Request');
const Donation = require('../models/Donation');
const adminAuth = require('../middleware/adminAuth');

// Get all users/donors
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get user by ID
router.get('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
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
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update user
router.put('/users/:id', adminAuth, async (req, res) => {
  try {
    const { name, email, phone, bloodGroup, location, isAvailable, role } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (bloodGroup) updateData.bloodGroup = bloodGroup;
    if (location !== undefined) updateData.location = location;
    if (typeof isAvailable === 'boolean') updateData.isAvailable = isAvailable;
    if (role) updateData.role = role;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete user
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    // Don't allow deleting yourself
    if (userId === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const user = await User.findByIdAndDelete(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Also delete user's donations and requests
    await Donation.deleteMany({ userId });
    await Request.deleteMany({ userId });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get all requests
router.get('/requests', adminAuth, async (req, res) => {
  try {
    const requests = await Request.find()
      .populate('userId', 'name email phone bloodGroup')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get request by ID
router.get('/requests/:id', adminAuth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('userId', 'name email phone bloodGroup');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    res.json({
      success: true,
      request
    });
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update request
router.put('/requests/:id', adminAuth, async (req, res) => {
  try {
    const { bloodGroup, units, location, hospital, urgency, status, notes } = req.body;
    
    const updateData = {};
    if (bloodGroup) updateData.bloodGroup = bloodGroup;
    if (units) updateData.units = units;
    if (location) updateData.location = location;
    if (hospital !== undefined) updateData.hospital = hospital;
    if (urgency) updateData.urgency = urgency;
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const request = await Request.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('userId', 'name email phone bloodGroup');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    res.json({
      success: true,
      message: 'Request updated successfully',
      request
    });
  } catch (error) {
    console.error('Update request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete request
router.delete('/requests/:id', adminAuth, async (req, res) => {
  try {
    const request = await Request.findByIdAndDelete(req.params.id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    res.json({
      success: true,
      message: 'Request deleted successfully'
    });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    // Count users: include users with role 'user' OR no role field (legacy users)
    const totalUsers = await User.countDocuments({
      $or: [
        { role: 'user' },
        { role: { $exists: false } },
        { role: null }
      ]
    });
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalRequests = await Request.countDocuments();
    const totalDonations = await Donation.countDocuments();
    // Active donors: users with isAvailable true and role 'user' or no role
    const activeDonors = await User.countDocuments({ 
      isAvailable: true,
      $or: [
        { role: 'user' },
        { role: { $exists: false } },
        { role: null }
      ]
    });
    // Status can be 'Pending', 'Fulfilled', or 'Cancelled' (capitalized)
    const pendingRequests = await Request.countDocuments({ 
      $or: [
        { status: 'Pending' },
        { status: 'pending' }
      ]
    });

    console.log('Admin stats:', {
      totalUsers,
      totalAdmins,
      totalRequests,
      totalDonations,
      activeDonors,
      pendingRequests
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalAdmins,
        totalRequests,
        totalDonations,
        activeDonors,
        pendingRequests
      }
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

