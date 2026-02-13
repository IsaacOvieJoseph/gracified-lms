const express = require('express');
const Exam = require('../models/Exam');
const ExamSubmission = require('../models/ExamSubmission');
const { auth, authorize } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');
const mongoose = require('mongoose');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const School = require('../models/School');
const Tutorial = require('../models/Tutorial');
const router = express.Router();

// Helper to check school access
const hasSchoolAccess = (user, schoolId) => {
    if (user.role === 'root_admin') return true;
    if (!user.schoolId || !schoolId) return false;

    const userSchools = Array.isArray(user.schoolId) ? user.schoolId : [user.schoolId];
    const userSchoolIds = userSchools.map(id => (id._id || id).toString());

    return userSchoolIds.includes(schoolId.toString());
};

// @route   POST /api/exams
// @desc    Create an exam
// @access  Teacher/Admin
router.post('/', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const { title, description, duration, accessMode, startTime, endTime, questions, schoolId, classId, dueDate } = req.body;

        const exam = new Exam({
            title,
            description,
            duration,
            accessMode,
            startTime,
            endTime,
            questions,
            creatorId: req.user._id,
            schoolId: schoolId || (req.user.schoolId?.[0]) || null,
            classId: classId || null,
            dueDate: dueDate || null
        });

        await exam.save();

        // Notify students if tied to a class
        if (classId) {
            const classroom = await Classroom.findById(classId).populate('students', 'email name');
            if (classroom && classroom.students.length > 0) {
                const examUrl = `${process.env.FRONTEND_URL}/exam-center/${exam.linkToken}`;
                const notificationPromises = classroom.students.map(student =>
                    sendEmail({
                        to: student.email,
                        subject: `New Exam Assigned: ${title}`,
                        html: `
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #4f46e5;">New Assessment Available</h2>
                                <p>Hello <strong>${student.name}</strong>,</p>
                                <p>A new exam "<strong>${title}</strong>" has been assigned to your class: <strong>${classroom.name}</strong>.</p>
                                <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin: 20px 0;">
                                    <p style="margin: 0; color: #374151;"><strong>Duration:</strong> ${duration} minutes</p>
                                    ${dueDate ? `<p style="margin: 5px 0 0 0; color: #ef4444;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleString()}</p>` : ''}
                                </div>
                                <a href="${examUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">Take Exam Now</a>
                                <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">If the button doesn't work, copy this link: ${examUrl}</p>
                            </div>
                        `
                    }).catch(err => console.error(`Failed to notify ${student.email}:`, err.message))
                );
                await Promise.all(notificationPromises);
            }
        }

        res.status(201).json(exam);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/exams
// @desc    Get exams created by user or for their school
// @access  Teacher/Admin
router.get('/', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'root_admin') {
            if (req.user.role === 'school_admin') {
                const userSchools = Array.isArray(req.user.schoolId) ? req.user.schoolId : [req.user.schoolId];
                query = { $or: [{ creatorId: req.user._id }, { schoolId: { $in: userSchools } }] };
            } else {
                query = { creatorId: req.user._id };
            }
        }

        const exams = await Exam.find(query).sort({ createdAt: -1 });
        res.json(exams);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/exams/:id
// @desc    Get exam by ID
// @access  Teacher/Admin
router.get('/:id', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        // Auth check
        const canAccess = req.user.role === 'root_admin' ||
            exam.creatorId.toString() === req.user._id.toString() ||
            (exam.schoolId && hasSchoolAccess(req.user, exam.schoolId));

        if (!canAccess) return res.status(403).json({ message: 'Access denied' });

        res.json(exam);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/exams/:id
// @desc    Update exam
// @access  Teacher/Admin
router.put('/:id', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        if (exam.creatorId.toString() !== req.user._id.toString() && req.user.role !== 'root_admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        Object.assign(exam, req.body);
        await exam.save();
        res.json(exam);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/exams/:id
// @desc    Delete exam
// @access  Teacher/Admin
router.delete('/:id', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        if (exam.creatorId.toString() !== req.user._id.toString() && req.user.role !== 'root_admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        await exam.deleteOne();
        res.json({ message: 'Exam deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- Public/Exam Center Routes ---

// @route   GET /api/exams/public/:token
// @desc    Get basic exam info by token
// @access  Public
router.get('/public/:token', async (req, res) => {
    try {
        const tokenOrId = req.params.token;
        let exam = null;

        if (mongoose.Types.ObjectId.isValid(tokenOrId)) {
            exam = await Exam.findById(tokenOrId);
        }

        if (!exam) {
            exam = await Exam.findOne({ linkToken: tokenOrId });
        }

        if (exam) {
            exam = await Exam.findById(exam._id).select('title description duration accessMode startTime endTime isPublished resultsPublished resultPublishTime classId creatorId schoolId');
        }

        if (!exam) return res.status(404).json({ message: 'Exam link invalid' });
        if (!exam.isPublished) return res.status(403).json({ message: 'Exam is not yet published' });

        // Check Due Date
        if (exam.dueDate && new Date(exam.dueDate) < new Date()) {
            return res.status(410).json({ message: 'Exam is no longer available (Due date passed)' });
        }

        // Fetch Branding and context
        let classroomName = null;
        let logoUrl = null;

        if (exam.classId) {
            const classroom = await Classroom.findById(exam.classId).select('name');
            if (classroom) classroomName = classroom.name;
        }

        if (exam.schoolId) {
            const school = await School.findById(exam.schoolId).select('logoUrl');
            if (school) logoUrl = school.logoUrl;
        }

        if (!logoUrl && exam.creatorId) {
            const creator = await User.findById(exam.creatorId).select('tutorialId role');
            if (creator && creator.role === 'personal_teacher' && creator.tutorialId) {
                const tutorial = await Tutorial.findById(creator.tutorialId).select('logoUrl');
                if (tutorial) logoUrl = tutorial.logoUrl;
            }
        }

        // Optional Auth check for enrollment feedback
        let isEnrolled = false;
        const authHeader = req.headers.authorization;
        if (authHeader) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.userId);

                if (user) {
                    const userId = user._id.toString();

                    // Standalone exam: Any authenticated user has access
                    if (!exam.classId) {
                        isEnrolled = true;
                    }
                    // Class exam: Check enrollment or roles
                    else {
                        const classroom = await Classroom.findById(exam.classId);
                        const isEnrolledInClass = classroom && classroom.students.some(id => id.toString() === userId);
                        const isTeacher = (classroom && classroom.teacherId.toString() === userId) || (exam.creatorId.toString() === userId);
                        const isAdmin = ['root_admin', 'school_admin'].includes(user.role);

                        if (isEnrolledInClass || isTeacher || isAdmin) {
                            isEnrolled = true;
                        }
                    }
                }
            } catch (err) {
                // Ignore auth errors for public info
            }
        }

        res.json({
            ...exam.toObject(),
            isEnrolled,
            classroomName,
            logoUrl
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/exams/public/:token/start
// @desc    Start an exam attempt
// @access  Public (Optional Auth)
router.post('/public/:token/start', async (req, res) => {
    try {
        const tokenOrId = req.params.token;
        let exam = null;

        if (mongoose.Types.ObjectId.isValid(tokenOrId)) {
            exam = await Exam.findById(tokenOrId);
        }

        if (!exam) {
            exam = await Exam.findOne({ linkToken: tokenOrId });
        }

        if (!exam || !exam.isPublished) return res.status(404).json({ message: 'Exam not available' });

        // Check Due Date
        if (exam.dueDate && new Date(exam.dueDate) < new Date()) {
            return res.status(410).json({ message: 'Exam is no longer available' });
        }

        let studentId = null;
        let candidateName = req.body.candidateName;
        let candidateEmail = req.body.candidateEmail;

        if (exam.accessMode === 'registered') {
            // For registered, attempt to use token if provided in header
            // We can manually check authorization header here if we want to allow guest start with token
            // or we can just say "you must be logged in" and let frontend handle auth.
            // If frontend sends the token, we should decode it.
            const authHeader = req.headers.authorization;
            if (!authHeader) return res.status(401).json({ message: 'Login required for this exam' });

            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.userId);
                if (!user) return res.status(401).json({ message: 'User not found' });

                studentId = user._id;

                // Admin bypass
                if (user.role === 'root_admin' || user.role === 'school_admin') {
                    // Admins have access
                } else if (exam.classId) {
                    const classroom = await Classroom.findById(exam.classId);
                    const userIdStr = studentId.toString();
                    const isEnrolledInClass = classroom.students.some(id => id.toString() === userIdStr);
                    const isTeacher = classroom.teacherId.toString() === userIdStr;

                    if (!isEnrolledInClass && !isTeacher) {
                        return res.status(403).json({ message: 'Access denied: You are not enrolled in this class.' });
                    }
                }
            } catch (err) {
                console.error('Exam Start Auth Error:', err.message);
                return res.status(401).json({ message: 'Invalid session. Please login again.' });
            }
        } else {
            // For open mode
            if (!candidateName) return res.status(400).json({ message: 'Name is required' });
        }

        // Check if already submitted (if registered)
        if (studentId) {
            const existing = await ExamSubmission.findOne({ examId: exam._id, studentId, status: 'submitted' });
            if (existing) return res.status(400).json({ message: 'You have already submitted this exam' });
        }

        const submission = new ExamSubmission({
            examId: exam._id,
            studentId,
            candidateName,
            candidateEmail,
            status: 'in-progress'
        });

        await submission.save();

        // Return submission AND questions
        res.json({
            submissionId: submission._id,
            questions: exam.questions.map(q => {
                const { correctOption, ...rest } = q.toObject();
                return rest; // Hide correct option
            }),
            duration: exam.duration
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/exams/submissions/:id/submit
// @desc    Submit exam answers
// @access  Public (tracked by submission ID)
router.post('/submissions/:id/submit', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid submission ID' });
        }

        const submission = await ExamSubmission.findById(req.params.id).populate('examId');
        if (!submission) return res.status(404).json({ message: 'Submission not found' });
        if (submission.status === 'submitted') return res.status(400).json({ message: 'Already submitted' });

        const { answers } = req.body;
        const exam = submission.examId;

        let totalScore = 0;
        let maxPossible = 0;
        const processedAnswers = [];
        const hasTheory = exam.questions.some(q => q.questionType === 'theory');

        // Simple marking for MCQs
        exam.questions.forEach((q, index) => {
            const studentAnswer = answers[index];
            let score = 0;
            maxPossible += (q.maxScore || 1);

            if (q.questionType === 'mcq') {
                if (studentAnswer === q.correctOption) {
                    score = q.maxScore || 1;
                }
            }

            totalScore += score;
            processedAnswers.push({
                questionIndex: index,
                answer: studentAnswer,
                score
            });
        });

        submission.answers = processedAnswers;
        submission.totalScore = totalScore;
        submission.submittedAt = new Date();
        submission.status = 'submitted';

        await submission.save();

        // Email Notification
        const emailTo = submission.candidateEmail || (submission.studentId ? (await mongoose.model('User').findById(submission.studentId))?.email : null);

        if (emailTo) {
            try {
                const percentage = Math.round((totalScore / maxPossible) * 100);
                let emailHtml = `
                    <h2 style="color: #4f46e5;">Exam Submitted Successfully</h2>
                    <p>Hello <strong>${submission.candidateName || 'Student'}</strong>,</p>
                    <p>Your assessment for <strong>"${exam.title}"</strong> has been received.</p>
                `;

                if (hasTheory) {
                    emailHtml += `
                        <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <p style="margin: 0; font-weight: bold; color: #374151;">Note: This exam contains theory questions.</p>
                            <p style="margin: 5px 0 0 0; color: #6b7280;">Your final score will be determined after manual grading by the teacher.</p>
                        </div>
                    `;
                } else {
                    emailHtml += `
                        <div style="background: #4f46e5; color: white; padding: 30px; border-radius: 15px; text-align: center; margin: 25px 0;">
                            <div style="font-size: 14px; text-transform: uppercase; font-weight: bold; opacity: 0.8; margin-bottom: 5px;">Your Score</div>
                            <div style="font-size: 48px; font-weight: 900;">${percentage}%</div>
                            <div style="font-size: 16px; margin-top: 10px;">${totalScore} / ${maxPossible} Points</div>
                        </div>
                    `;
                }

                emailHtml += `
                    <p>Thank you for using our platform.</p>
                    <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">This is an automated notification. Please do not reply.</p>
                `;

                await sendEmail({
                    to: emailTo,
                    subject: `Exam Result: ${exam.title}`,
                    html: emailHtml
                });

                submission.emailSent = true;
                await submission.save();
            } catch (err) {
                console.error('Failed to send exam result email:', err.message);
            }
        }

        res.json({ message: 'Exam submitted successfully', score: totalScore, status: submission.status });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/exams/:id/submissions
// @desc    Get all submissions for an exam
// @access  Teacher/Admin
router.get('/:id/submissions', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        // Auth check
        const canAccess = req.user.role === 'root_admin' ||
            exam.creatorId.toString() === req.user._id.toString() ||
            (exam.schoolId && hasSchoolAccess(req.user, exam.schoolId));

        if (!canAccess) return res.status(403).json({ message: 'Access denied' });

        const submissions = await ExamSubmission.find({ examId: req.params.id }).populate('studentId', 'name email').sort({ submittedAt: -1 });
        res.json(submissions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/exams/submissions/detail/:id
// @desc    Get full submission details
// @access  Teacher/Admin
router.get('/submissions/detail/:id', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const submission = await ExamSubmission.findById(req.params.id)
            .populate('examId')
            .populate('studentId', 'name email');

        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        const exam = submission.examId;
        // Auth check
        const canAccess = req.user.role === 'root_admin' ||
            exam.creatorId.toString() === req.user._id.toString() ||
            (exam.schoolId && hasSchoolAccess(req.user, exam.schoolId));

        if (!canAccess) return res.status(403).json({ message: 'Access denied' });

        res.json(submission);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PATCH /api/exams/submissions/detail/:id/grade
// @desc    Update grades for theory questions
// @access  Teacher/Admin
router.patch('/submissions/detail/:id/grade', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const submission = await ExamSubmission.findById(req.params.id).populate('examId');
        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        const exam = submission.examId;
        // Auth check
        if (exam.creatorId.toString() !== req.user._id.toString() && req.user.role !== 'root_admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { questionGrades } = req.body; // Array of { index, score }

        questionGrades.forEach(grade => {
            const ans = submission.answers.find(a => a.questionIndex === grade.index);
            if (ans) {
                ans.score = grade.score;
            }
        });

        // Recalculate total
        submission.totalScore = submission.answers.reduce((acc, curr) => acc + curr.score, 0);
        submission.status = 'graded';
        await submission.save();

        // Send Email notification (Updated Score)
        const emailTo = submission.candidateEmail || (submission.studentId ? (await mongoose.model('User').findById(submission.studentId))?.email : null);

        if (emailTo) {
            try {
                const maxPossible = exam.questions.reduce((acc, q) => acc + (q.maxScore || 1), 0);
                const percentage = Math.round((submission.totalScore / maxPossible) * 100);

                await sendEmail({
                    to: emailTo,
                    subject: `Updated Exam Result: ${exam.title}`,
                    html: `
                        <h2 style="color: #4f46e5;">Exam Grading Complete</h2>
                        <p>Hello <strong>${submission.candidateName || 'Student'}</strong>,</p>
                        <p>Your assessment for <strong>"${exam.title}"</strong> has been reviewed and graded by the examiner.</p>
                        
                        <div style="background: #4f46e5; color: white; padding: 30px; border-radius: 15px; text-align: center; margin: 25px 0;">
                            <div style="font-size: 14px; text-transform: uppercase; font-weight: bold; opacity: 0.8; margin-bottom: 5px;">Final Score</div>
                            <div style="font-size: 48px; font-weight: 900;">${percentage}%</div>
                            <div style="font-size: 16px; margin-top: 10px;">${submission.totalScore} / ${maxPossible} Points</div>
                        </div>
                        
                        <p>Thank you for your patience.</p>
                    `
                });
            } catch (err) {
                console.error('Failed to send updated result email:', err.message);
            }
        }

        res.json({ message: 'Grading updated and student notified', submission });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/exams/class/:classId
// @desc    Get exams for a specific classroom
// @access  Registered Student / Teacher
router.get('/class/:classId', auth, async (req, res) => {
    try {
        const exams = await Exam.find({ classId: req.params.classId, isPublished: true }).sort({ createdAt: -1 });
        res.json(exams);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
