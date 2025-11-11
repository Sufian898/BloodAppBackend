const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  bloodGroup: {
    type: String,
    required: true,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  location: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  area: {
    type: String,
    default: ''
  },
  postalCode: {
    type: String,
    default: ''
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    default: ''
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  age: {
    type: String,
    default: ''
  },
  donorRecipientStatus: {
    type: String,
    enum: ['Donor', 'Recipient', 'Both'],
    default: ''
  },
  weight: {
    type: String,
    default: ''
  },
  height: {
    type: String,
    default: ''
  },
  medicalConditions: {
    type: String,
    default: ''
  },
  allergies: {
    type: String,
    default: ''
  },
  emergencyContact: {
    type: String,
    default: ''
  },
  preferredCommunication: {
    type: String,
    enum: ['Email', 'SMS', 'Phone Call', 'WhatsApp'],
    default: ''
  },
  nationality: {
    type: String,
    default: ''
  },
  latitude: {
    type: Number,
    default: null
  },
  longitude: {
    type: Number,
    default: null
  },
  profileImage: {
    type: String,
    default: null
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  lastDonationDate: {
    type: Date,
    default: null
  },
  donationsCount: {
    type: Number,
    default: 0
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  agreementAccepted: {
    type: Boolean,
    default: false
  },
  agreementAcceptedAt: {
    type: Date,
    default: null
  },
  showContactDetails: {
    type: Boolean,
    default: true
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

userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);

