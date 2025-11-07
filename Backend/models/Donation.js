const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  donationDate: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  hospital: {
    type: String,
    default: ''
  },
  units: {
    type: Number,
    default: 1,
    min: 1
  },
  notes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

donationSchema.index({ userId: 1, donationDate: -1 });

module.exports = mongoose.model('Donation', donationSchema);

