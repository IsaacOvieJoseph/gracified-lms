const express = require('express');
const Topic = require('../models/Topic');
const Classroom = require('../models/Classroom');
const { auth, authorize } = require('../middleware/auth');
const subscriptionCheck = require('../middleware/subscriptionCheck'); // Import subscriptionCheck middleware
const { isClassroomOwnerSubscriptionValid } = require('../utils/subscriptionHelper');
const router = express.Router();

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
    const { name, description, classroomId, order, materials, isPaid, price } = req.body;

    // Verify classroom exists and user has permission
    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const canCreate = 
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
      classroom.teacherId.toString() === req.user._id.toString();

    if (!canCreate) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const topic = new Topic({
      name,
      description,
      classroomId,
      order: order || 0,
      materials: materials || [],
      isPaid: isPaid || false,
      price: price || 0
    });

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
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
      classroom.teacherId.toString() === req.user._id.toString();

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
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
      classroom.teacherId.toString() === req.user._id.toString();

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

module.exports = router;

