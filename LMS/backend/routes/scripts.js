const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

const { auth, authorize } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const ScriptShareConfig = require('../models/ScriptShareConfig');
const ScriptAccessSession = require('../models/ScriptAccessSession');
const Exam = require('../models/Exam');
const ExamSubmission = require('../models/ExamSubmission');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const School = require('../models/School');
const Classroom = require('../models/Classroom');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a random numeric OTP */
function generateOTP(length = 6) {
    let otp = '';
    for (let i = 0; i < length; i++) otp += Math.floor(Math.random() * 10);
    return otp;
}

/**
 * Determine which users should receive the OTP for a given parent doc.
 * Returns an array of User documents.
 */
async function resolveAuthorities(parentType, parentDoc, assignedMarkerId = null) {
    const authorityIds = new Set();

    // Always include the creator
    if (parentDoc.creatorId) authorityIds.add(parentDoc.creatorId.toString());

    // For exams with a class: add the classroom's teacher
    if (parentType === 'exam' && parentDoc.classId) {
        const classroom = await Classroom.findById(parentDoc.classId).select('teacherId');
        if (classroom && classroom.teacherId) authorityIds.add(classroom.teacherId.toString());
    }

    // For assignments: add classroom teacher
    if (parentType === 'assignment' && parentDoc.classroomId) {
        const classroom = await Classroom.findById(parentDoc.classroomId).select('teacherId');
        if (classroom && classroom.teacherId) authorityIds.add(classroom.teacherId.toString());
    }

    // If exam/assignment is linked to a school, add school admins
    const schoolId = parentDoc.schoolId || null;
    if (schoolId) {
        const school = await School.findById(schoolId).select('adminId');
        if (school && school.adminId) authorityIds.add(school.adminId.toString());
    }

    // If an explicit marker is assigned, prefer them
    if (assignedMarkerId) authorityIds.add(assignedMarkerId.toString());

    // Also always add all root admins
    const rootAdmins = await User.find({ role: 'root_admin' }).select('_id');
    rootAdmins.forEach(u => authorityIds.add(u._id.toString()));

    if (authorityIds.size === 0) return [];

    return User.find({ _id: { $in: Array.from(authorityIds) } }).select('name email role');
}

/**
 * Check whether the authenticated user is authorised to manage sharing
 * for a given parent document (exam or assignment).
 */
function canManageShare(user, parentDoc) {
    if (user.role === 'root_admin') return true;
    const creatorId = (parentDoc.creatorId || '').toString();
    if (creatorId === user._id.toString()) return true;

    // school admin over the same school
    if (user.role === 'school_admin' && parentDoc.schoolId) {
        const userSchools = (Array.isArray(user.schoolId) ? user.schoolId : [user.schoolId])
            .map(id => (id._id || id).toString());
        return userSchools.includes(parentDoc.schoolId.toString());
    }
    return false;
}

/**
 * Create a readable group slug using candidate names or assignment context.
 */
