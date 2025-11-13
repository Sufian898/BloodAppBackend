const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendPasswordResetEmail } = require('../utils/emailService');

// Register
router.post('/register', async (req, res) => {
  try {
    const { 
      name, email, phone, password, bloodGroup, location,
      gender, dateOfBirth, age, city, area, postalCode,
      donorRecipientStatus, lastDonationDate, weight, height,
      medicalConditions, allergies, emergencyContact,
      preferredCommunication, nationality, agreementAccepted,
      healthQuestionnaire
    } = req.body;

    // Validation
    if (!name || !email || !phone || !password || !bloodGroup) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Validate agreement acceptance
    if (!agreementAccepted) {
      return res.status(400).json({
        success: false,
        message: 'You must accept the user agreement to register'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Parse location if it's a string with city, area, postalCode
    let finalLocation = location || '';
    if (city && area && postalCode) {
      finalLocation = `${city}, ${area}, ${postalCode}`;
    }

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

    // Create user
    const user = new User({
      name,
      email: email.toLowerCase().trim(),
      phone,
      password: hashedPassword,
      bloodGroup,
      location: finalLocation,
      gender: gender || '',
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      age: age || '',
      city: city || '',
      area: area || '',
      postalCode: postalCode || '',
      donorRecipientStatus: donorRecipientStatus || '',
      lastDonationDate: lastDonationDate ? new Date(lastDonationDate) : null,
      weight: weight || '',
      height: height || '',
      medicalConditions: medicalConditions || '',
      allergies: allergies || '',
      emergencyContact: emergencyContact || '',
      preferredCommunication: preferredCommunication || '',
      nationality: nationality || '',
      agreementAccepted: true,
      agreementAcceptedAt: new Date(),
      healthQuestionnaire: healthQuestionnaire ? {
        diabetes: healthQuestionnaire.diabetes || null,
        heartLungProblems: healthQuestionnaire.heartLungProblems || null,
        covid19Last28Days: healthQuestionnaire.covid19Last28Days || null,
        hivPositive: healthQuestionnaire.hivPositive || null,
        cancer: healthQuestionnaire.cancer || null,
        vaccinationLast3Months: healthQuestionnaire.vaccinationLast3Months || null,
        completedAt: new Date()
      } : undefined
    });

    console.log('Creating user with data:', {
      name: user.name,
      email: user.email,
      phone: user.phone,
      bloodGroup: user.bloodGroup,
      gender: user.gender,
      city: user.city,
      area: user.area,
      postalCode: user.postalCode,
      age: user.age,
      weight: user.weight,
      height: user.height,
      medicalConditions: user.medicalConditions,
      allergies: user.allergies,
      emergencyContact: user.emergencyContact,
      preferredCommunication: user.preferredCommunication,
      nationality: user.nationality,
      donorRecipientStatus: user.donorRecipientStatus,
      location: user.location
    });

    await Promise.race([
      user.save(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database save timeout')), 8000))
    ]).catch((error) => {
      console.error('User save error:', error);
      throw error;
    });

    console.log('User registered successfully:', user.email);

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your_secret_key_here_change_in_production',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        bloodGroup: user.bloodGroup,
        location: user.location,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        age: user.age,
        city: user.city,
        area: user.area,
        postalCode: user.postalCode,
        donorRecipientStatus: user.donorRecipientStatus,
        lastDonationDate: user.lastDonationDate,
        weight: user.weight,
        height: user.height,
        medicalConditions: user.medicalConditions,
        allergies: user.allergies,
        emergencyContact: user.emergencyContact,
        preferredCommunication: user.preferredCommunication,
        nationality: user.nationality
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    console.error('Register error stack:', error.stack);
    
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

    // Handle duplicate key error (email already exists)
    if (error.code === 11000 || error.message.includes('duplicate')) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
        error: 'Duplicate email'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message || 'Unknown error'
    });
  }
});

// Update health questionnaire - MUST be before dynamic routes like /login
router.put('/health-questionnaire', require('../middleware/auth'), async (req, res) => {
  try {
    const { diabetes, heartLungProblems, covid19Last28Days, hivPositive, cancer, vaccinationLast3Months } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.healthQuestionnaire = {
      diabetes: diabetes !== undefined ? diabetes : user.healthQuestionnaire?.diabetes || null,
      heartLungProblems: heartLungProblems !== undefined ? heartLungProblems : user.healthQuestionnaire?.heartLungProblems || null,
      covid19Last28Days: covid19Last28Days !== undefined ? covid19Last28Days : user.healthQuestionnaire?.covid19Last28Days || null,
      hivPositive: hivPositive !== undefined ? hivPositive : user.healthQuestionnaire?.hivPositive || null,
      cancer: cancer !== undefined ? cancer : user.healthQuestionnaire?.cancer || null,
      vaccinationLast3Months: vaccinationLast3Months !== undefined ? vaccinationLast3Months : user.healthQuestionnaire?.vaccinationLast3Months || null,
      completedAt: new Date()
    };

    await user.save();

    res.json({
      success: true,
      message: 'Health questionnaire updated successfully',
      healthQuestionnaire: user.healthQuestionnaire
    });
  } catch (error) {
    console.error('Update health questionnaire error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    // Ensure MongoDB connection
    const mongoose = require('mongoose');
    
    // Wait for connection if not ready
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB not connected in login, waiting...');
      // Wait up to 5 seconds for connection
      let attempts = 0;
      while (mongoose.connection.readyState !== 1 && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      // If still not connected, return error
      if (mongoose.connection.readyState !== 1) {
        console.error('MongoDB connection failed in login route');
        return res.status(503).json({
          success: false,
          message: 'Database connection unavailable. Please try again.',
          error: 'Database not connected'
        });
      }
    }

    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user (email is automatically lowercase in schema) - with timeout
    // Use maxTimeMS to prevent buffering timeout
    const user = await Promise.race([
      User.findOne({ email: email.toLowerCase().trim() }).maxTimeMS(10000).lean(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), 12000))
    ]).catch((error) => {
      console.error('User find error:', error);
      throw error;
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your_secret_key_here_change_in_production',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        bloodGroup: user.bloodGroup,
        location: user.location,
        donationsCount: user.donationsCount || 0,
        lastDonationDate: user.lastDonationDate,
        isAvailable: user.isAvailable,
        role: user.role || 'user',
        gender: user.gender || '',
        dateOfBirth: user.dateOfBirth || '',
        age: user.age || '',
        city: user.city || '',
        area: user.area || '',
        postalCode: user.postalCode || '',
        donorRecipientStatus: user.donorRecipientStatus || '',
        weight: user.weight || '',
        height: user.height || '',
        medicalConditions: user.medicalConditions || '',
        allergies: user.allergies || '',
        emergencyContact: user.emergencyContact || '',
        preferredCommunication: user.preferredCommunication || '',
        nationality: user.nationality || '',
        profileImage: user.profileImage || '',
        showContactDetails: user.showContactDetails !== undefined ? user.showContactDetails : true
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Login error stack:', error.stack);
    
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
      message: 'Server error during login',
      error: error.message || 'Unknown error'
    });
  }
});

// Forgot Password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email address'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user._id, type: 'password-reset' },
      process.env.JWT_SECRET || 'your_secret_key_here_change_in_production',
      { expiresIn: '1h' }
    );

    // Create reset URL (for mobile app, this will be a deep link)
    // For now, we'll use a simple URL that the app can handle
    const resetUrl = `bloodapp://reset-password?token=${resetToken}`;
    // Alternative: If you have a web app, use: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(user.email, resetToken, resetUrl);

    // If email was sent successfully, don't send token
    if (emailResult.success && emailResult.messageId) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent to your email.',
      });
    }

    // If email service is not configured, return token for development/testing
    res.json({
      success: true,
      message: 'Email service not configured. Please use the token below to reset your password.',
      resetToken: emailResult.token || resetToken, // Return token for development/testing
      emailSent: false
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Reset Password - Set new password
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    // Validation
    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide reset token and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(
        resetToken,
        process.env.JWT_SECRET || 'your_secret_key_here_change_in_production'
      );
      
      if (decoded.type !== 'password-reset') {
        return res.status(400).json({
          success: false,
          message: 'Invalid reset token'
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

