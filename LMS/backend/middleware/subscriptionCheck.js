const Classroom = require('../models/Classroom');
const School = require('../models/School');
const User = require('../models/User');

const subscriptionCheck = async (req, res, next) => {
  const user = req.user;

  try {
    // Root admin has full access
    if (user.role === 'root_admin') {
      return next();
    }

    // For School Admin and Personal Teacher - check their own subscription
    if (user.role === 'school_admin' || user.role === 'personal_teacher') {
      // If on trial, check if trial period has expired
      if (user.subscriptionStatus === 'trial') {
        if (user.trialEndDate && user.trialEndDate < Date.now()) {
          return res.status(403).json({ message: 'Your trial period has expired. Please choose a subscription plan to continue.', trialExpired: true });
        }
      }
      // If on active plan, check if it has expired
      else if (user.subscriptionStatus === 'active') {
        if (user.subscriptionEndDate && new Date(user.subscriptionEndDate) < new Date()) {
          return res.status(403).json({ message: 'Your subscription has expired. Please renew your plan to continue.', subscriptionExpired: true });
        }
      }
      // If none of the above (none, canceled, expired), and NOT pay_as_you_go, deny access
      else if (user.subscriptionStatus !== 'pay_as_you_go') {
        return res.status(403).json({ message: 'You do not have an active subscription. Please choose a plan.', subscriptionRequired: true });
      }
      return next();
    }

    // For Teachers - no subscription blocking (removed subscription checks)
    if (user.role === 'teacher') {
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
        const isEnrolled = classroom.students.some(
          studentId => studentId.toString() === user._id.toString()
        ) || user.enrolledClasses.some(
          classId => classId.toString() === classroomId
        );

        if (!isEnrolled) {
          return res.status(403).json({ message: 'You are not enrolled in this class.', enrollmentRequired: true });
        }
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
