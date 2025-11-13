const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const authMiddleware = require('../middleware/auth');
const adminAuthMiddleware = require('../middleware/adminAuth');

// Debug: Log route registration
console.log('✅ Ads routes module loaded');
console.log('Ads routes registered:');
console.log('  1. GET /all (admin)');
console.log('  2. GET /position/:position (public)');
console.log('  3. POST / (admin) - CREATE AD');
console.log('  4. GET / (public)');
console.log('  5. POST /:id/click (public)');
console.log('  6. PUT /:id (admin)');
console.log('  7. DELETE /:id (admin)');

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Ads router is working!' });
});

// Upload ad image (admin only) - MUST come before POST /
router.post('/upload-image', adminAuthMiddleware, async (req, res) => {
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

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: imageDataUri
    });
  } catch (error) {
    console.error('Upload ad image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// IMPORTANT: POST / MUST come before GET / to avoid route matching issues
// Create personal ad (admin only) - MUST be before GET / and POST /:id/click
router.post('/', async (req, res, next) => {
  console.log('=== POST /api/ads ROUTE HIT ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('OriginalUrl:', req.originalUrl);
  next();
}, adminAuthMiddleware, async (req, res) => {
  console.log('=== POST /api/ads HANDLER EXECUTING ===');
  
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
      type,
      title,
      description,
      imageUrl,
      linkUrl,
      position,
      isActive
    } = req.body;

    console.log('Creating ad with data:', { type, title, imageUrl, linkUrl, position, isActive });

    // Only allow personal ads to be created by admin
    if (type !== 'personal') {
      return res.status(400).json({
        success: false,
        message: 'Only personal ads can be created. Google ads are managed separately.'
      });
    }

    // All fields are optional now

    const ad = new Ad({
      type: 'personal',
      title,
      description: description || '',
      imageUrl,
      linkUrl,
      position: position || 'middle',
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.userId
    });

    await Promise.race([
      ad.save(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database save timeout')), 8000))
    ]).catch((error) => {
      console.error('Ad save error:', error);
      throw error;
    });

    console.log('Ad created successfully:', ad._id);

    res.status(201).json({
      success: true,
      message: 'Ad created successfully',
      ad
    });
  } catch (error) {
    console.error('Create ad error:', error);
    console.error('Create ad error stack:', error.stack);
    
    // Handle specific error types
    if (error.message && error.message.includes('timeout')) {
      return res.status(503).json({
        success: false,
        message: 'Database connection timeout. Please try again.',
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

// Get all ads (admin only) - MUST come before dynamic routes
router.get('/all', adminAuthMiddleware, async (req, res) => {
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

    const ads = await Promise.race([
      Ad.find().sort({ createdAt: -1 }).lean(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), 8000))
    ]).catch((error) => {
      console.error('Ad find error:', error);
      throw error;
    });

    res.json({
      success: true,
      ads
    });
  } catch (error) {
    console.error('Get all ads error:', error);
    
    // Handle specific error types
    if (error.message && error.message.includes('timeout')) {
      return res.status(503).json({
        success: false,
        message: 'Database connection timeout. Please try again.',
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

// Get ads by position (public route) - MUST come after specific routes
router.get('/position/:position', async (req, res) => {
  try {
    const { position } = req.params;
    console.log('Get ads by position:', position);
    
    const ads = await Ad.find({
      isActive: true,
      position: position
    }).sort({ createdAt: -1 });
    
    console.log(`Found ${ads.length} ads for position: ${position}`);
    
    res.json({
      success: true,
      ads
    });
  } catch (error) {
    console.error('Get ads by position error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get all active ads (public route) - MUST come after POST / but before dynamic routes
router.get('/', async (req, res) => {
  try {
    const { position } = req.query;
    const query = { isActive: true };
    
    if (position) {
      query.position = position;
    }

    const ads = await Ad.find(query).sort({ createdAt: -1 });
    res.json({
      success: true,
      ads
    });
  } catch (error) {
    console.error('Get ads error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Track ad click - MUST come before /:id routes
router.post('/:id/click', async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    ad.clickCount = (ad.clickCount || 0) + 1;
    await ad.save();

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Track ad click error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update ad (admin only)
router.put('/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const {
      title,
      description,
      imageUrl,
      linkUrl,
      position,
      isActive
    } = req.body;

    const ad = await Ad.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    if (title !== undefined) ad.title = title;
    if (description !== undefined) ad.description = description;
    if (imageUrl !== undefined) ad.imageUrl = imageUrl;
    if (linkUrl !== undefined) ad.linkUrl = linkUrl;
    if (position !== undefined) ad.position = position;
    if (isActive !== undefined) ad.isActive = isActive;

    await ad.save();

    res.json({
      success: true,
      message: 'Ad updated successfully',
      ad
    });
  } catch (error) {
    console.error('Update ad error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete ad (admin only)
router.delete('/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const ad = await Ad.findByIdAndDelete(req.params.id);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    res.json({
      success: true,
      message: 'Ad deleted successfully'
    });
  } catch (error) {
    console.error('Delete ad error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

