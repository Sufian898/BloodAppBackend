const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const authMiddleware = require('../middleware/auth');

// Create blood request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { bloodGroup, units, location, city, hospital, urgency, contact, description } = req.body;

    if (!bloodGroup || !units || !location || !contact) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const request = new Request({
      userId: req.userId,
      bloodGroup,
      units,
      location,
      city: city || location,
      hospital: hospital || '',
      urgency: urgency || 'Normal',
      contact,
      description: description || ''
    });

    await request.save();

    res.status(201).json({
      success: true,
      message: 'Blood request created successfully',
      request
    });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get all requests
router.get('/', async (req, res) => {
  try {
    const { bloodGroup, urgency, status } = req.query;
    
    let query = {};
    
    if (bloodGroup) query.bloodGroup = bloodGroup;
    if (urgency) query.urgency = urgency;
    if (status) query.status = status;

    const requests = await Request.find(query)
      .populate('userId', 'name phone bloodGroup location')
      .populate('fulfilledBy', 'name phone')
      .sort({ createdAt: -1 })
      .limit(50);

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

// Get user's requests
router.get('/my-requests', authMiddleware, async (req, res) => {
  try {
    const requests = await Request.find({ userId: req.userId })
      .populate('fulfilledBy', 'name phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update request status
router.put('/:id/fulfill', authMiddleware, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (request.status === 'Fulfilled') {
      return res.status(400).json({
        success: false,
        message: 'Request already fulfilled'
      });
    }

    request.status = 'Fulfilled';
    request.fulfilledBy = req.userId;
    await request.save();

    res.json({
      success: true,
      message: 'Request marked as fulfilled',
      request
    });
  } catch (error) {
    console.error('Fulfill request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete request
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (request.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this request'
      });
    }

    await Request.findByIdAndDelete(req.params.id);

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

module.exports = router;

