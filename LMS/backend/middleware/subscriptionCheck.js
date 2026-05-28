const Classroom = require('../models/Classroom');
const School = require('../models/School');
const User = require('../models/User');

const subscriptionCheck = async (req, res, next) => {
  const user = req.user;

  try {
    // Global toggle (Root Admin can disable subscription gating entirely)
    const Settings = require('../models/Settings');
    const settings = await Settings.findOne();
    const isCheckingEnabled = settings ? settings.subscriptionCheckingEnabled : true;
    if (!isCheckingEnabled) {
      return next();
    }

    // Root admin has full access
    if (user.role === 'root_admin') {
      return next();
    }

    const enforceUserSubscription = (subUser, { trialExpiredMessage, subscriptionExpiredMessage, subscriptionRequiredMessage }) => {
      if (!subUser) {
        return res.status(403).json({ message: subscriptionRequiredMessage, subscriptionRequired: true });
      }

      // If on trial, check if trial period has expired
      if (subUser.subscriptionStatus === 'trial') {
        if (subUser.trialEndDate && subUser.trialEndDate < Date.now()) {
          return res.status(403).json({ message: trialExpiredMessage, trialExpired: true });
        }
      }
      // If on active plan, check if it has expired
      else if (subUser.subscriptionStatus === 'active') {
        if (subUser.subscriptionEndDate && new Date(subUser.subscriptionEndDate) < new Date()) {
          return res.status(403).json({ message: subscriptionExpiredMessage, subscriptionExpired: true });
        }
      }
      // If none of the above (none, canceled, expired), and NOT pay_as_you_go, deny access
      else if (subUser.subscriptionStatus !== 'pay_as_you_go') {
        return res.status(403).json({ message: subscriptionRequiredMessage, subscriptionRequired: true });
      }

      return null;
    };

    // For School Admin and Personal Teacher - check their own subscription
    if (user.role === 'school_admin' || user.role === 'personal_teacher') {
      const result = enforceUserSubscription(user, {
        trialExpiredMessage: 'Your trial period has expired. Please choose a subscription plan to continue.',
        subscriptionExpiredMessage: 'Your subscription has expired. Please renew your plan to continue.',
        subscriptionRequiredMessage: 'You do not have an active subscription. Please choose a plan.',
      });
      if (result) return result;
      return next();
    }

    // For Teachers - gate based on the school they belong to (school admin subscription)
    if (user.role === 'teacher') {
      const schoolIds = Array.isArray(user.schoolId) ? user.schoolId : (user.schoolId ? [user.schoolId] : []);
      const schoolId = schoolIds[0]?._id || schoolIds[0];

      // If teacher is not attached to a school, do not gate them here.
      // (Gating is school-dependent; personal teacher gating is handled above.)
      if (schoolId) {
        const school = await School.findById(schoolId).select('adminId');
        const adminId = school?.adminId?._id || school?.adminId;
        if (adminId) {
          const schoolAdmin = await User.findById(adminId).select('subscriptionStatus trialEndDate subscriptionEndDate role');
          const result = enforceUserSubscription(schoolAdmin, {
            trialExpiredMessage: 'Your school trial period has expired. Please contact your school admin to choose a subscription plan.',
            subscriptionExpiredMessage: 'Your school subscription has expired. Please contact your school admin to renew the plan.',
            subscriptionRequiredMessage: 'Your school does not have an active subscription. Please contact your school admin.',
          });
          if (result) return result;
        } else {
          return res.status(403).json({ message: 'Your account is linked to a school without an active admin subscription. Please contact support.', subscriptionRequired: true });
        }
      }
      return next();
    }

    // For Students - no subscription blocking (removed subscription checks)
    // Only check enrollment if accessing a specific classroom
    if (user.role === 'student') {
      // Get classroom from request if available
      const classroomId = req.params.classroomId || req.params.id || req.body.classroomId;

      if (classroomId) {
        const classroom = await Classroom.findById(classroomId);

        if (!classroom) {
          return res.status(404).json({ message: 'Classroom not found' });
        }

        // Check if student is enrolled in the class
        // const isEnrolled = classroom.students.some(
        //   studentId => studentId.toString() === user._id.toString()
        // ) || user.enrolledClasses.some(
        //   classId => classId.toString() === classroomId
        // );

        // Allow students to view the classroom details page even if not enrolled
        // This is necessary for them to see the "Enroll" button after being removed.
        // Specific routes (like accessing paid topics) should have their own checks.

        // if (!isEnrolled) {
        //   return res.status(403).json({ message: 'You are not enrolled in this class.', enrollmentRequired: true });
        // }
      }
      // If no classroom context, allow access (students can view dashboard, etc.)
      return next();
    }

    // For other roles or if no specific check needed, allow access
    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    // On error, allow access to prevent blocking legitimate requests
    // You might want to log this for monitoring
    next();
  }
};

module.exports = subscriptionCheck;
