const express = require('express');
const Topic = require('../models/Topic');
const Classroom = require('../models/Classroom');
const { auth, authorize } = require('../middleware/auth');
const subscriptionCheck = require('../middleware/subscriptionCheck'); // Import subscriptionCheck middleware
const { isClassroomOwnerSubscriptionValid } = require('../utils/subscriptionHelper');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { videoStorage } = require('../config/cloudinary');

const router = express.Router();

// ─── Multer – video uploads ──────────────────────────────────────────────────
const localVideoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/topic-videos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `topic-${req.params.id}-${unique}${path.extname(file.originalname)}`);
  }
});

const videoUpload = multer({
  storage: process.env.CLOUDINARY_CLOUD_NAME ? videoStorage : localVideoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (req, file, cb) => {
    const allowed = /mp4|webm|ogg|mov|mkv|avi/i;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = /video\//i.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only video files are allowed (mp4, webm, ogg, mov, mkv, avi)'));
  }
});

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
/**
 * @swagger
 * /api/topics/reorder:
 *   put:
 *     summary: Reorder topics within a classroom
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderedIds
 *             properties:
 *               orderedIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Reordered successfully
 */
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
/**
 * @swagger
 * /api/topics/classroom/{classroomId}:
 *   get:
 *     summary: Get all topics for a classroom
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classroomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of topics
 */
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

    // Determine if paid topics should be visible
    let showPaidTopics = false;
    if (classroom.pricing?.type === 'per_topic' && classroom.teacherId && ['personal_teacher', 'school_admin'].includes(classroom.teacherId.role) && classroom.teacherId.subscriptionStatus === 'pay_as_you_go') {
      showPaidTopics = true;
    }
    let topics = await Topic.find({ classroomId: req.params.classroomId }).sort({ order: 1 });
    if (!showPaidTopics) {
      // Hide paid topics if not allowed
      topics = topics.map(t => ({
        ...t.toObject(),
        isPaid: false,
        price: 0
      }));
    }
    res.json({ topics, showPaidTopics });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get topic by ID
/**
 * @swagger
 * /api/topics/{id}:
 *   get:
 *     summary: Get topic by ID
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Topic details
 */
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
/**
 * @swagger
 * /api/topics:
 *   post:
 *     summary: Create a new topic
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - classroomId
 *             properties:
 *               name:
 *                 type: string
 *               classroomId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Topic created
 */
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
/**
 * @swagger
 * /api/topics/{id}:
 *   put:
 *     summary: Update a topic
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Topic updated
 */
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
/**
 * @swagger
 * /api/topics/{id}:
 *   delete:
 *     summary: Delete a topic
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Topic deleted
 */
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
/**
 * @swagger
 * /api/topics/classroom/{classroomId}/current:
 *   get:
 *     summary: Get current active topic for a classroom
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classroomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current topic details
 */
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
/**
 * @swagger
 * /api/topics/{id}/complete:
 *   post:
 *     summary: Mark topic as complete
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Topic marked as complete
 */
