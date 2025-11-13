/**
 * Blood Group Compatibility Utility
 * Determines which blood groups can donate to which recipients
 */

// Blood group compatibility matrix
// Key: Donor blood group
// Value: Array of recipient blood groups that can receive from this donor
const compatibilityMatrix = {
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'O-': ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'], // Universal donor
  'A+': ['A+', 'AB+'],
  'A-': ['A+', 'A-', 'AB+', 'AB-'],
  'B+': ['B+', 'AB+'],
  'B-': ['B+', 'B-', 'AB+', 'AB-'],
  'AB+': ['AB+'], // Universal recipient
  'AB-': ['AB+', 'AB-']
};

/**
 * Check if a donor can donate to a recipient
 * @param {string} donorBloodGroup - Donor's blood group (e.g., 'O+')
 * @param {string} recipientBloodGroup - Recipient's blood group (e.g., 'A+')
 * @returns {boolean} - True if compatible
 */
function canDonateTo(donorBloodGroup, recipientBloodGroup) {
  if (!donorBloodGroup || !recipientBloodGroup) return false;
  
  const compatibleRecipients = compatibilityMatrix[donorBloodGroup];
  if (!compatibleRecipients) return false;
  
  return compatibleRecipients.includes(recipientBloodGroup);
}

/**
 * Get all compatible blood groups for a recipient
 * @param {string} recipientBloodGroup - Recipient's blood group
 * @returns {string[]} - Array of compatible donor blood groups
 */
function getCompatibleDonors(recipientBloodGroup) {
  const compatibleDonors = [];
  
  for (const [donorGroup, recipients] of Object.entries(compatibilityMatrix)) {
    if (recipients.includes(recipientBloodGroup)) {
      compatibleDonors.push(donorGroup);
    }
  }
  
  return compatibleDonors;
}

/**
 * Calculate priority score for donor matching
 * Higher score = better match
 * @param {Object} donor - Donor object
 * @param {Object} request - Blood request object
 * @param {Object} userLocation - User's location {latitude, longitude}
 * @returns {number} - Priority score (0-100)
 */
function calculateMatchScore(donor, request, userLocation = null) {
  let score = 0;
  
  // 1. Blood compatibility (40 points)
  if (canDonateTo(donor.bloodGroup, request.bloodGroup)) {
    score += 40;
    
    // Bonus for universal donors (O-) or perfect matches
    if (donor.bloodGroup === 'O-') {
      score += 5; // Universal donor bonus
    }
    if (donor.bloodGroup === request.bloodGroup) {
      score += 5; // Exact match bonus
    }
  } else {
    return 0; // Not compatible, return 0
  }
  
  // 2. Availability status (20 points)
  if (donor.isAvailable === true) {
    score += 20;
  }
  
  // 3. Distance (20 points) - closer is better
  if (userLocation && donor.latitude && donor.longitude) {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      donor.latitude,
      donor.longitude
    );
    
    // Score based on distance (km)
    if (distance < 5) score += 20; // Very close
    else if (distance < 10) score += 15;
    else if (distance < 20) score += 10;
    else if (distance < 50) score += 5;
    // Beyond 50km, no distance bonus
  } else {
    // If no location data, give medium score
    score += 10;
  }
  
  // 4. Last donation eligibility (10 points)
  if (donor.lastDonationDate) {
    const daysSinceLastDonation = getDaysSinceLastDonation(donor.lastDonationDate);
    const minDaysBetweenDonations = 56; // 8 weeks minimum
    
    if (daysSinceLastDonation >= minDaysBetweenDonations) {
      score += 10; // Eligible to donate
    } else {
      const daysUntilEligible = minDaysBetweenDonations - daysSinceLastDonation;
      // Reduce score if not yet eligible
      score += Math.max(0, 10 - (daysUntilEligible / 5));
    }
  } else {
    // Never donated, assume eligible
    score += 10;
  }
  
  // 5. Donation history (10 points) - more donations = more reliable
  const donationCount = donor.donationsCount || 0;
  if (donationCount > 10) score += 10;
  else if (donationCount > 5) score += 7;
  else if (donationCount > 0) score += 5;
  // New donors still get some points
  
  return Math.min(100, score); // Cap at 100
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} - Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Get days since last donation
 * @param {Date|string} lastDonationDate - Last donation date
 * @returns {number} - Days since last donation
 */
function getDaysSinceLastDonation(lastDonationDate) {
  if (!lastDonationDate) return 999; // Never donated
  
  const lastDate = new Date(lastDonationDate);
  const today = new Date();
  const diffTime = Math.abs(today - lastDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Check if donor is eligible to donate
 * @param {Object} donor - Donor object with lastDonationDate
 * @returns {Object} - {eligible: boolean, daysUntilEligible: number, nextEligibleDate: Date}
 */
function checkDonorEligibility(donor) {
  const minDaysBetweenDonations = 56; // 8 weeks (WHO recommendation)
  const maxDaysBetweenDonations = 365; // 1 year (recommended max)
  
  if (!donor.lastDonationDate) {
    return {
      eligible: true,
      daysUntilEligible: 0,
      nextEligibleDate: new Date(),
      daysSinceLastDonation: 0
    };
  }
  
  const daysSince = getDaysSinceLastDonation(donor.lastDonationDate);
  const eligible = daysSince >= minDaysBetweenDonations;
  
  const lastDate = new Date(donor.lastDonationDate);
  const nextEligibleDate = new Date(lastDate);
  nextEligibleDate.setDate(nextEligibleDate.getDate() + minDaysBetweenDonations);
  
  const daysUntilEligible = eligible ? 0 : (minDaysBetweenDonations - daysSince);
  
  return {
    eligible,
    daysUntilEligible,
    nextEligibleDate,
    daysSinceLastDonation: daysSince
  };
}

module.exports = {
  canDonateTo,
  getCompatibleDonors,
  calculateMatchScore,
  calculateDistance,
  getDaysSinceLastDonation,
  checkDonorEligibility,
  compatibilityMatrix
};

