const express = require('express');
const Classroom = require('../models/Classroom');
const { auth } = require('../middleware/auth');
const whiteboardSessions = require('../whiteboardSessions');
const router = express.Router();

// Return the active session info for a classroom.
// If a session exists and has active users, return sessionId; otherwise, return saved whiteboardUrl if present.
/**
 * @swagger
 * /api/whiteboard/{classroomId}:
 *   get:
 *     summary: Get the active whiteboard session for a classroom
 *     tags: [Whiteboard]
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
 *         description: Session details or stored URL
 */
router.get('/:classroomId', auth, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId);

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check permissions: enrolled, teacher, or admins
    const isEnrolled = (Array.isArray(classroom.students) && classroom.students.some(
      student => student.toString() === req.user._id.toString()
    )) || (req.user.enrolledClasses && req.user.enrolledClasses.some(id => id.toString() === classroom._id.toString()));

    const isTeacher = classroom.teacherId && classroom.teacherId.toString() === req.user._id.toString();

    let hasSchoolAccess = false;
    if (req.user.role === 'school_admin') {
      const classroomSchools = Array.isArray(classroom.schoolId)
        ? classroom.schoolId.map(id => (id._id || id).toString())
        : (classroom.schoolId ? [(classroom.schoolId._id || classroom.schoolId).toString()] : []);

      const adminSchools = Array.isArray(req.user.schoolId)
        ? req.user.schoolId.map(id => (id._id || id).toString())
        : (req.user.schoolId ? [(req.user.schoolId._id || req.user.schoolId).toString()] : []);

      hasSchoolAccess = classroomSchools.some(sid => adminSchools.includes(sid));
    }

    const hasAccess = isEnrolled || isTeacher || req.user.role === 'root_admin' || hasSchoolAccess;

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const session = whiteboardSessions.getSession(classroom._id.toString());
    if (session) {
      return res.json({ sessionId: session.sessionId, active: session.clients.size, locked: session.locked });
    }

    // fallback to DB activity status (e.g. if teacher is on another process instance)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (classroom.whiteboardActiveAt && classroom.whiteboardActiveAt > thirtyMinutesAgo) {
      // Return a stable sessionId based on classroomId so student joins the same "room"
      return res.json({ sessionId: classroom._id.toString(), active: 1, locked: false });
    }

    // fallback to stored whiteboardUrl if any
    if (classroom.whiteboardUrl) {
      return res.json({ whiteboardUrl: classroom.whiteboardUrl, active: 0, locked: false });
    }

    // no active session and no stored url
    return res.json({ sessionId: null, whiteboardUrl: null, active: 0, locked: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Allow teacher/admin to create/publish a persistent whiteboard URL (stored in DB)
/**
 * @swagger
 * /api/whiteboard/{classroomId}/publish:
 *   post:
 *     summary: Publish a persistent whiteboard URL for a classroom
 *     tags: [Whiteboard]
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
 *         description: Whiteboard published
 */
router.post('/:classroomId/publish', auth, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId);
    if (!classroom) return res.status(404).json({ message: 'Classroom not found' });

    let hasSchoolAccess = false;
    if (req.user.role === 'school_admin') {
      const classroomSchools = Array.isArray(classroom.schoolId)
        ? classroom.schoolId.map(id => (id._id || id).toString())
        : (classroom.schoolId ? [(classroom.schoolId._id || classroom.schoolId).toString()] : []);

      const adminSchools = Array.isArray(req.user.schoolId)
        ? req.user.schoolId.map(id => (id._id || id).toString())
        : (req.user.schoolId ? [(req.user.schoolId._id || req.user.schoolId).toString()] : []);

      hasSchoolAccess = classroomSchools.some(sid => adminSchools.includes(sid));
    }

    const canCreate =
      req.user.role === 'root_admin' ||
      hasSchoolAccess ||
      (classroom.teacherId && classroom.teacherId.toString() === req.user._id.toString());

    if (!canCreate) return res.status(403).json({ message: 'Access denied' });

    const boardId = `board-${classroom._id}-${Date.now()}`;
    classroom.whiteboardUrl = `https://whiteboard.lms.com/${boardId}`;
    await classroom.save();

    return res.json({ whiteboardUrl: classroom.whiteboardUrl, message: 'Whiteboard published' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

