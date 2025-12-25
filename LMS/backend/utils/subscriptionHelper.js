const User = require('../models/User');
const School = require('../models/School');

/**
 * Check if a user's subscription is valid (active, pay_as_you_go, or valid trial)
 * @param {Object} user - User object with subscriptionStatus and trialEndDate
 * @returns {boolean} - True if subscription is valid, false otherwise
 */
const isSubscriptionValid = (user) => {
  if (!user) return false;
  
  if (user.subscriptionStatus === 'trial') {
    // Trial is valid if not expired
    return !(user.trialEndDate && user.trialEndDate < Date.now());
  }
  
  // Active or pay_as_you_go subscriptions are valid
  return user.subscriptionStatus === 'active' || user.subscriptionStatus === 'pay_as_you_go';
};

/**
 * Check if a classroom owner's subscription is valid
 * @param {Object} classroom - Classroom object with schoolId and teacherId populated
 * @returns {Promise<boolean>} - True if owner's subscription is valid
 */
const isClassroomOwnerSubscriptionValid = async (classroom) => {
  if (!classroom) return false;
  
  // If classroom belongs to a school, check school admin's subscription
  if (classroom.schoolId) {
    let adminId;
    
    // Handle both populated and non-populated schoolId
    if (classroom.schoolId.adminId) {
      // Already populated
      adminId = classroom.schoolId.adminId._id || classroom.schoolId.adminId;
    } else {
      // Not populated, fetch school to get adminId
      const School = require('../models/School');
      const school = await School.findById(classroom.schoolId._id || classroom.schoolId);
      if (school && school.adminId) {
        adminId = school.adminId;
      }
    }
    
    if (adminId) {
      const schoolAdmin = await User.findById(adminId);
      return isSubscriptionValid(schoolAdmin);
    }
  }
  
  // If classroom doesn't belong to a school, check personal teacher's subscription
  if (classroom.teacherId) {
    // Handle both populated and non-populated teacherId
    let teacher;
    if (classroom.teacherId._id || classroom.teacherId.subscriptionStatus) {
      // Already populated
      teacher = classroom.teacherId;
    } else {
      // Not populated, fetch it
      teacher = await User.findById(classroom.teacherId);
    }
    
    if (teacher && teacher.role === 'personal_teacher') {
      return isSubscriptionValid(teacher);
    }
  }
  
  // If we can't determine the owner or subscription, return false
  return false;
};

/**
 * Filter classrooms to only include those with valid owner subscriptions
 * @param {Array} classrooms - Array of classroom objects
 * @returns {Promise<Array>} - Filtered array of classrooms
 */
const filterClassroomsBySubscription = async (classrooms) => {
  const validClassrooms = [];
  
  for (const classroom of classrooms) {
    const isValid = await isClassroomOwnerSubscriptionValid(classroom);
    if (isValid) {
      validClassrooms.push(classroom);
    }
  }
  
  return validClassrooms;
};

/**
 * Filter assignments to only include those from classrooms with valid owner subscriptions
 * @param {Array} assignments - Array of assignment objects with populated classroomId
 * @returns {Promise<Array>} - Filtered array of assignments
 */
const filterAssignmentsBySubscription = async (assignments) => {
  const validAssignments = [];
  
  for (const assignment of assignments) {
    if (assignment.classroomId) {
      const isValid = await isClassroomOwnerSubscriptionValid(assignment.classroomId);
      if (isValid) {
        validAssignments.push(assignment);
      }
    }
  }
  
  return validAssignments;
};

module.exports = {
  isSubscriptionValid,
  isClassroomOwnerSubscriptionValid,
  filterClassroomsBySubscription,
  filterAssignmentsBySubscription
};

