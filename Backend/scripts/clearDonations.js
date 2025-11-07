const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const User = require('../models/User');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sufianali122nb:1234sufi@cluster0.0qnf0nx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function clearDonations() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // Count donations before deletion
    const donationCount = await Donation.countDocuments();
    console.log(`Found ${donationCount} donation records`);

    if (donationCount === 0) {
      console.log('No donations to clear');
      process.exit(0);
    }

    // Delete all donations
    const result = await Donation.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} donation records`);

    // Reset user donation counts and last donation dates
    const userUpdateResult = await User.updateMany(
      {},
      {
        $set: {
          donationsCount: 0,
          lastDonationDate: null
        }
      }
    );
    console.log(`✅ Reset donation counts for ${userUpdateResult.modifiedCount} users`);

    // Verify deletion
    const remainingCount = await Donation.countDocuments();
    console.log(`Remaining donations: ${remainingCount}`);

    console.log('\n✅ All donations cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing donations:', error);
    process.exit(1);
  }
}

clearDonations();

