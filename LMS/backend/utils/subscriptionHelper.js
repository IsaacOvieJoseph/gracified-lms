const User = require('../models/User');
const School = require('../models/School');

/**
 * Check if a user's subscription is valid (active, pay_as_you_go, or valid trial)
 * @param {Object} user - User object with subscriptionStatus and trialEndDate
 * @returns {boolean} - True if subscription is valid, false otherwise
 */
const isSubscriptionValid = (user) => {
  if (!user) return false;

  if (user.role === 'root_admin') return true;

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
 * Teachers and students are not blocked by subscription checks
 * @param {Array} classrooms - Array of classroom objects
 * @param {Object} user - Current user object (optional)
 * @returns {Promise<Array>} - Filtered array of classrooms
 */
const filterClassroomsBySubscription = async (classrooms, user = null) => {
  const validClassrooms = [];

  // For root_admin, always show all classrooms
  if (user && user.role === 'root_admin') {
    return classrooms;
  }

  for (const classroom of classrooms) {
    // For teachers, always show their own classes (no subscription check)
    if (user && user.role === 'teacher' && classroom.teacherId) {
      const teacherId = classroom.teacherId._id || classroom.teacherId;
      if (teacherId.toString() === user._id.toString()) {
        validClassrooms.push(classroom);
        continue;
      }
    }

    // For students, always show classes they're enrolled in (no subscription check)
    if (user && user.role === 'student') {
      const isEnrolled = classroom.students?.some(
        studentId => (studentId._id || studentId).toString() === user._id.toString()
      ) || user.enrolledClasses?.some(
        classId => classId.toString() === (classroom._id || classroom).toString()
      );
      if (isEnrolled) {
        validClassrooms.push(classroom);
        continue;
      }
    }

    // For other users (school_admin, personal_teacher, root_admin), check subscription
    const isValid = await isClassroomOwnerSubscriptionValid(classroom);
    if (isValid) {
      validClassrooms.push(classroom);
    }
  }

  return validClassrooms;
};

/**
 * Filter assignments to only include those from classrooms with valid owner subscriptions
 * Teachers and students are not blocked by subscription checks
 * @param {Array} assignments - Array of assignment objects with populated classroomId
 * @param {Object} user - Current user object (optional)
 * @returns {Promise<Array>} - Filtered array of assignments
 */
const filterAssignmentsBySubscription = async (assignments, user = null) => {
  const validAssignments = [];

  // For root_admin, always show all assignments
  if (user && user.role === 'root_admin') {
    return assignments;
  }

  for (const assignment of assignments) {
    if (assignment.classroomId) {
      // For teachers, always show assignments from their own classes (no subscription check)
      if (user && user.role === 'teacher' && assignment.classroomId.teacherId) {
        const teacherId = assignment.classroomId.teacherId._id || assignment.classroomId.teacherId;
        if (teacherId && teacherId.toString() === user._id.toString()) {
          validAssignments.push(assignment);
          continue;
        }
      }

      // For students, always show assignments from classes they're enrolled in (no subscription check)
      if (user && user.role === 'student' && assignment.classroomId.students) {
        const isEnrolled = assignment.classroomId.students.some(
          studentId => (studentId._id || studentId).toString() === user._id.toString()
        );
        if (isEnrolled) {
          validAssignments.push(assignment);
          continue;
        }
      }

      // For other users (school_admin, personal_teacher, root_admin), check subscription
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

