const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const TutorRequest = require('../models/TutorRequest');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Notification = require('../models/Notification');

const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function notifyRootAdmins(payload) {
  const admins = await User.find({ role: 'root_admin' }).select('_id');
  if (!admins.length) return;
  await Notification.insertMany(admins.map((a) => ({ userId: a._id, ...payload })));
}

// ─── GET /api/tutor-requests/suggestions (student) ────────────────────────────
// AI-style suggestions built from active platform tutors and the student's own
// class data: their current teachers plus personal teachers whose active
// classrooms match the subjects the student is studying.
router.get('/suggestions', auth, authorize('student'), async (req, res) => {
  try {
    const now = Date.now();
    const cutoff = new Date(now - ACTIVE_WINDOW_MS);

    // Classrooms the student is currently enrolled in (with their teachers)
    const enrolled = await Classroom.find({ students: req.user._id })
      .select('name subject level teacherId teacherName')
      .populate('teacherId', 'name profilePicture role lastActiveAt');

    const studentSubjects = [...new Set(enrolled.map((c) => c.subject).filter(Boolean).map((s) => s.toLowerCase()))];
    const studentLevels = [...new Set(enrolled.map((c) => c.level).filter(Boolean))];

    const suggestionsMap = new Map();

    const addSuggestion = (teacher, reason, matchScore) => {
      if (!teacher || !teacher._id) return;
      const key = String(teacher._id);
      const isActive = teacher.lastActiveAt ? new Date(teacher.lastActiveAt) >= cutoff : false;
      if (!isActive && !reason.includes('your')) return; // only include inactive teachers if they teach this very student
      const existing = suggestionsMap.get(key);
      if (!existing || existing.matchScore < matchScore) {
        suggestionsMap.set(key, {
          tutorId: teacher._id,
          name: teacher.name,
          profilePicture: teacher.profilePicture || null,
          role: teacher.role,
          isCurrentlyActive: isActive,
          lastActiveAt: teacher.lastActiveAt || null,
          reasons: existing ? [...new Set([...existing.reasons, reason])] : [reason],
          matchScore,
        });
      } else {
        existing.reasons = [...new Set([...existing.reasons, reason])];
      }
    };

    // 1) Teachers of the student's own enrolled classes (strongest signal)
    enrolled.forEach((c) => {
      if (c.teacherId && c.teacherId.role !== 'student') {
        addSuggestion(c.teacherId, `Your ${c.subject || ''} teacher for ${c.name}`.trim(), 3);
      }
    });

    // 2) Active personal teachers on the platform teaching matching subjects/levels
    if (studentSubjects.length || studentLevels.length) {
      const matchQuery = { students: { $ne: req.user._id }, teacherId: { $ne: null } };
      if (studentSubjects.length && studentLevels.length) {
        matchQuery.$or = [
          { subject: { $in: studentSubjects.map((s) => new RegExp(`^${s}$`, 'i')) } },
          { level: { $in: studentLevels } },
        ];
      } else if (studentSubjects.length) {
        matchQuery.subject = { $in: studentSubjects.map((s) => new RegExp(`^${s}$`, 'i')) };
      } else {
        matchQuery.level = { $in: studentLevels };
      }

      const matches = await Classroom.find(matchQuery)
        .select('subject name teacherId')
        .populate({
          path: 'teacherId',
          match: { role: { $in: ['personal_teacher', 'teacher'] }, lastActiveAt: { $gte: cutoff } },
          select: 'name profilePicture role lastActiveAt',
        })
        .limit(50);

      matches.forEach((c) => {
        if (c.teacherId) {
          addSuggestion(c.teacherId, `Actively teaches ${c.subject || c.name} on Gracified`, 2);
        }
      });
    }

    // 3) Fallback: any recently active personal teachers on the platform
    if (suggestionsMap.size < 3) {
      const activePersonalTeachers = await User.find({
        role: 'personal_teacher',
        lastActiveAt: { $gte: cutoff },
        _id: { $nin: [...suggestionsMap.keys()] },
      })
        .select('name profilePicture role lastActiveAt')
        .limit(5);

      activePersonalTeachers.forEach((t) => addSuggestion(t, 'Active personal tutor on Gracified', 1));
    }

    const suggestions = [...suggestionsMap.values()]
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 6);

    res.json({ success: true, suggestions });
  } catch (err) {
    console.error('Tutor suggestion error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/tutor-requests (student submits request → root admin) ─────────
router.post('/', auth, authorize('student'), async (req, res) => {
  try {
    const { subject, description, urgency, preferredSchedule } = req.body;

    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ message: 'Subject is required.' });
    }
    if (!description || String(description).trim().length < 10) {
      return res.status(400).json({ message: 'Please describe what you need help with (at least 10 characters).' });
    }

    // Prevent flooding: max 3 unresolved open requests per student
    const openCount = await TutorRequest.countDocuments({
      studentId: req.user._id,
      status: { $in: ['open', 'in_progress'] },
    });
    if (openCount >= 3) {
      return res.status(429).json({ message: 'You already have 3 active requests. Please wait for one to be resolved.' });
    }

    const request = new TutorRequest({
      studentId: req.user._id,
      subject: String(subject).trim(),
      description: String(description).trim(),
      urgency: ['low', 'medium', 'high'].includes(urgency) ? urgency : 'medium',
      preferredSchedule: preferredSchedule ? String(preferredSchedule).trim() : '',
    });
    await request.save();

    await notifyRootAdmins({
      message: `${req.user.name} requested a tutor for ${request.subject} (${request.urgency} priority).`,
      type: 'tutor_request',
      entityId: request._id,
      entityRef: 'TutorRequest',
    });

    res.status(201).json({ success: true, request });
  } catch (err) {
    console.error('Create tutor request error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/tutor-requests/mine (student) ───────────────────────────────────
router.get('/mine', auth, authorize('student'), async (req, res) => {
  try {
    const requests = await TutorRequest.find({ studentId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/tutor-requests/referred (personal_teacher — students matched) ───
router.get('/referred', auth, authorize('personal_teacher'), async (req, res) => {
  try {
    const requests = await TutorRequest.find({ 'referral.tutorId': req.user._id })
      .populate('studentId', 'name email profilePicture')
      .populate('referral.classroomId', 'name subject level')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/tutor-requests/published (personal_teacher — browse requests) ───
// Published requests the tutor can apply to. Student details are hidden until a match.
router.get('/published', auth, authorize('personal_teacher'), async (req, res) => {
  try {
    const requests = await TutorRequest.find({
      published: true,
      mode: 'admin',
      status: { $in: ['open', 'in_progress'] },
      'referral.tutorId': null,
    })
      .select('subject description urgency preferredSchedule applications status createdAt')
      .sort({ createdAt: -1 })
      .limit(50);

    const result = await Promise.all(requests.map(async (r) => {
      let myApplication = r.applications.find((a) => String(a.tutorId) === String(req.user._id)) || null;
      let touched = false;
      if (myApplication) {
        myApplication.messages.forEach((m) => {
          if (m.senderRole === 'root_admin' && !m.readByTutor) {
            m.readByTutor = true;
            touched = true;
          }
        });
        if (touched) {
          r.markModified('applications');
          await r.save();
        }
        myApplication = {
          _id: myApplication._id,
          message: myApplication.message,
          status: myApplication.status,
          messages: myApplication.messages,
          appliedAt: myApplication.appliedAt,
        };
      }
      return {
        _id: r._id,
        subject: r.subject,
        description: r.description,
        urgency: r.urgency,
        preferredSchedule: r.preferredSchedule,
        status: r.status,
        applicationCount: r.applications.length,
        applied: !!myApplication,
        myApplication,
        createdAt: r.createdAt,
      };
    }));

    res.json({ success: true, requests: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/tutor-requests/:id/apply (personal_teacher) ────────────────────
router.post('/:id/apply', auth, authorize('personal_teacher'), async (req, res) => {
  try {
    const { message } = req.body;
    const request = await TutorRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    if (!request.published || request.mode !== 'admin') {
      return res.status(400).json({ message: 'This request is not open for applications.' });
    }
    if (!['open', 'in_progress'].includes(request.status)) {
      return res.status(400).json({ message: 'This request is closed.' });
    }
    const already = request.applications.some((a) => String(a.tutorId) === String(req.user._id));
    if (already) return res.status(400).json({ message: 'You have already applied to this request.' });

    request.applications.push({
      tutorId: req.user._id,
      message: message ? String(message).trim() : '',
    });
    await request.save();

    await notifyRootAdmins({
      message: `${req.user.name} applied to help with "${request.subject}".`,
      type: 'tutor_application',
      entityId: request._id,
      entityRef: 'TutorRequest',
    });

    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/tutor-requests/:id/applications/:appId/tutor-classes (admin) ────
router.get('/:id/applications/:appId/tutor-classes', auth, authorize('root_admin'), async (req, res) => {
  try {
    const request = await TutorRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    const application = request.applications.id(req.params.appId);
    if (!application) return res.status(404).json({ message: 'Application not found.' });
    const classrooms = await Classroom.find({ teacherId: application.tutorId })
      .select('name subject level isPaid published pricing students')
      .sort({ createdAt: -1 });
    res.json({ success: true, classrooms });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/tutor-requests/:id/applications/:appId/messages (admin ↔ tutor) ─
// Private review chat between the root admin and a tutor applicant.
router.post('/:id/applications/:appId/messages', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'Message cannot be empty.' });
    }
    const request = await TutorRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    const application = request.applications.id(req.params.appId);
    if (!application) return res.status(404).json({ message: 'Application not found.' });

    const isAdmin = req.user.role === 'root_admin';
    const isTutor = String(application.tutorId) === String(req.user._id);
    if (!isAdmin && !isTutor) return res.status(403).json({ message: 'Forbidden.' });
    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'This application has already been reviewed.' });
    }

    application.messages.push({
      senderId: req.user._id,
      senderRole: isAdmin ? 'root_admin' : 'personal_teacher',
      message: String(message).trim(),
      readByTutor: isTutor,
      readByAdmin: isAdmin,
    });
    await request.save();

    if (isAdmin) {
      await Notification.create({
        userId: application.tutorId,
        message: `Gracified support replied about your application to "${request.subject}".`,
        type: 'tutor_application',
        entityId: request._id,
        entityRef: 'TutorRequest',
      });
    } else {
      await notifyRootAdmins({
        message: `${req.user.name} replied about their application to "${request.subject}".`,
        type: 'tutor_application',
        entityId: request._id,
        entityRef: 'TutorRequest',
      });
    }

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUT /api/tutor-requests/:id/applications/:appId/status (admin) ───────────
// Accepting an application matches the tutor, links their class, and resolves.
router.put('/:id/applications/:appId/status', auth, authorize('root_admin'), async (req, res) => {
  try {
    const { status, classroomId } = req.body;
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ message: 'Invalid application status.' });
    }

    const request = await TutorRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    const application = request.applications.id(req.params.appId);
    if (!application) return res.status(404).json({ message: 'Application not found.' });
    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'This application has already been reviewed.' });
    }
    if (['resolved', 'rejected'].includes(request.status)) {
      return res.status(400).json({ message: 'This request is closed.' });
    }

    const tutor = await User.findById(application.tutorId).select('name email profilePicture');
    if (!tutor) return res.status(404).json({ message: 'Applicant tutor not found.' });

    application.status = status;
    application.reviewedAt = new Date();

    if (status === 'accepted') {
      request.applications.forEach((a) => {
        if (a._id.toString() !== application._id.toString() && a.status === 'pending') {
          a.status = 'declined';
        }
      });

      let classroom = null;
      if (classroomId) {
        classroom = await Classroom.findOne({ _id: classroomId, teacherId: tutor._id }).select('name subject level');
      }
      if (!classroom) {
        classroom = await Classroom.findOne({ teacherId: tutor._id }).select('name subject level');
      }

      request.referral = {
        tutorId: tutor._id,
        tutorName: tutor.name,
        tutorContact: null,
        classroomId: classroom ? classroom._id : null,
        classroomName: classroom ? classroom.name : null,
        classUrl: classroom ? `/classrooms/${classroom._id}` : null,
        notes: application.message || '',
        givenAt: new Date(),
      };
      request.status = 'resolved';
      request.resolvedAt = new Date();
      await User.updateOne({ _id: request.studentId }, { $set: { personalTeacherId: tutor._id } });
    }

    await request.save();

    if (status === 'accepted') {
      await Notification.create({
        userId: request.studentId,
        message: `Great news! ${tutor.name} will help with "${request.subject}". Your class is ready — join now.`,
        type: 'tutor_request_resolved',
        entityId: request._id,
        entityRef: 'TutorRequest',
      });
      await Notification.create({
        userId: tutor._id,
        message: `You've been selected to help a student with "${request.subject}". Chat with them now!`,
        type: 'tutor_request_resolved',
        entityId: request._id,
        entityRef: 'TutorRequest',
      });
    } else {
      await Notification.create({
        userId: tutor._id,
        message: `Your application for "${request.subject}" was not selected this time.`,
        type: 'tutor_application',
        entityId: request._id,
        entityRef: 'TutorRequest',
      });
    }

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/tutor-requests/direct (student picks a suggested tutor) ────────
router.post('/direct', auth, authorize('student'), async (req, res) => {
  try {
    const { tutorId, subject, description } = req.body;
    if (!tutorId) return res.status(400).json({ message: 'Choose a tutor to start chatting.' });
    if (!subject || !String(subject).trim() || !description || String(description).trim().length < 10) {
      return res.status(400).json({ message: 'Please provide a subject and a short description.' });
    }

    const tutor = await User.findById(tutorId).select('name role');
    if (!tutor || tutor.role !== 'personal_teacher') {
      return res.status(400).json({ message: 'This tutor is not available.' });
    }

    const openCount = await TutorRequest.countDocuments({
      studentId: req.user._id,
      status: { $in: ['open', 'in_progress'] },
    });
    if (openCount >= 3) {
      return res.status(429).json({ message: 'You already have 3 active requests. Please close one before starting another.' });
    }

    const request = new TutorRequest({
      studentId: req.user._id,
      subject: String(subject).trim(),
      description: String(description).trim(),
      urgency: 'medium',
      mode: 'direct',
      status: 'in_progress',
      referral: { tutorId: tutor._id, tutorName: tutor.name, givenAt: new Date() },
    });
    await request.save();

    await Notification.create({
      userId: tutor._id,
      message: `${req.user.name} picked you as their tutor for "${request.subject}". Reach out and start teaching!`,
      type: 'tutor_request',
      entityId: request._id,
      entityRef: 'TutorRequest',
    });

    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUT /api/tutor-requests/:id/class-link (matched tutor shares class) ─────
// Sharing a class closes the chat loop (direct match flow).
router.put('/:id/class-link', auth, async (req, res) => {
  try {
    const { classroomId } = req.body;
    if (!classroomId) return res.status(400).json({ message: 'Select a class to share.' });

    const request = await TutorRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    const isTutor = String(request.referral?.tutorId) === String(req.user._id);
    if (!isTutor) return res.status(403).json({ message: 'Only the matched tutor can share their class.' });
    if (request.status === 'rejected') return res.status(400).json({ message: 'This request is closed.' });
    if (request.referral?.classroomId) {
      return res.status(400).json({ message: 'You have already shared your class.' });
    }

    const classroom = await Classroom.findOne({ _id: classroomId, teacherId: req.user._id }).select('name subject level');
    if (!classroom) return res.status(404).json({ message: 'Class not found or not owned by you.' });

    request.referral.classroomId = classroom._id;
    request.referral.classroomName = classroom.name;
    request.referral.classUrl = `/classrooms/${classroom._id}`;
    request.referral.givenAt = request.referral.givenAt || new Date();
    request.status = 'resolved';
    request.resolvedAt = request.resolvedAt || new Date();
    request.messages.push({
      senderId: req.user._id,
      senderRole: 'personal_teacher',
      message: `Your class "${classroom.name}" is ready — tap it above to join and we can begin!`,
      readByStudent: false,
    });
    await request.save();

    await Notification.create({
      userId: request.studentId,
      message: `Your tutor ${req.user.name} shared their class "${classroom.name}". Tap to join!`,
      type: 'tutor_request_resolved',
      entityId: request._id,
      entityRef: 'TutorRequest',
    });

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUT /api/tutor-requests/:id/publish (root admin) ─────────────────────────
router.put('/:id/publish', auth, authorize('root_admin'), async (req, res) => {
  try {
    const request = await TutorRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    if (request.mode === 'direct') {
      return res.status(400).json({ message: 'Direct requests cannot be published.' });
    }
    const published = req.body.published === true;
    request.published = published;
    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/tutor-requests (root admin — all requests) ──────────────────────
router.get('/', auth, authorize('root_admin'), async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status && status !== 'all' ? { status } : {};
    const requests = await TutorRequest.find(filter)
      .populate('studentId', 'name email profilePicture')
      .populate('referral.tutorId', 'name email')
      .populate('referral.classroomId', 'name subject level')
      .populate('applications.tutorId', 'name email profilePicture')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/tutor-requests/:id (owner, referred tutor, or root admin) ───────
router.get('/:id', auth, async (req, res) => {
  try {
    const request = await TutorRequest.findById(req.params.id)
      .populate('studentId', 'name email profilePicture')
      .populate('referral.tutorId', 'name email profilePicture')
      .populate('referral.classroomId', 'name subject level')
      .populate('messages.senderId', 'name role profilePicture')
      .populate('applications.tutorId', 'name email profilePicture');

    if (!request) return res.status(404).json({ message: 'Request not found.' });

    const isOwner = String(request.studentId._id || request.studentId) === String(req.user._id);
    const isReferredTutor = req.user.role === 'personal_teacher' && request.referral?.tutorId &&
      String(request.referral.tutorId._id || request.referral.tutorId) === String(req.user._id);
    if (!isOwner && !isReferredTutor && req.user.role !== 'root_admin') {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    // Mark thread messages as read for the viewer
    const viewerIsStudent = req.user.role === 'student';
    const viewerIsTutor = req.user.role === 'personal_teacher';
    let changed = false;
    request.messages.forEach((m) => {
      if (viewerIsStudent && m.senderRole !== 'student' && !m.readByStudent) {
        m.readByStudent = true;
        changed = true;
      }
      if (req.user.role === 'root_admin' && m.senderRole !== 'root_admin' && !m.readByAdmin) {
        m.readByAdmin = true;
        changed = true;
      }
      if (viewerIsTutor && m.senderRole === 'student' && !m.readByTutor) {
        m.readByTutor = true;
        changed = true;
      }
    });
    if (changed) await request.save();

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/tutor-requests/:id/messages (closed-loop communication) ────────
// Student, Gracified root admin, and the referred personal tutor share one thread.
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'Message cannot be empty.' });
    }

    const request = await TutorRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    const isOwner = String(request.studentId) === String(req.user._id);
    const isAdmin = req.user.role === 'root_admin';
    const isTutor = req.user.role === 'personal_teacher' && request.referral?.tutorId &&
      String(request.referral.tutorId) === String(req.user._id);
    if (!isOwner && !isAdmin && !isTutor) return res.status(403).json({ message: 'Forbidden.' });
    if (['resolved', 'rejected'].includes(request.status)) {
      return res.status(400).json({ message: 'This request is closed.' });
    }

    const senderRole = isAdmin ? 'root_admin' : isTutor ? 'personal_teacher' : 'student';
    request.messages.push({
      senderId: req.user._id,
      senderRole,
      message: String(message).trim(),
      readByStudent: isOwner,
      readByAdmin: isAdmin,
      readByTutor: isTutor,
    });

    // The moment anyone besides the student engages, the request is in progress
    if (!isOwner && request.status === 'open') {
      request.status = 'in_progress';
    }

    await request.save();

    const tutorPresent = !!request.referral?.tutorId;

    // Notify everyone except the sender
    if (!isOwner) {
      await Notification.create({
        userId: request.studentId,
        message: isTutor
          ? `Your tutor ${req.user.name} replied to your "${request.subject}" request.`
          : `Gracified support replied to your "${request.subject}" tutor request.`,
        type: 'tutor_request_message',
        entityId: request._id,
        entityRef: 'TutorRequest',
      });
    }
    if (!isAdmin && request.mode === 'admin') {
      await notifyRootAdmins({
        message: `${req.user.name} replied on the "${request.subject}" tutor request.`,
        type: 'tutor_request_message',
        entityId: request._id,
        entityRef: 'TutorRequest',
      });
    }
    if (tutorPresent && !isTutor) {
      await Notification.create({
        userId: request.referral.tutorId,
        message: `${isOwner ? 'Your new student' : 'Gracified support'} replied on the "${request.subject}" tutor request.`,
        type: 'tutor_request_message',
        entityId: request._id,
        entityRef: 'TutorRequest',
      });
    }

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUT /api/tutor-requests/:id/status (root admin) ──────────────────────────
router.put('/:id/status', auth, authorize('root_admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'in_progress', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Use referral endpoint to resolve.' });
    }

    const request = await TutorRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    if (status === 'rejected') {
      request.resolvedAt = new Date();
      await request.save();
    }

    await Notification.create({
      userId: request.studentId,
      message:
        status === 'rejected'
          ? `Your "${request.subject}" tutor request was reviewed and could not be approved.`
          : `Your "${request.subject}" tutor request is now being handled.`,
      type: 'tutor_request',
      entityId: request._id,
      entityRef: 'TutorRequest',
    });

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUT /api/tutor-requests/:id/referral (root admin closes the loop) ────────
router.put('/:id/referral', auth, authorize('root_admin'), async (req, res) => {
  try {
    const { tutorId, tutorName, tutorContact, notes } = req.body;

    if (!tutorId && !tutorName) {
      return res.status(400).json({ message: 'Provide a platform tutor or an external tutor name.' });
    }

    let resolvedTutorName = tutorName || null;
    if (tutorId) {
      const tutor = await User.findById(tutorId).select('name email');
      if (!tutor) return res.status(404).json({ message: 'Referred tutor not found.' });
      resolvedTutorName = tutor.name;
    }

    const request = await TutorRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    request.referral = {
      tutorId: tutorId || null,
      tutorName: resolvedTutorName,
      tutorContact: tutorContact || null,
      notes: notes || '',
      givenAt: new Date(),
    };
    request.status = 'resolved';
    request.resolvedAt = new Date();
    await request.save();

    await Notification.create({
      userId: request.studentId,
      message: `Your tutor request for "${request.subject}" has been resolved. Referral: ${resolvedTutorName}.`,
      type: 'tutor_request_resolved',
      entityId: request._id,
      entityRef: 'TutorRequest',
    });

    // Link the student to their referred platform tutor and notify that tutor
    if (tutorId) {
      await User.updateOne({ _id: request.studentId }, { $set: { personalTeacherId: tutorId } });
      const student = await User.findById(request.studentId).select('name email');
      await Notification.create({
        userId: tutorId,
        message: `A new student, ${student?.name || 'a student'}, needs help with "${request.subject}". Reach out and start teaching!`,
        type: 'tutor_request',
        entityId: request._id,
        entityRef: 'TutorRequest',
      });
    }

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
