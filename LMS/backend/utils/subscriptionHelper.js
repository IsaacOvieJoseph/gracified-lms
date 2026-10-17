const User = require('../models/User');
const School = require('../models/School');

const getId = (obj) => {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;
  if (obj._id) return obj._id;
  return obj;
};

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
    if (user.trialEndDate && user.trialEndDate < Date.now()) {
      return false;
    }
    return true;
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

  const schoolIdField = classroom.schoolId;
  const hasSchool = Array.isArray(schoolIdField) ? schoolIdField.length > 0 : !!schoolIdField;

  // If classroom belongs to a school, check school admin's subscription
  if (hasSchool) {
    let adminId;
    const singleSchool = Array.isArray(schoolIdField) ? schoolIdField[0] : schoolIdField;

    if (singleSchool) {
      // Handle both populated and non-populated schoolId
      if (singleSchool.adminId) {
        // Already populated
        adminId = getId(singleSchool.adminId);
      } else {
        // Not populated, fetch school to get adminId
        const school = await School.findById(getId(singleSchool));
        if (school && school.adminId) {
          adminId = getId(school.adminId);
        }
      }
    }

    if (adminId) {
      const schoolAdmin = await User.findById(adminId);
      return isSubscriptionValid(schoolAdmin);
    }
  }

  // If classroom doesn't belong to a school, check personal teacher's subscription
  if (classroom.teacherId) {
    let teacher;
    const teacherRef = classroom.teacherId;
    // Already populated if it has _id and possibly subscription data
    if (teacherRef._id || teacherRef.subscriptionStatus || teacherRef.role) {
      teacher = teacherRef;
    } else {
      // Not populated, fetch it
      teacher = await User.findById(getId(teacherRef));
    }

    if (teacher && teacher.role === 'personal_teacher') {
      return isSubscriptionValid(teacher);
    }
  }

  // If we can't determine the owner or subscription, return false
  return false;
};

const shouldIncludeClassroomForUser = async (classroom, user) => {
  if (!user) return false;

  // For root_admin, always show all classrooms
  if (user.role === 'root_admin') return true;

  // For teachers, always show their own classes (no subscription check)
  if (user.role === 'teacher' && classroom.teacherId) {
    const teacherId = getId(classroom.teacherId);
    if (teacherId && teacherId.toString() === user._id.toString()) {
      return true;
    }
  }

  // For students, always show classes they're enrolled in (no subscription check)
  if (user.role === 'student') {
    const enrolledInStudents = classroom.students?.some((studentId) => {
      const sid = getId(studentId);
      return sid && sid.toString() === user._id.toString();
    });
    const enrolledInUser = user.enrolledClasses?.some((classId) => {
      const cid = getId(classId);
      const classroomId = getId(classroom);
      return cid && classroomId && cid.toString() === classroomId.toString();
    });
    if (enrolledInStudents || enrolledInUser) {
      return true;
    }
  }

  // For other users (school_admin, personal_teacher), check subscription
  const isValid = await isClassroomOwnerSubscriptionValid(classroom);
  return isValid;
};

/**
 * Filter classrooms to only include those with valid owner subscriptions
 * @param {Array} classrooms - Array of classroom objects
 * @param {Object} user - User object making the request
 * @returns {Promise<Array>} - Filtered array of classrooms
 */
const filterClassroomsBySubscription = async (classrooms, user) => {
  if (!Array.isArray(classrooms)) return [];

  if (user && user.role === 'root_admin') {
    return classrooms;
  }

  const validClassrooms = [];
  for (const classroom of classrooms) {
    const shouldInclude = await shouldIncludeClassroomForUser(classroom, user);
    if (shouldInclude) {
      validClassrooms.push(classroom);
    }
  }
  return validClassrooms;
};

/**
 * Filter assignments to only include those from classrooms with valid owner subscriptions
 * @param {Array} assignments - Array of assignment objects with populated classroomId
 * @param {Object} user - User object making the request
 * @returns {Promise<Array>} - Filtered array of assignments
 */
const filterAssignmentsBySubscription = async (assignments, user) => {
  if (!Array.isArray(assignments)) return [];

  if (user && user.role === 'root_admin') {
    return assignments;
  }

  const validAssignments = [];
  for (const assignment of assignments) {
    if (assignment.classroomId) {
      // For teachers, always show assignments from their own classes (no subscription check)
      if (user && user.role === 'teacher' && assignment.classroomId.teacherId) {
        const teacherId = getId(assignment.classroomId.teacherId);
        if (teacherId && teacherId.toString() === user._id.toString()) {
          validAssignments.push(assignment);
          continue;
        }
      }

      // For students, always show assignments from classes they're enrolled in (no subscription check)
      if (user && user.role === 'student') {
        const enrolledInStudents = assignment.classroomId.students?.some((studentId) => {
          const sid = getId(studentId);
          return sid && sid.toString() === user._id.toString();
        });
        const enrolledInUser = user.enrolledClasses?.some((classId) => {
          const cid = getId(classId);
          const classroomId = getId(assignment.classroomId);
          return cid && classroomId && cid.toString() === classroomId.toString();
        });
        if (enrolledInStudents || enrolledInUser) {
          validAssignments.push(assignment);
          continue;
        }
      }

      // For other users (school_admin, personal_teacher), check subscription
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
