const express = require('express');
const Topic = require('../models/Topic');
const Classroom = require('../models/Classroom');
const { auth, authorize } = require('../middleware/auth');
const subscriptionCheck = require('../middleware/subscriptionCheck'); // Import subscriptionCheck middleware
const { isClassroomOwnerSubscriptionValid } = require('../utils/subscriptionHelper');
const router = express.Router();

// Helper to check school access
const hasSchoolAccess = (user, classroom) => {
  if (user.role === 'root_admin') return true;

  // If user or classroom has no school info, return false (unless user is checking their own class which is handled separately)
  if (!user.schoolId || !classroom.schoolId) return false;

  const userSchools = Array.isArray(user.schoolId) ? user.schoolId : [user.schoolId];
  const classroomSchools = Array.isArray(classroom.schoolId) ? classroom.schoolId : [classroom.schoolId];

  // Convert to strings for comparison
  const userSchoolIds = userSchools.map(id => (id._id || id).toString());
  const classroomSchoolIds = classroomSchools.map(id => (id._id || id).toString());

  return userSchoolIds.some(id => classroomSchoolIds.includes(id));
};

// Reorder topics
router.put('/reorder', auth, subscriptionCheck, async (req, res) => {
  try {
    const { orderedIds } = req.body;

    if (!orderedIds || !Array.isArray(orderedIds)) {
      return res.status(400).json({ message: 'Invalid orderedIds' });
    }

    // Process updates in parallel
    const updates = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { order: index }
      }
    }));

    if (updates.length > 0) {
      await Topic.bulkWrite(updates);
    }

    res.json({ message: 'Topics reordered successfully' });
  } catch (error) {
    console.error('Error reordering topics:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get topics for a classroom
router.get('/classroom/:classroomId', auth, subscriptionCheck, async (req, res) => {
  try {
    // First check if classroom exists and owner's subscription is valid
    const classroom = await Classroom.findById(req.params.classroomId)
      .populate('teacherId', 'role subscriptionStatus trialEndDate')
      .populate({
        path: 'schoolId',
        select: 'adminId',
        populate: {
          path: 'adminId',
          select: 'subscriptionStatus trialEndDate'
        }
      });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check subscription only if user is not a teacher or student
    if (req.user.role !== 'teacher' && req.user.role !== 'student') {
      const isOwnerSubscriptionValid = await isClassroomOwnerSubscriptionValid(classroom);
      if (!isOwnerSubscriptionValid) {
        return res.json({ topics: [] }); // Return empty array if subscription expired
      }
    }

    // For teachers, allow access to their own class topics regardless of subscription
    if (req.user.role === 'teacher') {
      const teacherId = classroom.teacherId._id || classroom.teacherId;
      if (teacherId.toString() !== req.user._id.toString()) {
        // Teacher trying to access someone else's class - check subscription
        const isOwnerSubscriptionValid = await isClassroomOwnerSubscriptionValid(classroom);
        if (!isOwnerSubscriptionValid) {
          return res.json({ topics: [] });
        }
      }
    }

    // For students, allow access to enrolled class topics regardless of subscription
    if (req.user.role === 'student') {
      const isEnrolled = classroom.students.some(
        studentId => (studentId._id || studentId).toString() === req.user._id.toString()
      ) || req.user.enrolledClasses.some(
        classId => classId.toString() === classroom._id.toString()
      );
      if (!isEnrolled) {
        return res.status(403).json({ message: 'You are not enrolled in this class.', enrollmentRequired: true });
      }
    }

    const topics = await Topic.find({ classroomId: req.params.classroomId })
      .sort({ order: 1 });

    res.json({ topics });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get topic by ID
router.get('/:id', auth, subscriptionCheck, async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id)
      .populate({
        path: 'classroomId',
        select: 'name teacherId students schoolId',
        populate: [
          {
            path: 'teacherId',
            select: 'role subscriptionStatus trialEndDate'
          },
          {
            path: 'schoolId',
            select: 'adminId',
            populate: {
              path: 'adminId',
              select: 'subscriptionStatus trialEndDate'
            }
          }
        ]
      });

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    // Check if classroom owner's subscription is valid (skip check for teachers and students)
    if (topic.classroomId) {
      // For teachers, allow access to their own class topics
      if (req.user.role === 'teacher') {
        const teacherId = topic.classroomId.teacherId?._id || topic.classroomId.teacherId;
        if (teacherId && teacherId.toString() === req.user._id.toString()) {
          // Teacher's own class - allow access
        } else if (req.user.role !== 'student') {
          // Teacher accessing someone else's class - check subscription
          const isOwnerSubscriptionValid = await isClassroomOwnerSubscriptionValid(topic.classroomId);
          if (!isOwnerSubscriptionValid) {
            return res.status(403).json({ message: 'This topic is not available. The class owner\'s subscription has expired.', subscriptionExpired: true });
          }
        }
      }
      // For students, allow access to enrolled class topics
      else if (req.user.role === 'student') {
        const isEnrolled = topic.classroomId.students?.some(
          studentId => (studentId._id || studentId).toString() === req.user._id.toString()
        ) || req.user.enrolledClasses?.some(
          classId => classId.toString() === topic.classroomId._id.toString()
        );
        if (!isEnrolled) {
          return res.status(403).json({ message: 'You are not enrolled in this class.', enrollmentRequired: true });
        }
      }
      // For other users, check subscription
      else {
        const isOwnerSubscriptionValid = await isClassroomOwnerSubscriptionValid(topic.classroomId);
        if (!isOwnerSubscriptionValid) {
          return res.status(403).json({ message: 'This topic is not available. The class owner\'s subscription has expired.', subscriptionExpired: true });
        }
      }
    }

    res.json({ topic });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create topic
router.post('/', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    const { name, description, classroomId, order, materials, isPaid, price, duration } = req.body;

    // Verify classroom exists and user has permission
    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const canCreate =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && hasSchoolAccess(req.user, classroom)) ||
      (classroom.teacherId && classroom.teacherId.toString() === req.user._id.toString());

    if (!canCreate) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const topicData = {
      name,
      description,
      classroomId,
      order: order || 0,
      materials: materials || [],
      isPaid: isPaid || false,
      price: price || 0
    };

    // Add duration if provided
    if (duration) {
      topicData.duration = {
        mode: duration.mode || 'not_sure',
        value: duration.value || 1
      };
    }

    const topic = new Topic(topicData);
    await topic.save();

    // Add topic to classroom
    classroom.topics.push(topic._id);
    await classroom.save();

    res.status(201).json({ topic });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update topic
router.put('/:id', auth, subscriptionCheck, async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id).populate('classroomId');

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const classroom = topic.classroomId;
    const canEdit =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && hasSchoolAccess(req.user, classroom)) ||
      (classroom.teacherId && classroom.teacherId.toString() === req.user._id.toString());

    if (!canEdit) {
      return res.status(403).json({ message: 'Access denied' });
    }

    Object.assign(topic, req.body);
    await topic.save();

    res.json({ topic });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete topic
router.delete('/:id', auth, subscriptionCheck, async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id).populate('classroomId');

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const classroom = topic.classroomId;
    const canDelete =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && hasSchoolAccess(req.user, classroom)) ||
      (classroom.teacherId && classroom.teacherId.toString() === req.user._id.toString());

    if (!canDelete) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Remove topic from classroom
    await Classroom.findByIdAndUpdate(topic.classroomId._id, {
      $pull: { topics: topic._id }
    });

    await Topic.findByIdAndDelete(req.params.id);
    res.json({ message: 'Topic deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Import topic progression helper
const {
  markTopicComplete,
  setNextTopic,
  activateTopic,
  getCurrentTopic
} = require('../utils/topicProgressionHelper');

// Get current active topic for a classroom
router.get('/classroom/:classroomId/current', auth, subscriptionCheck, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const currentTopic = await getCurrentTopic(req.params.classroomId);
    res.json({ currentTopic });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark topic as complete (authorized roles only)
router.post('/:id/complete', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id).populate('classroomId');

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const classroom = topic.classroomId;
    const canManage =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && hasSchoolAccess(req.user, classroom)) ||
      (classroom.teacherId && classroom.teacherId.toString() === req.user._id.toString());

    if (!canManage) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await markTopicComplete(req.params.id, req.user._id);
    res.json({
      message: 'Topic marked as complete',
      completedTopic: result.completedTopic,
      nextTopic: result.nextTopic
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Set next topic manually (authorized roles only)
router.put('/:id/set-next', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    const { nextTopicId } = req.body;

    if (!nextTopicId) {
      return res.status(400).json({ message: 'nextTopicId is required' });
    }

    const topic = await Topic.findById(req.params.id).populate('classroomId');

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const classroom = topic.classroomId;
    const canManage =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && hasSchoolAccess(req.user, classroom)) ||
      (classroom.teacherId && classroom.teacherId.toString() === req.user._id.toString());

    if (!canManage) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedTopic = await setNextTopic(req.params.id, nextTopicId);
    res.json({
      message: 'Next topic set successfully',
      topic: updatedTopic
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Activate a topic (start it)
router.post('/:id/activate', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id).populate('classroomId');

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const classroom = topic.classroomId;
    const canManage =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && hasSchoolAccess(req.user, classroom)) ||
      (classroom.teacherId && classroom.teacherId.toString() === req.user._id.toString());

    if (!canManage) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const activatedTopic = await activateTopic(req.params.id);
    res.json({
      message: 'Topic activated successfully',
      topic: activatedTopic
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});




module.exports = router;

