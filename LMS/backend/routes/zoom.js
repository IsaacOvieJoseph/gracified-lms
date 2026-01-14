const express = require('express');
const axios = require('axios');
const Classroom = require('../models/Classroom');
const CallSession = require('../models/CallSession');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Create Zoom meeting
router.post('/create-meeting/:classroomId', auth, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId)
      .populate('teacherId', 'name email');

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }


// **** CHECK HERE FOR ZOOM CREATION PERMISSION ***
    // Check permissions
    const canCreate = 
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
      classroom.teacherId._id.toString() === req.user._id.toString();

    if (!canCreate) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // // Generate meeting details (in production, use Zoom API)
    // const meetingId = Math.random().toString(36).substring(2, 15);
    // const password = Math.random().toString(36).substring(2, 8);
    // const meetingUrl = `https://zoom.us/j/${meetingId}?pwd=${password}`;

    // In production, use Zoom SDK:
    
    const zoomResponse = await axios.post('https://api.zoom.us/v2/users/me/meetings', {
      topic: classroom.name,
      type: 2, // Scheduled meeting
      start_time: new Date().toISOString(),
      duration: 55, // Increased to 55 minutes as per request
      default_password : false,
      password: "testClass",
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.ZOOM_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const { id: eventId, join_url: joinUrl, start_url: htmlLink } = zoomResponse.data;

    const callSession = new CallSession({
      classroomId: classroom._id,
      startedBy: req.user._id,
      link: joinUrl,
      eventId: eventId,
      htmlLink: htmlLink,
    });
    await callSession.save();

    res.json({
      meetingId: eventId,
      joinUrl,
      startUrl: htmlLink, // For the teacher to start the meeting
      message: 'Zoom meeting created successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Zoom meeting details
router.get('/meeting/:classroomId', auth, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId);

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check if user is enrolled or is teacher/admin
    const isEnrolled = classroom.students.some(
      student => student.toString() === req.user._id.toString()
    );
    const isTeacher = classroom.teacherId.toString() === req.user._id.toString();

    if (!isEnrolled && !isTeacher && req.user.role !== 'root_admin' && req.user.role !== 'school_admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Find the most recent active call session for this classroom
    const activeCallSession = await CallSession.findOne({
      classroomId: req.params.classroomId,
      startedAt: { $gte: new Date(Date.now() - 55 * 60 * 1000) } // Active within the last 55 minutes
    }).sort({ startedAt: -1 });

    if (!activeCallSession) {
      return res.status(404).json({ message: 'No active meeting scheduled' });
    }

    res.json({
      meetingId: activeCallSession.eventId,
      joinUrl: activeCallSession.link,
      startUrl: activeCallSession.htmlLink // For the teacher to start the meeting
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

