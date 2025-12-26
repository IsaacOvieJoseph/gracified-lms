const express = require('express');
const Classroom = require('../models/Classroom');
const { auth } = require('../middleware/auth');
const whiteboardSessions = require('../whiteboardSessions');
const router = express.Router();

// Return the active session info for a classroom.
// If a session exists and has active users, return sessionId; otherwise, return saved whiteboardUrl if present.
router.get('/:classroomId', auth, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId);

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check permissions: enrolled, teacher, or admins
    const isEnrolled = Array.isArray(classroom.students) && classroom.students.some(
      student => student.toString() === req.user._id.toString()
    );
    const isTeacher = classroom.teacherId && classroom.teacherId.toString() === req.user._id.toString();

    if (!isEnrolled && !isTeacher && req.user.role !== 'root_admin' && req.user.role !== 'school_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const session = whiteboardSessions.getSession(classroom._id.toString());
    if (session) {
      return res.json({ sessionId: session.sessionId, active: session.clients.size, locked: session.locked });
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
router.post('/:classroomId/publish', auth, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId);
    if (!classroom) return res.status(404).json({ message: 'Classroom not found' });

    const canCreate = 
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
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

