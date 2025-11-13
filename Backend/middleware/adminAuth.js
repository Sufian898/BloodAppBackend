const jwt = require('jsonwebtoken');
const User = require('../models/User');

const adminAuth = async (req, res, next) => {
  try {
    console.log('AdminAuth middleware called for:', req.method, req.path);
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      console.log('No token provided');
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your_secret_key_here_change_in_production'
    );

    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log('User not found for userId:', decoded.userId);
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'admin') {
      console.log('User is not admin, role:', user.role);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    console.log('AdminAuth passed for user:', user.email);
    req.userId = decoded.userId;
    req.user = user;
    next();
  } catch (error) {
    console.error('AdminAuth error:', error.message);
    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};

module.exports = adminAuth;

