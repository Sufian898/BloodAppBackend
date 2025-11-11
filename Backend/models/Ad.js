const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['google', 'personal'],
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    default: ''
  },
  linkUrl: {
    type: String,
    default: ''
  },
  googleAdCode: {
    type: String,
    default: '' // For Google AdSense code
  },
  position: {
    type: String,
    enum: ['top', 'middle', 'bottom'],
    default: 'middle'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  clickCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

adSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Ad', adSchema);

