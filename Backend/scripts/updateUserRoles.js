const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sufianali122nb:1234sufi@cluster0.0qnf0nx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function updateUserRoles() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // Find all users without role field or with null role
    const usersWithoutRole = await User.find({
      $or: [
        { role: { $exists: false } },
        { role: null }
      ]
    });

    console.log(`Found ${usersWithoutRole.length} users without role field`);

    // Update all users without role to have role: 'user' (except admins)
    const result = await User.updateMany(
      {
        $or: [
          { role: { $exists: false } },
          { role: null }
        ],
        role: { $ne: 'admin' } // Don't update admins
      },
      {
        $set: { role: 'user' }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} users with role: 'user'`);

    // Count total users and admins
    const totalUsers = await User.countDocuments({
      $or: [
        { role: 'user' },
        { role: { $exists: false } },
        { role: null }
      ]
    });
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalAll = await User.countDocuments();

    console.log('\n📊 User Statistics:');
    console.log(`   Total Users (role='user'): ${totalUsers}`);
    console.log(`   Total Admins (role='admin'): ${totalAdmins}`);
    console.log(`   Total All Users: ${totalAll}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating user roles:', error);
    process.exit(1);
  }
}

updateUserRoles();