router.post('/:id/complete', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    const { activateNext = true } = req.body;
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

    const result = await markTopicComplete(req.params.id, req.user._id, activateNext);
    res.json({
      message: activateNext && result.nextTopic ? `Topic completed! Next: ${result.nextTopic.name} is now active.` : 'Topic marked as complete',
      completedTopic: result.completedTopic,
      nextTopic: result.nextTopic
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Set next topic manually (authorized roles only)
/**
 * @swagger
 * /api/topics/{id}/set-next:
 *   put:
 *     summary: Set the next topic manually
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nextTopicId
 *             properties:
 *               nextTopicId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Next topic set
 */
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
/**
 * @swagger
 * /api/topics/{id}/activate:
 *   post:
 *     summary: Activate a topic
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Topic activated
 */
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

// Reset a topic to pending (for completed topics)
/**
 * @swagger
 * /api/topics/{id}/reset:
 *   post:
 *     summary: Reset topic to pending
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Topic reset
 */
router.post('/:id/reset', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), subscriptionCheck, async (req, res) => {
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

    // Reset topic to pending state
    topic.status = 'pending';
    topic.startedAt = null;
    topic.completedAt = null;
    topic.expectedEndDate = null;
    topic.completedBy = null;
    await topic.save();

    // If this was the current topic, clear it from classroom
    if (classroom.currentTopicId && classroom.currentTopicId.toString() === topic._id.toString()) {
      classroom.currentTopicId = null;
      await classroom.save();
    }

    res.json({
      message: 'Topic reset to pending',
      topic
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// Upload recorded video to a topic
/**
 * @swagger
 * /api/topics/{id}/upload-video:
 *   post:
 *     summary: Upload a recorded video for a topic
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Video uploaded
 */
router.post('/:id/upload-video',
  auth,
  authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'),
  (req, res, next) => {
    videoUpload.single('video')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Video file is too large. Maximum allowed size is 500 MB.' });
        }
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const topic = await Topic.findById(req.params.id).populate('classroomId');
      if (!topic) return res.status(404).json({ message: 'Topic not found' });

      const classroom = topic.classroomId;
      const canEdit =
        req.user.role === 'root_admin' ||
        (req.user.role === 'school_admin' && hasSchoolAccess(req.user, classroom)) ||
        (classroom.teacherId && classroom.teacherId.toString() === req.user._id.toString());

      if (!canEdit) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({ message: 'Access denied' });
      }

      // Premium Upload Check: Only 'Premium' plan subscribers and root_admin can upload
      const isPremiumType = req.user.role === 'root_admin' || 
                           (req.user.subscriptionPlan && req.user.subscriptionPlan.name === 'Premium');

      if (!isPremiumType) {
        if (req.file) {
          try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        return res.status(403).json({ 
          message: 'Video file upload is reserved for Premium plan subscribers and Root Admins. Please upgrade your subscription or use a video URL instead.' 
        });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No video file uploaded' });
      }

      const videoUrl = process.env.CLOUDINARY_CLOUD_NAME ? req.file.path : `${req.protocol}://${req.get('host')}/uploads/topic-videos/${req.file.filename}`;
      
      const newIndex = topic.recordedVideos.length;
      const newLabel = `Lecture ${newIndex + 1}`;

      const newVideo = {
        url: videoUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        videoType: 'file',
        uploadedAt: new Date(),
        label: newLabel,
        order: newIndex
      };

      topic.recordedVideos.push(newVideo);
      await topic.save();

      res.json({ message: 'Video uploaded successfully', recordedVideos: topic.recordedVideos });
    } catch (error) {
      console.error('Error uploading topic video:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Add video URL to a topic
/**
 * @swagger
 * /api/topics/{id}/add-video-url:
 *   post:
 *     summary: Add an external video URL to a topic
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Video URL added
 */
router.post('/:id/add-video-url',
  auth,
  authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'),
  async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ message: 'URL is required' });

      const topic = await Topic.findById(req.params.id).populate('classroomId');
      if (!topic) return res.status(404).json({ message: 'Topic not found' });

      // Permission check
      const classroom = topic.classroomId;
      const canEdit =
        req.user.role === 'root_admin' ||
        (req.user.role === 'school_admin' && hasSchoolAccess(req.user, classroom)) ||
        (classroom.teacherId && classroom.teacherId.toString() === req.user._id.toString());

      if (!canEdit) return res.status(403).json({ message: 'Access denied' });

      const newIndex = topic.recordedVideos.length;
      const newLabel = `Lecture ${newIndex + 1}`;

      const newVideo = {
        url,
        videoType: 'url',
        uploadedAt: new Date(),
        label: newLabel,
        order: newIndex
      };

      topic.recordedVideos.push(newVideo);
      await topic.save();

      res.json({ message: 'Video URL added successfully', recordedVideos: topic.recordedVideos });
    } catch (error) {
      console.error('Error adding video URL:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Internal helper for video permissions
const checkVideoEditPermissions = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id).populate('classroomId');
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const classroom = topic.classroomId;
    const canEdit =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && hasSchoolAccess(req.user, classroom)) ||
      (classroom.teacherId && classroom.teacherId.toString() === req.user._id.toString());

    if (!canEdit) return res.status(403).json({ message: 'Access denied' });
    req.topic = topic;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete recorded video from a topic
/**
 * @swagger
 * /api/topics/{id}/videos/{videoId}:
 *   delete:
 *     summary: Delete a video from a topic
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Video deleted
 */
router.delete('/:id/videos/:videoId',
  auth,
  authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'),
  checkVideoEditPermissions,
  async (req, res) => {
    try {
      const topic = req.topic;
      const videoId = req.params.videoId;
      
      const videoIndex = topic.recordedVideos.findIndex(v => v._id.toString() === videoId);
      if (videoIndex === -1) return res.status(404).json({ message: 'Video not found' });

      const video = topic.recordedVideos[videoIndex];
      
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        const filePath = path.join(__dirname, '../uploads/topic-videos', path.basename(video.url));
        if (video.videoType === 'file' && fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
        }
      } else if (video.videoType === 'file') {
        // If we wanted to delete from Cloudinary, we'd use cloudinary.uploader.destroy here
        // but it requires keeping track of public_id. For now, we'll just remove from DB.
      }

      topic.recordedVideos.splice(videoIndex, 1);
      
      // Re-adjust order and labels for remaining
      topic.recordedVideos.forEach((v, idx) => {
        v.order = idx;
        v.label = `Lecture ${idx + 1}`;
      });

      await topic.save();

      res.json({ message: 'Video removed successfully', recordedVideos: topic.recordedVideos });
    } catch (error) {
      console.error('Error removing video:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Update recorded video label
/**
 * @swagger
 * /api/topics/{id}/videos/{videoId}/label:
 *   put:
 *     summary: Update video label
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *     responses:
 *       200:
 *         description: Label updated
 */
router.put('/:id/videos/:videoId/label',
  auth,
  authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'),
  checkVideoEditPermissions,
  async (req, res) => {
    try {
      const topic = req.topic;
      const videoId = req.params.videoId;
      const { label } = req.body;
      
      const video = topic.recordedVideos.id(videoId);
      if (!video) return res.status(404).json({ message: 'Video not found' });

      if (label !== undefined) {
        video.label = label;
      }

      await topic.save();
      res.json({ message: 'Video label updated', recordedVideos: topic.recordedVideos });
    } catch (error) {
      console.error('Error updating topic video label:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Reorder videos
router.put('/:id/videos/reorder',
  auth,
  authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'),
  checkVideoEditPermissions,
/**
 * @swagger
 * /api/topics/{id}/videos/reorder:
 *   put:
 *     summary: Reorder videos in a topic
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderedVideoIds
 *             properties:
 *               orderedVideoIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Videos reordered
 */
  async (req, res) => {
    try {
      const topic = req.topic;
      const { orderedVideoIds } = req.body;
      
      if (!orderedVideoIds || !Array.isArray(orderedVideoIds)) {
        return res.status(400).json({ message: 'Invalid orderedVideoIds' });
      }

      // Reorder the recordedVideos array
      const oldVideos = [...topic.recordedVideos];
      topic.recordedVideos = [];

      orderedVideoIds.forEach((id, index) => {
        const vid = oldVideos.find(v => v._id.toString() === id.toString());
        if (vid) {
          vid.order = index;
          vid.label = `Lecture ${index + 1}`;
          topic.recordedVideos.push(vid);
        }
      });

      // Add any left over in case they were missed
      oldVideos.forEach(v => {
        if (!orderedVideoIds.includes(v._id.toString())) {
          const newIdx = topic.recordedVideos.length;
          v.order = newIdx;
          v.label = `Lecture ${newIdx + 1}`;
          topic.recordedVideos.push(v);
        }
      });

      await topic.save();
      res.json({ message: 'Videos reordered successfully', recordedVideos: topic.recordedVideos });
    } catch (error) {
      console.error('Error reordering videos:', error);
      res.status(500).json({ message: error.message });
    }
  }
);



const TopicProgress = require('../models/TopicProgress');

// ─── Topic Progression tracking (User specific) ──────────────────────────────

// Get user's progress for a specific topic
/**
 * @swagger
 * /api/topics/{id}/progress:
 *   get:
 *     summary: Get user progress for a topic
 *     tags: [Topic Progress]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Progress details
 */
router.get('/:id/progress', auth, async (req, res) => {
  try {
    const progress = await TopicProgress.findOne({
      userId: req.user._id,
      topicId: req.params.id
    });
    
    if (!progress) {
      return res.json({ progress: { watchedVideoIds: [], lastActiveVideoId: null, completionPercentage: 0 } });
    }
    
    res.json({ progress });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user's progress for a specific topic
/**
 * @swagger
 * /api/topics/{id}/progress:
 *   post:
 *     summary: Update user progress for a topic
 *     tags: [Topic Progress]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               videoId:
 *                 type: string
 *               isLastActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Progress updated
 */
router.post('/:id/progress', auth, async (req, res) => {
  try {
    const { videoId, isLastActive = true } = req.body;
    const topicId = req.params.id;
    const userId = req.user._id;

    const topic = await Topic.findById(topicId);
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    let progress = await TopicProgress.findOne({ userId, topicId });
    if (!progress) {
      progress = new TopicProgress({ userId, topicId, watchedVideoIds: [] });
    }

    // Add videoId to watched list if not already present
    if (videoId && !progress.watchedVideoIds.includes(videoId)) {
      progress.watchedVideoIds.push(videoId);
    }

    // Update last active video if requested
    if (videoId && isLastActive) {
      progress.lastActiveVideoId = videoId;
    }

    // Update completion percentage
    const totalVideos = topic.recordedVideos.length;
    if (totalVideos > 0) {
      progress.completionPercentage = Math.round((progress.watchedVideoIds.length / totalVideos) * 100);
    }

    progress.lastWatchedAt = new Date();
    await progress.save();

    res.json({ message: 'Progress updated', progress });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk create topics for a classroom
/**
 * @swagger
 * /api/topics/bulk-create/{classroomId}:
 *   post:
 *     summary: Bulk create topics for a classroom
 *     tags: [Topics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classroomId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topics
 *             properties:
 *               topics:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Topics created
 */
router.post('/bulk-create/:classroomId', auth, subscriptionCheck, async (req, res) => {
  try {
    const { topics } = req.body;
    const { classroomId } = req.params;

    if (!topics || !Array.isArray(topics)) {
      return res.status(400).json({ message: 'topics must be an array' });
    }

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) return res.status(404).json({ message: 'Classroom not found' });

    // Check permissions
    const isOwner = classroom.teacherId.toString() === req.user._id.toString();
    const isSchoolAdmin = req.user.role === 'school_admin' && hasSchoolAccess(req.user, classroom);

    if (req.user.role !== 'root_admin' && !isOwner && !isSchoolAdmin) {
      return res.status(403).json({ message: 'Unauthorized to manage topics for this classroom' });
    }

    // Get current topic count for ordering
    const existingCount = await Topic.countDocuments({ classroomId });

    const topicsToCreate = topics.map((t, idx) => ({
      ...t,
      classroomId,
      order: existingCount + idx,
      status: 'pending'
    }));

    const created = await Topic.insertMany(topicsToCreate);

    // Update classroom topics array
    classroom.topics.push(...created.map(t => t._id));
    await classroom.save();

    res.json({ success: true, count: created.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;