function createShareSlug(baseText) {
    const safe = String(baseText || 'shared-scripts')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 40);
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `${safe}-${suffix}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARE CONFIG — EXAM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route  GET /api/scripts/exam/:examId/share-config
 * @desc   Get share configuration for an exam
 * @access Owner / Admin
 */
router.get('/exam/:examId/share-config', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.examId);
        if (!exam) return res.status(404).json({ message: 'Exam not found' });
        if (!canManageShare(req.user, exam)) return res.status(403).json({ message: 'Access denied' });

        const config = await ScriptShareConfig.findOne({ parentId: exam._id, parentType: 'exam' });
        res.json(config || {
            parentId: exam._id,
            parentType: 'exam',
            isShareable: false,
            defaultAccessType: 'view',
            otpLifespanMinutes: 30,
            accessDurationMinutes: 60,
            assignedMarkerId: null
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route  PUT /api/scripts/exam/:examId/share-config
 * @desc   Create or update share configuration for an exam
 * @access Owner / Admin
 */
router.put('/exam/:examId/share-config', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.examId);
        if (!exam) return res.status(404).json({ message: 'Exam not found' });
        if (!canManageShare(req.user, exam)) return res.status(403).json({ message: 'Access denied' });

        const { isShareable, defaultAccessType, otpLifespanMinutes, accessDurationMinutes, assignedMarkerId } = req.body;

        const config = await ScriptShareConfig.findOneAndUpdate(
            { parentId: exam._id, parentType: 'exam' },
            {
                $set: {
                    parentId: exam._id,
                    parentType: 'exam',
                    ...(isShareable !== undefined && { isShareable }),
                    ...(defaultAccessType && { defaultAccessType }),
                    ...(otpLifespanMinutes && { otpLifespanMinutes }),
                    ...(accessDurationMinutes && { accessDurationMinutes }),
                    ...(assignedMarkerId !== undefined && { assignedMarkerId }),
                    configuredBy: req.user._id
                }
            },
            { upsert: true, new: true }
        );

        res.json(config);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SHARE CONFIG — ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route  GET /api/scripts/assignment/:assignmentId/share-config
 * @desc   Get share configuration for an assignment
 * @access Owner / Admin
 */
router.get('/assignment/:assignmentId/share-config', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.assignmentId).populate('classroomId', 'teacherId schoolId');
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

        // Synthesize a creatorId from classroom teacher
        const fakeParentDoc = {
            creatorId: assignment.classroomId?.teacherId,
            schoolId: assignment.classroomId?.schoolId?.[0] || null
        };
        if (!canManageShare(req.user, fakeParentDoc)) return res.status(403).json({ message: 'Access denied' });

        const config = await ScriptShareConfig.findOne({ parentId: assignment._id, parentType: 'assignment' });
        res.json(config || {
            parentId: assignment._id,
            parentType: 'assignment',
            isShareable: false,
            defaultAccessType: 'view',
            otpLifespanMinutes: 30,
            accessDurationMinutes: 60,
            assignedMarkerId: null
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route  PUT /api/scripts/assignment/:assignmentId/share-config
 * @desc   Create or update share configuration for an assignment
 * @access Owner / Admin
 */
router.put('/assignment/:assignmentId/share-config', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.assignmentId).populate('classroomId', 'teacherId schoolId');
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

        const fakeParentDoc = {
            creatorId: assignment.classroomId?.teacherId,
            schoolId: assignment.classroomId?.schoolId?.[0] || null
        };
        if (!canManageShare(req.user, fakeParentDoc)) return res.status(403).json({ message: 'Access denied' });

        const { isShareable, defaultAccessType, otpLifespanMinutes, accessDurationMinutes, assignedMarkerId } = req.body;

        const config = await ScriptShareConfig.findOneAndUpdate(
            { parentId: assignment._id, parentType: 'assignment' },
            {
                $set: {
                    parentId: assignment._id,
                    parentType: 'assignment',
                    ...(isShareable !== undefined && { isShareable }),
                    ...(defaultAccessType && { defaultAccessType }),
                    ...(otpLifespanMinutes && { otpLifespanMinutes }),
                    ...(accessDurationMinutes && { accessDurationMinutes }),
                    ...(assignedMarkerId !== undefined && { assignedMarkerId }),
                    configuredBy: req.user._id
                }
            },
            { upsert: true, new: true }
        );

        res.json(config);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SHARE LINK GENERATION (per submission)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route  POST /api/scripts/exam-submission/:submissionId/generate-link
 * @desc   Generate (or retrieve) a share link for a specific exam submission
 * @access Owner / Admin
 */
router.post('/exam-submission/:submissionId/generate-link', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const submission = await ExamSubmission.findById(req.params.submissionId);
        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        const exam = await Exam.findById(submission.examId);
        if (!exam) return res.status(404).json({ message: 'Exam not found' });
        if (!canManageShare(req.user, exam)) return res.status(403).json({ message: 'Access denied' });

        const config = await ScriptShareConfig.findOne({ parentId: exam._id, parentType: 'exam' });
        if (!config || !config.isShareable) {
            return res.status(400).json({ message: 'Sharing is not enabled for this exam. Enable it in share settings first.' });
        }

        // Find existing pending/active session for this submission, or create new
        let session = await ScriptAccessSession.findOne({
            submissionType: 'exam',
            status: { $in: ['pending_otp'] },
            $or: [
                { submissionRef: submission._id.toString() },
                { submissionRefs: submission._id.toString() }
            ]
        });

        if (!session) {
            session = await ScriptAccessSession.create({
                shareToken: randomUUID().replace(/-/g, ''),
                submissionType: 'exam',
                submissionRef: submission._id.toString(),
                submissionRefs: [submission._id.toString()],
                parentId: exam._id,
                studentId: submission.studentId || null,
                accessType: config.defaultAccessType,
                status: 'pending_otp'
            });
        }

        const shareUrl = `${process.env.FRONTEND_URL}/shared-script/${session.shareToken}`;
        res.json({ shareToken: session.shareToken, shareUrl, accessType: config.defaultAccessType });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route  POST /api/scripts/exam-submission/group-generate-link
 * @desc   Generate a share link for a group of exam submissions
 * @access Owner / Admin
 */
router.post('/exam-submission/group-generate-link', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const { examId, submissionIds } = req.body;
        if (!examId || !Array.isArray(submissionIds) || submissionIds.length < 2) {
            return res.status(400).json({ message: 'examId and at least two submissionIds are required' });
        }

        const exam = await Exam.findById(examId);
        if (!exam) return res.status(404).json({ message: 'Exam not found' });
        if (!canManageShare(req.user, exam)) return res.status(403).json({ message: 'Access denied' });

        const config = await ScriptShareConfig.findOne({ parentId: exam._id, parentType: 'exam' });
        if (!config || !config.isShareable) {
            return res.status(400).json({ message: 'Sharing is not enabled for this exam. Enable it in share settings first.' });
        }

        const submissions = await ExamSubmission.find({
            _id: { $in: submissionIds },
            examId: exam._id
        });

        if (submissions.length !== submissionIds.length) {
            return res.status(404).json({ message: 'One or more submissions were not found for this exam' });
        }

        const candidateNames = submissions.map(s => s.candidateName || s.candidateEmail || s.studentId?.toString() || 'candidate');
        const baseSlug = candidateNames.length === 2
            ? `${candidateNames[0]}-and-${candidateNames[1]}`
            : `${candidateNames[0]}-and-${candidateNames.length - 1}-others`;
        const groupName = `group-${candidateNames.length}-${candidateNames[0]}`;

        let shareToken = createShareSlug(baseSlug);
        while (await ScriptAccessSession.findOne({ shareToken })) {
            shareToken = createShareSlug(baseSlug);
        }

        let session = await ScriptAccessSession.findOne({
            submissionType: 'exam',
            submissionRefs: { $all: submissionIds, $size: submissionIds.length },
            status: { $in: ['pending_otp'] }
        });

        if (!session) {
            session = await ScriptAccessSession.create({
                shareToken,
                submissionType: 'exam',
                submissionRef: submissionIds[0].toString(),
                submissionRefs: submissionIds.map(id => id.toString()),
                groupName,
                parentId: exam._id,
                accessType: config.defaultAccessType,
                status: 'pending_otp'
            });
        }

        const shareUrl = `${process.env.FRONTEND_URL}/shared-script/${session.shareToken}`;
        res.json({ shareToken: session.shareToken, shareUrl, accessType: config.defaultAccessType, groupName: session.groupName });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route  POST /api/scripts/assignment-submission/:assignmentId/:studentId/generate-link
 * @desc   Generate (or retrieve) a share link for a specific assignment submission
 * @access Owner / Admin
 */
router.post('/assignment-submission/:assignmentId/:studentId/generate-link', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const { assignmentId, studentId } = req.params;
        const assignment = await Assignment.findById(assignmentId).populate('classroomId', 'teacherId schoolId');
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

        const fakeParentDoc = {
            creatorId: assignment.classroomId?.teacherId,
            schoolId: assignment.classroomId?.schoolId?.[0] || null
        };
        if (!canManageShare(req.user, fakeParentDoc)) return res.status(403).json({ message: 'Access denied' });

        const config = await ScriptShareConfig.findOne({ parentId: assignment._id, parentType: 'assignment' });
        if (!config || !config.isShareable) {
            return res.status(400).json({ message: 'Sharing is not enabled for this assignment. Enable it in share settings first.' });
        }

        const submissionExists = assignment.submissions.some(s => s.studentId.toString() === studentId);
        if (!submissionExists) return res.status(404).json({ message: 'Submission not found for this student' });

        const submissionRef = `${assignmentId}:${studentId}`;

        let session = await ScriptAccessSession.findOne({
            submissionType: 'assignment',
            status: 'pending_otp',
            $or: [
                { submissionRef },
                { submissionRefs: submissionRef }
            ]
        });

        if (!session) {
            session = await ScriptAccessSession.create({
                shareToken: randomUUID().replace(/-/g, ''),
                submissionType: 'assignment',
                submissionRef,
                submissionRefs: [submissionRef],
                parentId: assignment._id,
                studentId: studentId || null,
                accessType: config.defaultAccessType,
                status: 'pending_otp'
            });
        }

        const shareUrl = `${process.env.FRONTEND_URL}/shared-script/${session.shareToken}`;
        res.json({ shareToken: session.shareToken, shareUrl, accessType: config.defaultAccessType });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route  POST /api/scripts/assignment-submission/group-generate-link
 * @desc   Generate a share link for a group of assignment submissions
 * @access Owner / Admin
 */
router.post('/assignment-submission/group-generate-link', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const { assignmentId, submissionIds } = req.body;
        if (!assignmentId || !Array.isArray(submissionIds) || submissionIds.length < 2) {
            return res.status(400).json({ message: 'assignmentId and at least two submissionIds are required' });
        }

        const assignment = await Assignment.findById(assignmentId).populate('classroomId', 'teacherId schoolId').select('title submissions');
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

        const fakeParentDoc = {
            creatorId: assignment.classroomId?.teacherId,
            schoolId: assignment.classroomId?.schoolId?.[0] || null
        };
        if (!canManageShare(req.user, fakeParentDoc)) return res.status(403).json({ message: 'Access denied' });

        const config = await ScriptShareConfig.findOne({ parentId: assignment._id, parentType: 'assignment' });
        if (!config || !config.isShareable) {
            return res.status(400).json({ message: 'Sharing is not enabled for this assignment. Enable it in share settings first.' });
        }

        const submissionMap = assignment.submissions.reduce((map, s) => {
            const studentId = s.studentId?.toString() || s.studentId;
            map[`${assignment._id}:${studentId}`] = s;
            return map;
        }, {});

        const missingIds = submissionIds.filter(ref => !submissionMap[ref]);
        if (missingIds.length > 0) {
            return res.status(404).json({ message: 'One or more submissions were not found for this assignment' });
        }

        const submissions = submissionIds.map(ref => submissionMap[ref]);
        const candidateNames = submissions.map(s => s.candidateName || s.studentId?.toString() || 'candidate');
        const baseSlug = candidateNames.length === 2
            ? `${candidateNames[0]}-and-${candidateNames[1]}`
            : `${candidateNames[0]}-and-${candidateNames.length - 1}-others`;
        const groupName = `group-${candidateNames.length}-${candidateNames[0]}`;

        let shareToken = createShareSlug(baseSlug);
        while (await ScriptAccessSession.findOne({ shareToken })) {
            shareToken = createShareSlug(baseSlug);
        }

        let session = await ScriptAccessSession.findOne({
            submissionType: 'assignment',
            submissionRefs: { $all: submissionIds, $size: submissionIds.length },
            status: { $in: ['pending_otp'] }
        });

        if (!session) {
            session = await ScriptAccessSession.create({
                shareToken,
                submissionType: 'assignment',
                submissionRef: submissionIds[0],
                submissionRefs: submissionIds,
                groupName,
                parentId: assignment._id,
                studentId: null,
                accessType: config.defaultAccessType,
                status: 'pending_otp'
            });
        }

        const shareUrl = `${process.env.FRONTEND_URL}/shared-script/${session.shareToken}`;
        res.json({ shareToken: session.shareToken, shareUrl, accessType: config.defaultAccessType, groupName: session.groupName });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC SHARE FLOW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route  GET /api/scripts/share/:shareToken
 * @desc   Resolve a share token — returns metadata for the request-access page
 * @access Public
 */
router.get('/share/:shareToken', async (req, res) => {
    try {
        const session = await ScriptAccessSession.findOne({ shareToken: req.params.shareToken });
        if (!session) return res.status(404).json({ message: 'Share link is invalid or has expired' });

        let title = '';
        let candidateName = '';
        let submittedAt = null;
        let accessType = session.accessType;
        let groupName = session.groupName || null;
        let candidates = [];

        if (session.submissionType === 'exam') {
            if (session.submissionRefs && session.submissionRefs.length > 1) {
                const submissions = await ExamSubmission.find({ _id: { $in: session.submissionRefs } }).populate('examId', 'title');
                if (!submissions || submissions.length === 0) return res.status(404).json({ message: 'Submissions not found' });
                title = submissions[0].examId?.title || 'Exam';
                submittedAt = submissions[0].submittedAt;
                candidates = submissions.map(sub => ({
                    submissionRef: sub._id.toString(),
                    candidateName: sub.candidateName || (sub.studentId ? sub.studentId.toString() : 'Anonymous'),
                    studentId: sub.studentId,
                    submittedAt: sub.submittedAt
                }));
                candidateName = `${submissions.length} candidates`;
            } else {
                const submission = await ExamSubmission.findById(session.submissionRef).populate('examId', 'title');
                if (!submission) return res.status(404).json({ message: 'Submission not found' });
                title = submission.examId?.title || 'Exam';
                candidateName = submission.candidateName || '';
                submittedAt = submission.submittedAt;
                if (submission.studentId) {
                    const student = await User.findById(submission.studentId).select('name');
                    if (student) candidateName = student.name;
                }
                candidates = [{
                    submissionRef: submission._id.toString(),
                    candidateName,
                    studentId: submission.studentId,
                    submittedAt: submission.submittedAt
                }];
            }
        } else {
            if (session.submissionRefs && session.submissionRefs.length > 1) {
                const assignmentIds = [...new Set(session.submissionRefs.map(ref => ref.split(':')[0]))];
                const assignments = await Assignment.find({ _id: { $in: assignmentIds } }).select('title submissions');
                title = assignments[0]?.title || 'Assignment';
                candidates = session.submissionRefs.map(ref => {
                    const [assignmentId, studentId] = ref.split(':');
                    const assignment = assignments.find(a => a._id.toString() === assignmentId);
                    const sub = assignment?.submissions.find(s => s.studentId.toString() === studentId);
                    return {
                        submissionRef: ref,
                        candidateName: sub?.candidateName || studentId,
                        studentId,
                        submittedAt: sub?.submittedAt
                    };
                });
                if (candidates.length > 0) {
                    candidateName = `${candidates.length} candidates`;
                    submittedAt = candidates[0].submittedAt;
                }
            } else {
                const [assignmentId, studentId] = session.submissionRef.split(':');
                const assignment = await Assignment.findById(assignmentId).select('title submissions');
                if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
                title = assignment.title;
                const sub = assignment.submissions.find(s => s.studentId.toString() === studentId);
                if (!sub) return res.status(404).json({ message: 'Submission not found' });
                submittedAt = sub.submittedAt;
                if (studentId) {
                    const student = await User.findById(studentId).select('name');
                    if (student) candidateName = student.name;
                }
                candidates = [{
                    submissionRef: session.submissionRef,
                    candidateName,
                    studentId,
                    submittedAt: sub.submittedAt
                }];
            }
        }

        res.json({
            shareToken: session.shareToken,
            submissionType: session.submissionType,
            title,
            candidateName,
            submittedAt,
            accessType,
            status: session.status,
            groupName,
            candidates,
            accessToken: session.status === 'active' ? session.accessToken : null,
            accessTokenExpiresAt: session.status === 'active' ? session.accessTokenExpiresAt : null
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route  POST /api/scripts/share/:shareToken/request-access
 * @desc   Requester submits their info → OTP is generated & sent to authority
 * @access Public
 */
router.post('/share/:shareToken/request-access', async (req, res) => {
    try {
        const { requesterName, requesterEmail } = req.body;
        if (!requesterName || !requesterEmail) {
            return res.status(400).json({ message: 'Name and email are required' });
        }

        const session = await ScriptAccessSession.findOne({ shareToken: req.params.shareToken });
        if (!session) return res.status(404).json({ message: 'Share link is invalid' });

        // If already active with a valid token, don't generate a new OTP
        if (session.status === 'active' && session.accessTokenExpiresAt > new Date()) {
            return res.json({ message: 'Access already granted. Use your existing access link.' });
        }

        // Get share config for OTP lifespan
        const config = await ScriptShareConfig.findOne({ parentId: session.parentId, parentType: session.submissionType });
        const otpLifespanMs = ((config?.otpLifespanMinutes) || 30) * 60 * 1000;

        // Generate OTP
        const otp = generateOTP(6);
        const otpHash = await bcrypt.hash(otp, 10);
        const otpExpiresAt = new Date(Date.now() + otpLifespanMs);

        // Update session
        session.requesterName = requesterName;
        session.requesterEmail = requesterEmail;
        session.otpHash = otpHash;
        session.otpExpiresAt = otpExpiresAt;
        session.status = 'pending_otp';

        // Resolve parent document for authority lookup
        let parentDoc = null;
        if (session.submissionType === 'exam') {
            parentDoc = await Exam.findById(session.parentId);
        } else {
            parentDoc = await Assignment.findById(session.parentId).populate('classroomId', 'teacherId schoolId');
            if (parentDoc) {
                // Normalise to match exam structure for resolveAuthorities
                parentDoc.creatorId = parentDoc.classroomId?.teacherId;
                parentDoc.schoolId = parentDoc.classroomId?.schoolId?.[0] || null;
            }
        }

        const authorities = parentDoc
            ? await resolveAuthorities(session.submissionType, parentDoc, config?.assignedMarkerId)
            : [];

        session.notifiedAuthorityIds = authorities.map(a => a._id);
        await session.save();

        // Send OTP email to each authority
        const otpEmailHtml = `
            <h2 style="color: #4f46e5;">Script Access Request</h2>
            <p>Someone is requesting <strong>${session.accessType}</strong> access to an answer script.</p>
            
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0;"><strong>Requester Name:</strong> ${requesterName}</p>
                <p style="margin: 0 0 8px 0;"><strong>Requester Email:</strong> ${requesterEmail}</p>
                <p style="margin: 0 0 8px 0;"><strong>Access Type:</strong> <span style="text-transform: capitalize;">${session.accessType}</span></p>
            </div>
            
            <p>If you authorise this person to access the script, share the OTP below with them:</p>
            
            <div style="background: #4f46e5; color: white; border-radius: 16px; padding: 30px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">One-Time Password</p>
                <p style="margin: 0; font-size: 48px; font-weight: 900; letter-spacing: 12px;">${otp}</p>
                <p style="margin: 12px 0 0 0; font-size: 13px; opacity: 0.7;">Valid for ${config?.otpLifespanMinutes || 30} minutes</p>
            </div>
            
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0; color: #991b1b; font-size: 14px;">
                    ⚠️ <strong>Only share this OTP if you authorise this person.</strong> Do not share it if the request is unexpected.
                </p>
            </div>

            <p style="font-size: 13px; color: #6b7280;">If you did not expect this request, please ignore this email. The OTP will expire automatically.</p>
        `;

        for (const authority of authorities) {
            await sendEmail({
                to: authority.email,
                subject: `Script Access Request — ${requesterName} wants ${session.accessType} access`,
                html: otpEmailHtml,
                isSystemEmail: true
            }).catch(err => console.error(`Failed to send OTP to ${authority.email}:`, err.message));
        }

        res.json({
            message: `Access request sent. The exam authority has been notified and will provide you with an OTP if approved.`,
            otpExpiresAt
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route  POST /api/scripts/share/:shareToken/verify-otp
 * @desc   Requester enters OTP → receives a time-limited access token
 * @access Public
 */
router.post('/share/:shareToken/verify-otp', async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp) return res.status(400).json({ message: 'OTP is required' });

        const session = await ScriptAccessSession.findOne({ shareToken: req.params.shareToken });
        if (!session) return res.status(404).json({ message: 'Share link is invalid' });

        if (!session.otpHash || !session.otpExpiresAt) {
            return res.status(400).json({ message: 'No access request is pending for this link. Please request access first.' });
        }

        if (new Date() > session.otpExpiresAt) {
            return res.status(410).json({ message: 'OTP has expired. Please request access again.' });
        }

        const isMatch = await bcrypt.compare(otp, session.otpHash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid OTP. Please check with the authority and try again.' });

        // Get access duration from config
        const config = await ScriptShareConfig.findOne({ parentId: session.parentId, parentType: session.submissionType });
        const accessDurationMs = ((config?.accessDurationMinutes) || 60) * 60 * 1000;

        // Issue access token
        const accessToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
        const accessTokenExpiresAt = new Date(Date.now() + accessDurationMs);

        session.accessToken = accessToken;
        session.accessTokenExpiresAt = accessTokenExpiresAt;
        session.status = 'active';
        session.otpHash = undefined; // Clear OTP for security
        await session.save();

        res.json({
            accessToken,
            accessTokenExpiresAt,
            accessType: session.accessType,
            accessDurationMinutes: config?.accessDurationMinutes || 60
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SESSION ENDPOINTS (access token authenticated)
// ─────────────────────────────────────────────────────────────────────────────

/** Middleware to validate access token and attach session to req */
async function validateAccessToken(req, res, next) {
    const token = req.headers['x-access-token'] || req.query.accessToken;
    if (!token) return res.status(401).json({ message: 'Access token required' });

    const session = await ScriptAccessSession.findOne({ accessToken: token });
    if (!session) return res.status(401).json({ message: 'Invalid access token' });

    // Auto-expire check
    if (session.status === 'active' && new Date() > session.accessTokenExpiresAt) {
        session.status = 'expired';
        await session.save();
    }

    if (session.status !== 'active') {
        return res.status(410).json({
            message: session.status === 'expired'
                ? 'Your access session has expired. Please request access again.'
                : 'This access session is no longer active.',
            status: session.status
        });
    }

    req.scriptSession = session;
    next();
}

/**
 * @route  GET /api/scripts/session/:accessToken
 * @desc   Get full script data for view/grade
 * @access Access Token
 */
router.get('/session/:accessToken', async (req, res) => {
    try {
        // Inline token validation (token is in URL param here)
        const session = await ScriptAccessSession.findOne({ accessToken: req.params.accessToken });
        if (!session) return res.status(401).json({ message: 'Invalid access token' });

        if (session.status === 'active' && new Date() > session.accessTokenExpiresAt) {
            session.status = 'expired';
            await session.save();
        }

        if (session.status !== 'active') {
            return res.status(410).json({
                message: session.status === 'expired'
                    ? 'Your access session has expired.'
                    : 'This session is no longer active.',
                status: session.status
            });
        }

        const timeRemainingMs = Math.max(0, new Date(session.accessTokenExpiresAt) - new Date());
        let scriptData = {};

        if (session.submissionType === 'exam') {
            const exam = await Exam.findById(session.parentId);
            if (!exam) return res.status(404).json({ message: 'Exam not found' });

            if (session.submissionRefs && session.submissionRefs.length > 1) {
                const submissions = await ExamSubmission.find({ _id: { $in: session.submissionRefs } })
                    .populate('studentId', 'name email');

                scriptData = {
                    type: 'exam',
                    examTitle: exam.title,
                    examDescription: exam.description,
                    questions: exam.questions,
                    submissions: submissions.map(sub => ({
                        submissionRef: sub._id.toString(),
                        candidateName: sub.candidateName || sub.studentId?.name || 'Unknown',
                        candidateEmail: sub.candidateEmail || sub.studentId?.email || '',
                        submittedAt: sub.submittedAt,
                        status: sub.status,
                        totalScore: sub.totalScore,
                        answers: sub.answers,
                        gradingSnapshot: session.gradingSnapshot?.[sub._id.toString()] || null
                    })),
                    groupName: session.groupName,
                    gradingSnapshot: session.gradingSnapshot
                };
            } else {
                const submission = await ExamSubmission.findById(session.submissionRef)
                    .populate('examId')
                    .populate('studentId', 'name email');

                if (!submission) return res.status(404).json({ message: 'Submission not found' });

                const examDetail = submission.examId;
                scriptData = {
                    type: 'exam',
                    examTitle: examDetail.title,
                    examDescription: examDetail.description,
                    candidateName: submission.candidateName || submission.studentId?.name || 'Unknown',
                    candidateEmail: submission.candidateEmail || submission.studentId?.email || '',
                    submittedAt: submission.submittedAt,
                    status: submission.status,
                    totalScore: submission.totalScore,
                    questions: examDetail.questions,
                    answers: submission.answers,
                    submissionRef: submission._id.toString(),
                    gradingSnapshot: session.gradingSnapshot
                };
            }
        } else {
            const assignment = await Assignment.findById(session.parentId);
            if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

            if (session.submissionRefs && session.submissionRefs.length > 1) {
                const submissions = session.submissionRefs.map(ref => {
                    const [assignmentId, studentId] = ref.split(':');
                    const submission = assignment.submissions.find(s => s.studentId.toString() === studentId);
                    const student = submission ? submission.studentId : null;
                    return {
                        submissionRef: ref,
                        candidateName: student?.name || 'Unknown',
                        candidateEmail: student?.email || '',
                        submittedAt: submission?.submittedAt,
                        status: submission?.status,
                        score: submission?.score,
                        feedback: submission?.feedback,
                        answers: submission?.answers,
                        questionScores: submission?.questionScores,
                        gradingSnapshot: session.gradingSnapshot?.[ref] || null
                    };
                });

                scriptData = {
                    type: 'assignment',
                    assignmentTitle: assignment.title,
                    assignmentDescription: assignment.description,
                    assignmentType: assignment.assignmentType,
                    maxScore: assignment.maxScore,
                    questions: assignment.questions,
                    submissions,
                    groupName: session.groupName,
                    gradingSnapshot: session.gradingSnapshot
                };
            } else {
                const [assignmentId, studentId] = session.submissionRef.split(':');
                const submission = assignment.submissions.find(s => s.studentId.toString() === studentId);
                if (!submission) return res.status(404).json({ message: 'Submission not found' });

                const student = await User.findById(studentId).select('name email');

                scriptData = {
                    type: 'assignment',
                    assignmentTitle: assignment.title,
                    assignmentDescription: assignment.description,
                    assignmentType: assignment.assignmentType,
                    maxScore: assignment.maxScore,
                    candidateName: student?.name || 'Unknown',
                    candidateEmail: student?.email || '',
                    submittedAt: submission.submittedAt,
                    status: submission.status,
                    score: submission.score,
                    feedback: submission.feedback,
                    questions: assignment.questions,
                    answers: submission.answers,
                    questionScores: submission.questionScores,
                    submissionRef: session.submissionRef,
                    gradingSnapshot: session.gradingSnapshot
                };
            }
        }

        res.json({
            session: {
                shareToken: session.shareToken,
                accessType: session.accessType,
                accessTokenExpiresAt: session.accessTokenExpiresAt,
                timeRemainingMs,
                status: session.status,
                requesterName: session.requesterName,
                savedAt: session.savedAt
            },
            script: scriptData
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route  PATCH /api/scripts/session/:accessToken/grade
 * @desc   Save grading progress (can be called multiple times before expiry)
 * @access Access Token (grade type only)
 */
router.patch('/session/:accessToken/grade', async (req, res) => {
    try {
        const session = await ScriptAccessSession.findOne({ accessToken: req.params.accessToken });
        if (!session) return res.status(401).json({ message: 'Invalid access token' });

        if (session.accessType !== 'grade') {
            return res.status(403).json({ message: 'This session only has view access' });
        }

        if (session.status === 'active' && new Date() > session.accessTokenExpiresAt) {
            session.status = 'expired';
            await session.save();
            return res.status(410).json({ message: 'Session expired. Grades not saved.', status: 'expired' });
        }

        if (session.status !== 'active') {
            return res.status(410).json({ message: 'Session is no longer active.', status: session.status });
        }

        const { gradingData } = req.body;
        if (!gradingData) return res.status(400).json({ message: 'gradingData is required' });

        // Determine which submission this grading snapshot belongs to
        const targetRef = gradingData.submissionRef || session.submissionRef || (session.submissionRefs?.[0] || null);
        if (!targetRef) return res.status(400).json({ message: 'submissionRef is required for grade snapshots' });

        if (session.submissionRefs && session.submissionRefs.length > 1) {
            session.gradingSnapshot = session.gradingSnapshot || {};
            session.gradingSnapshot[targetRef] = gradingData;
        } else {
            session.gradingSnapshot = gradingData;
        }

        await session.save();

        res.json({ message: 'Grading progress saved', savedAt: new Date() });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route  POST /api/scripts/session/:accessToken/finalize
 * @desc   Apply saved grading to the real submission and mark session as saved
 * @access Access Token (grade type only)
 */
router.post('/session/:accessToken/finalize', async (req, res) => {
    try {
        const session = await ScriptAccessSession.findOne({ accessToken: req.params.accessToken });
        if (!session) return res.status(401).json({ message: 'Invalid access token' });

        if (session.accessType !== 'grade') {
            return res.status(403).json({ message: 'This session only has view access' });
        }

        if (session.status === 'active' && new Date() > session.accessTokenExpiresAt) {
            session.status = 'expired';
            await session.save();
            return res.status(410).json({ message: 'Session expired. Grades cannot be saved.', status: 'expired' });
        }

        if (session.status !== 'active') {
            return res.status(410).json({ message: 'Session is no longer active.', status: session.status });
        }

        const { gradingData } = req.body;
        const dataToApply = gradingData || session.gradingSnapshot;
        if (!dataToApply) return res.status(400).json({ message: 'No grading data to finalize' });

        const targetRef = gradingData?.submissionRef || session.submissionRef || (session.submissionRefs?.[0] || null);
        if (!targetRef) return res.status(400).json({ message: 'submissionRef is required to finalize grading' });

        // Apply to real submission
        if (session.submissionType === 'exam') {
            const submission = await ExamSubmission.findById(targetRef).populate('examId');
            if (!submission) return res.status(404).json({ message: 'Submission not found' });

            const { questionGrades, feedback } = dataToApply;
            if (Array.isArray(questionGrades)) {
                questionGrades.forEach(grade => {
                    const ans = submission.answers.find(a => a.questionIndex === grade.index);
                    if (ans) ans.score = grade.score;
                });
                submission.totalScore = submission.answers.reduce((acc, a) => acc + (a.score || 0), 0);
                submission.status = 'graded';
                await submission.save();
            }
        } else {
            const [assignmentId, studentId] = targetRef.split(':');
            const assignment = await Assignment.findById(assignmentId);
            if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

            const submission = assignment.submissions.find(s => s.studentId.toString() === studentId);
            if (!submission) return res.status(404).json({ message: 'Submission not found' });

            const { score, feedback, questionScores } = dataToApply;
            if (score !== undefined) submission.score = score;
            if (feedback !== undefined) submission.feedback = feedback;
            if (Array.isArray(questionScores)) submission.questionScores = questionScores;
            submission.status = 'graded';
            await assignment.save();
        }

        if (session.submissionRefs && session.submissionRefs.length > 1) {
            session.gradingSnapshot = session.gradingSnapshot || {};
            session.gradingSnapshot[targetRef] = dataToApply;
            session.savedSubmissions = session.savedSubmissions || [];
            session.savedSubmissions.push({ submissionRef: targetRef, savedAt: new Date() });
            session.savedAt = new Date();
            await session.save();
            return res.json({ message: 'Candidate grading finalized. You may continue grading other scripts.', savedAt: session.savedAt, submissionRef: targetRef });
        }

        session.gradingSnapshot = dataToApply;
        session.status = 'saved';
        session.savedAt = new Date();
        await session.save();

        res.json({ message: 'Grading finalized and saved successfully', savedAt: session.savedAt });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORITY — MANAGE PENDING REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route  GET /api/scripts/pending-requests
 * @desc   List all pending/active access requests for scripts the user owns
 * @access Teacher / Admin
 */
router.get('/pending-requests', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        let parentIds = [];

        if (req.user.role === 'root_admin') {
            // All sessions
            const sessions = await ScriptAccessSession.find({ status: { $in: ['pending_otp', 'active'] } })
                .sort({ createdAt: -1 })
                .limit(100);
            return res.json(sessions);
        }

        // Exams created by this user
        const exams = await Exam.find({ creatorId: req.user._id }).select('_id');
        exams.forEach(e => parentIds.push(e._id));

        // Assignments in classrooms this user teaches
        const classrooms = await Classroom.find({ teacherId: req.user._id }).select('_id');
        const assignments = await Assignment.find({ classroomId: { $in: classrooms.map(c => c._id) } }).select('_id');
        assignments.forEach(a => parentIds.push(a._id));

        // Sessions for those parents
        const sessions = await ScriptAccessSession.find({
            parentId: { $in: parentIds },
            status: { $in: ['pending_otp', 'active', 'saved', 'expired'] }
        }).sort({ createdAt: -1 });

        res.json(sessions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route  POST /api/scripts/pending-requests/:sessionId/resend-otp
 * @desc   Resend OTP to authorities (in case it was missed)
 * @access Authority / Owner
 */
router.post('/pending-requests/:sessionId/resend-otp', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const session = await ScriptAccessSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        if (session.status !== 'pending_otp') {
            return res.status(400).json({ message: 'No OTP is pending for this session' });
        }

        // Generate a fresh OTP
        const config = await ScriptShareConfig.findOne({ parentId: session.parentId, parentType: session.submissionType });
        const otpLifespanMs = ((config?.otpLifespanMinutes) || 30) * 60 * 1000;
        const otp = generateOTP(6);
        const otpHash = await bcrypt.hash(otp, 10);

        session.otpHash = otpHash;
        session.otpExpiresAt = new Date(Date.now() + otpLifespanMs);
        await session.save();

        // Re-send to original authorities
        const authorities = await User.find({ _id: { $in: session.notifiedAuthorityIds } }).select('name email');
        for (const authority of authorities) {
            await sendEmail({
                to: authority.email,
                subject: `[Resent] Script Access OTP — ${session.requesterName}`,
                html: `
                    <h2 style="color: #4f46e5;">Script Access OTP (Resent)</h2>
                    <p>The OTP for <strong>${session.requesterName}</strong>'s script access request has been regenerated.</p>
                    <div style="background: #4f46e5; color: white; border-radius: 16px; padding: 30px; text-align: center; margin: 24px 0;">
                        <p style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">New OTP</p>
                        <p style="margin: 0; font-size: 48px; font-weight: 900; letter-spacing: 12px;">${otp}</p>
                        <p style="margin: 12px 0 0 0; font-size: 13px; opacity: 0.7;">Valid for ${config?.otpLifespanMinutes || 30} minutes</p>
                    </div>
                `,
                isSystemEmail: true
            }).catch(e => console.error('Resend OTP error:', e.message));
        }

        res.json({ message: 'OTP resent to authorities', otpExpiresAt: session.otpExpiresAt });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/**
 * @route  DELETE /api/scripts/pending-requests/:sessionId
 * @desc   Revoke / delete an access session
 * @access Authority / Owner
 */
router.delete('/pending-requests/:sessionId', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const session = await ScriptAccessSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        await session.deleteOne();
        res.json({ message: 'Access session revoked' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
