const express = require('express');
const Exam = require('../models/Exam');
const ExamSubmission = require('../models/ExamSubmission');
const { auth, authorize } = require('../middleware/auth');
const { sendEmail, emailHeading, emailText, emailPanel, emailMeta, emailCode, emailResultHero, emailNote, emailButton, NAVY, FOREST, ROSE } = require('../utils/email');
const mongoose = require('mongoose');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const School = require('../models/School');
const Tutorial = require('../models/Tutorial');
const { isNonStudent, stripCorrectOption, sanitizeExam } = require('../utils/answerKey');
const router = express.Router();

// Helper to check school access
const hasSchoolAccess = (user, schoolId) => {
    if (user.role === 'root_admin') return true;
    if (!user.schoolId || !schoolId) return false;

    const userSchools = Array.isArray(user.schoolId) ? user.schoolId : [user.schoolId];
    const userSchoolIds = userSchools.map(id => (id._id || id).toString());

    return userSchoolIds.includes(schoolId.toString());
};

// Helper: exam access for teachers assigned to the class
const canAccessExam = async (user, exam) => {
    if (!user || !exam) return false;
    if (user.role === 'root_admin') return true;

    // Creator can always access
    if (exam.creatorId && exam.creatorId.toString() === user._id.toString()) return true;

    // School admins can access exams in their school
    if (user.role === 'school_admin' && exam.schoolId && hasSchoolAccess(user, exam.schoolId)) return true;

    // Teachers can access exams tagged to their assigned classes
    if (user.role === 'teacher' && exam.classId) {
        const classroom = await Classroom.findById(exam.classId).select('teacherId');
        if (classroom?.teacherId && classroom.teacherId.toString() === user._id.toString()) return true;
    }

    return false;
};

// @route   POST /api/exams
// @desc    Create an exam
// @access  Teacher/Admin
/**
 * @swagger
 * /api/exams:
 *   post:
 *     summary: Create a new exam
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - duration
 *               - questions
 *             properties:
 *               title:
 *                 type: string
 *               duration:
 *                 type: number
 *     responses:
 *       201:
 *         description: Exam created
 */
router.post('/', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const { title, description, duration, accessMode, startTime, endTime, questions, schoolId, classId, dueDate, resultPublishTime } = req.body;

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
            dueDate: dueDate || null,
            resultPublishTime: resultPublishTime || null
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
                        classroomId: classId,
                        schoolId: schoolId,
                        html: `
                            ${emailHeading('New Assessment Available')}
                            ${emailText(`Hello <strong>${student.name}</strong>,`)}
                            ${emailText(`A new exam "<strong>${title}</strong>" has been assigned to your class: <strong>${classroom.name}</strong>.`)}
                            ${emailMeta([
                                ['Exam', title],
                                ['Duration', `${duration} minutes`],
                                ...(dueDate ? [['Due Date', new Date(dueDate).toLocaleString()]] : [])
                            ])}
                            ${emailButton('Take Exam Now', examUrl)}
                            <p style="font-size:12px; color:#5B6B7C; margin-top:14px;">If the button doesn't work, copy this link: <span style="color:#1D3557; word-break:break-all;">${examUrl}</span></p>
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
// @desc    Get exams (Student: assigned/taken, Teacher/Admin: created/school-wide)
// @access  Authenticated Users
/**
 * @swagger
 * /api/exams:
 *   get:
 *     summary: Get exams (assigned to student or created by teacher/admin)
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of exams
 */
router.get('/', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher', 'student'), async (req, res) => {
    try {
        let exams = [];

        if (req.user.role === 'student') {
            // 1. Get exams from classrooms student is enrolled in
            const classrooms = await Classroom.find({ students: req.user._id }).select('_id');
            const classroomIds = classrooms.map(c => c._id);

            // 2. Get exams the student has already submitted (even public ones)
            const submissions = await ExamSubmission.find({ studentId: req.user._id }).select('examId');
            const submittedExamIds = submissions.map(s => s.examId);

            // 3. Query: Assigned to class OR already submitted
            exams = await Exam.find({
                $or: [
                    { classId: { $in: classroomIds }, isPublished: true },
                    { _id: { $in: submittedExamIds } }
                ]
            }).sort({ createdAt: -1 });

            // Attach submission status for each exam for the student
            const enhancedExams = await Promise.all(exams.map(async (exam) => {
                const submission = await ExamSubmission.findOne({
                    examId: exam._id,
                    studentId: req.user._id
                }).sort({ submittedAt: -1 });

                return {
                    ...exam.toObject(),
                    submissionStatus: submission ? (submission.status === 'graded' ? 'graded' : 'submitted') : 'not-started',
                    submissionId: submission ? submission._id : null,
                    score: submission && submission.status === 'graded' ? submission.totalScore : null
                };
            }));

            return res.json(enhancedExams.map(e => sanitizeExam(e)));
        }

        // Teacher/Admin Logic (Unchanged but cleaned)
        let query = {};
        if (req.user.role !== 'root_admin') {
            if (req.user.role === 'school_admin') {
                const userSchools = Array.isArray(req.user.schoolId) ? req.user.schoolId : [req.user.schoolId];
                query = { $or: [{ creatorId: req.user._id }, { schoolId: { $in: userSchools } }] };
            } else if (req.user.role === 'teacher') {
                // Teachers should also see exams tagged to classes assigned to them,
                // even if the exam was created by a school admin or someone else.
                const classrooms = await Classroom.find({ teacherId: req.user._id }).select('_id');
                const classroomIds = classrooms.map(c => c._id);
                query = { $or: [{ creatorId: req.user._id }, { classId: { $in: classroomIds } }] };
            } else {
                query = { creatorId: req.user._id };
            }
        }

        exams = await Exam.find(query).sort({ createdAt: -1 });
        res.json(exams);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/exams/:id
// @desc    Get exam by ID
// @access  Teacher/Admin
/**
 * @swagger
 * /api/exams/{id}:
 *   get:
 *     summary: Get exam by ID
 *     tags: [Exams]
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
 *         description: Exam details
 */
router.get('/:id', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id)
            .populate('schoolId', 'name logoUrl textSecondary')
            .populate('classId', 'name');

        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        // Auth check (includes assigned class teachers)
        const allowed = await canAccessExam(req.user, exam);
        if (!allowed) return res.status(403).json({ message: 'Access denied' });

        // Fetch additional branding if needed
        let logoUrl = exam.schoolId?.logoUrl || null;
        const classroomName = exam.classId?.name || null;

        if (!logoUrl) {
            const creator = await User.findById(exam.creatorId).select('tutorialId role');
            if (creator && creator.tutorialId) {
                const tutorial = await Tutorial.findById(creator.tutorialId).select('logoUrl');
                if (tutorial) logoUrl = tutorial.logoUrl;
            }
        }

        res.json({
            ...exam.toObject(),
            logoUrl,
            classroomName
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/exams/:id
// @desc    Update exam
// @access  Teacher/Admin
/**
 * @swagger
 * /api/exams/{id}:
 *   put:
 *     summary: Update an exam
 *     tags: [Exams]
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
 *         description: Exam updated
 */
router.put('/:id', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        // Auth check (includes assigned class teachers)
        const allowed = await canAccessExam(req.user, exam);
        if (!allowed) return res.status(403).json({ message: 'Access denied' });

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
/**
 * @swagger
 * /api/exams/{id}:
 *   delete:
 *     summary: Delete an exam
 *     tags: [Exams]
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
 *         description: Exam deleted
 */
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
/**
 * @swagger
 * /api/exams/public/{token}:
 *   get:
 *     summary: Get basic exam info by token (Public)
 *     tags: [Exams]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exam info
 */
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
            exam = await Exam.findById(exam._id).select('title description duration accessMode startTime endTime dueDate isPublished resultsPublished resultPublishTime classId creatorId schoolId questions');
        }

        if (!exam) return res.status(404).json({ message: 'Exam link invalid' });
        if (!exam.isPublished) return res.status(403).json({ message: 'Exam is not yet published' });

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

        // --- Sophisticated Due Date and Participation Check ---
        let isEnrolled = false;
        let submissionStatus = null;
        let existingSubmissionId = null;
        let viewerUser = null;

        const authHeader = req.headers.authorization;
        if (authHeader) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.userId);

                if (user) {
                    viewerUser = user;
                    const userId = user._id.toString();

                    // Enrollment check
                    if (!exam.classId) isEnrolled = true;
                    else {
                        const classroom = await Classroom.findById(exam.classId);
                        const isEnrolledInClass = classroom && classroom.students.some(id => id.toString() === userId);
                        const isTeacher = (classroom && classroom.teacherId.toString() === userId) || (exam.creatorId.toString() === userId);
                        const isAdmin = ['root_admin', 'school_admin'].includes(user.role);
                        if (isEnrolledInClass || isTeacher || isAdmin) isEnrolled = true;
                    }

                    // Submission check
                    const submission = await ExamSubmission.findOne({
                        examId: exam._id,
                        studentId: user._id
                    }).sort({ createdAt: -1 });

                    if (submission) {
                        submissionStatus = submission.status;
                        existingSubmissionId = submission._id;
                    }
                }
            } catch (err) {
                // Ignore auth errors
            }
        }

        // Block if due date passed AND no active submission exists
        const isPastDue = exam.dueDate && new Date(exam.dueDate) < new Date();
        if (isPastDue && submissionStatus !== 'in-progress' && submissionStatus !== 'submitted' && submissionStatus !== 'graded') {
            return res.status(410).json({ message: 'Exam is no longer available (Due date passed)' });
        }

        // --- Results Logic for Students ---
        let resultData = null;
        const resultsArePublic = exam.resultsPublished || (exam.resultPublishTime && new Date(exam.resultPublishTime) <= new Date());

        if (existingSubmissionId && (submissionStatus === 'submitted' || submissionStatus === 'graded')) {
            const submission = await ExamSubmission.findById(existingSubmissionId);
            resultData = {
                score: submission.totalScore,
                status: submission.status,
                answers: resultsArePublic ? submission.answers : null, // Show breakdown only if published
                submittedAt: submission.submittedAt
            };
        }

        const responseData = {
            ...exam.toObject(),
            isEnrolled,
            submissionStatus,
            existingSubmissionId,
            classroomName,
            logoUrl,
            resultData
        };

        // Never send answer keys to students unless scored AND results are public
        // (so the UI can show the correct answers in the review/breakdown view).
        if (isNonStudent(viewerUser) || (submissionStatus === 'graded' && resultsArePublic && resultData)) {
            responseData.questions = exam.questions;
        } else {
            responseData.questions = stripCorrectOption(exam.questions);
        }

        res.json(responseData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/exams/public/:token/start
// @desc    Start an exam attempt
// @access  Public (Optional Auth)
/**
 * @swagger
 * /api/exams/public/{token}/start:
 *   post:
 *     summary: Start an exam attempt
 *     tags: [Exams]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               candidateName:
 *                 type: string
 *               candidateEmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: Attempt started
 */
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

        let studentId = null;
        let viewerUser = null;
        let candidateName = req.body.candidateName;
        let candidateEmail = req.body.candidateEmail;

        const authHeader = req.headers.authorization;
        if (authHeader) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.userId);
                if (user) {
                    viewerUser = user;
                    studentId = user._id;
                    candidateName = user.name; // Use user's name if logged in
                    candidateEmail = user.email; // Use user's email if logged in

                    // Auth check for class exams
                    if (exam.classId) {
                        const classroom = await Classroom.findById(exam.classId);
                        if (!classroom) return res.status(404).json({ message: 'Classroom not found' });

                        const userIdStr = studentId.toString();
                        const isEnrolledInClass = classroom.students.some(id => id.toString() === userIdStr);
                        const isTeacher = classroom.teacherId.toString() === userIdStr;
                        const isAdmin = ['root_admin', 'school_admin'].includes(user.role);

                        if (!isEnrolledInClass && !isTeacher && !isAdmin) {
                            return res.status(403).json({ message: 'Access denied: You are not enrolled in this class.' });
                        }
                    }
                }
            } catch (err) {
                // Ignore auth errors
            }
        }

        if (exam.accessMode === 'registered' && !studentId) {
            return res.status(401).json({ message: 'Login required for this exam' });
        }

        if (exam.accessMode === 'open' && !studentId && !candidateName) {
            return res.status(400).json({ message: 'Name is required' });
        }

        // Answer keys go to non-students only; students never get them while taking.
        const safeQuestions = isNonStudent(viewerUser) ? exam.questions : stripCorrectOption(exam.questions);

        // Check for existing attempt to allow RESUME
        if (studentId) {
            const activeSubmission = await ExamSubmission.findOne({
                examId: exam._id,
                studentId,
                status: 'in-progress'
            });

            if (activeSubmission) {
                return res.json({
                    submissionId: activeSubmission._id,
                    questions: safeQuestions,
                    duration: exam.duration,
                    isResume: true
                });
            }

            const existing = await ExamSubmission.findOne({ examId: exam._id, studentId, status: { $in: ['submitted', 'graded'] } });
            if (existing) return res.status(400).json({ message: 'You have already submitted this exam' });
        } else if (candidateEmail) { // For anonymous users, check by email if provided
            const existing = await ExamSubmission.findOne({ examId: exam._id, candidateEmail, status: { $in: ['submitted', 'graded'] } });
            if (existing) return res.status(400).json({ message: 'An attempt with this email has already been submitted' });
        }


        // Block NEW attempts after due date
        if (exam.dueDate && new Date(exam.dueDate) < new Date()) {
            return res.status(410).json({ message: 'Exam is no longer available (Due date passed)' });
        }

        const submission = new ExamSubmission({
            examId: exam._id,
            studentId,
            candidateName,
            candidateEmail,
            status: 'in-progress',
            startedAt: new Date()
        });

        await submission.save();

        // Return submission AND questions (answer keys stripped for students)
        res.json({
            submissionId: submission._id,
            questions: safeQuestions,
            duration: exam.duration
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/exams/submissions/:id/submit
// @desc    Submit exam answers
// @access  Public (tracked by submission ID)
/**
 * @swagger
 * /api/exams/submissions/{id}/submit:
 *   post:
 *     summary: Submit exam answers
 *     tags: [Exams]
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
 *             properties:
 *               answers:
 *                 type: array
 *                 items: {}
 *     responses:
 *       200:
 *         description: Exam submitted
 */
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
        submission.status = hasTheory ? 'submitted' : 'graded';

        await submission.save();

        // Email Notification
        const emailTo = submission.candidateEmail || (submission.studentId ? (await mongoose.model('User').findById(submission.studentId))?.email : null);

        if (emailTo) {
            try {
                const resultsArePublic = exam.resultsPublished || (exam.resultPublishTime && new Date(exam.resultPublishTime) <= new Date()) || !exam.resultPublishTime;

                let emailHtml = '';
                if (resultsArePublic) {
                    emailHtml = `
                        ${emailHeading('Exam Submitted Successfully')}
                        ${emailText(`Hello <strong>${submission.candidateName || 'Student'}</strong>,`)}
                        ${emailText(`Your assessment for <strong>"${exam.title}"</strong> has been received and graded.`)}
                    `;

                    if (hasTheory) {
                        emailHtml += `
                            ${emailPanel('Note: This exam contains theory questions. Your final score will be determined after manual grading by the teacher.', { accent: NAVY })}
                        `;
                    } else {
                        const percentage = Math.round((totalScore / maxPossible) * 100);
                        emailHtml += `
                            ${emailResultHero({ eyebrow: 'Your Score', value: `${percentage}%`, meta: `${totalScore} / ${maxPossible} Points`, tone: NAVY })}
                        `;
                    }
                } else {
                    // Send confirmation only, no score
                    emailHtml = `
                        ${emailHeading('Exam Submitted')}
                        ${emailText(`Hello <strong>${submission.candidateName || 'Student'}</strong>,`)}
                        ${emailText(`Your assessment for <strong>"${exam.title}"</strong> has been successfully received.`)}
                        ${emailPanel(`
                            <p style="margin:0;"><strong>Status:</strong> Received / Pending Result Release</p>
                            <p style="margin:4px 0 0; color:#5B6B7C;">Results will be sent to you once they are officially released on ${new Date(exam.resultPublishTime).toLocaleString()}.</p>
                        `, { accent: NAVY })}
                    `;
                }

                emailHtml += `
                    ${emailNote('Thank you for using Gracified LMS. This is an automated notification — please do not reply.')}
                `;

                await sendEmail({
                    to: emailTo,
                    subject: `Exam ${resultsArePublic ? 'Result' : 'Submission'}: ${exam.title}`,
                    classroomId: exam.classId,
                    schoolId: exam.schoolId,
                    html: emailHtml
                });

                if (resultsArePublic) {
                    submission.emailSent = true;
                    await submission.save();
                }
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
/**
 * @swagger
 * /api/exams/{id}/submissions:
 *   get:
 *     summary: Get all submissions for an exam
 *     tags: [Exams]
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
 *         description: List of submissions
 */
router.get('/:id/submissions', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        // Auth check (includes assigned class teachers)
        const allowed = await canAccessExam(req.user, exam);
        if (!allowed) return res.status(403).json({ message: 'Access denied' });

        const submissions = await ExamSubmission.find({ examId: req.params.id }).populate('studentId', 'name email').sort({ submittedAt: -1 });
        res.json(submissions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/exams/submissions/detail/:id
// @desc    Get full submission details
// @access  Teacher/Admin
/**
 * @swagger
 * /api/exams/submissions/detail/{id}:
 *   get:
 *     summary: Get full submission details
 *     tags: [Exams]
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
 *         description: Submission details
 */
router.get('/submissions/detail/:id', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const submission = await ExamSubmission.findById(req.params.id)
            .populate('examId')
            .populate('studentId', 'name email');

        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        const exam = submission.examId;
        // Auth check (includes assigned class teachers)
        const allowed = await canAccessExam(req.user, exam);
        if (!allowed) return res.status(403).json({ message: 'Access denied' });

        res.json(submission);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PATCH /api/exams/submissions/detail/:id/grade
// @desc    Update grades for theory questions
// @access  Teacher/Admin
/**
 * @swagger
 * /api/exams/submissions/detail/{id}/grade:
 *   patch:
 *     summary: Update grades for theory questions
 *     tags: [Exams]
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
 *             properties:
 *               questionGrades:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Grading updated
 */
router.patch('/submissions/detail/:id/grade', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), async (req, res) => {
    try {
        const submission = await ExamSubmission.findById(req.params.id).populate('examId');
        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        const exam = submission.examId;
        // Auth check (includes assigned class teachers)
        const allowed = await canAccessExam(req.user, exam);
        if (!allowed) return res.status(403).json({ message: 'Access denied' });

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
                const resultsArePublic = exam.resultsPublished || (exam.resultPublishTime && new Date(exam.resultPublishTime) <= new Date()) || !exam.resultPublishTime;

                if (resultsArePublic) {
                    const maxPossible = exam.questions.reduce((acc, q) => acc + (q.maxScore || 1), 0);
                    const percentage = Math.round((submission.totalScore / maxPossible) * 100);

                    await sendEmail({
                        to: emailTo,
                        subject: `Updated Exam Result: ${exam.title}`,
                        classroomId: exam.classId,
                        schoolId: exam.schoolId,
                        html: `
                            ${emailHeading('Exam Grading Complete')}
                            ${emailText(`Hello <strong>${submission.candidateName || 'Student'}</strong>,`)}
                            ${emailText(`Your assessment for <strong>"${exam.title}"</strong> has been reviewed and graded by the examiner.`)}
                            ${emailResultHero({ eyebrow: 'Final Score', value: `${percentage}%`, meta: `${submission.totalScore} / ${maxPossible} Points`, tone: NAVY })}
                            ${emailText('Thank you for your patience.')}
                        `
                    });

                    submission.emailSent = true;
                    await submission.save();
                }
            } catch (err) {
                console.error('Failed to send updated result email:', err.message);
            }
        }

        res.json({ message: 'Grading updated and student notified', submission });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/exams/submissions/:id
// @desc    Delete an exam submission (Restricted)
// @access  Root Admin / School Admin / Personal Teacher
router.delete('/submissions/:id', auth, authorize('root_admin', 'school_admin', 'personal_teacher'), async (req, res) => {
    try {
        const submission = await ExamSubmission.findById(req.params.id).populate('examId');
        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        const exam = submission.examId;
        // Root admins can always delete. School admins can delete within their school.
        const allowed = req.user.role === 'root_admin' ||
            (req.user.role === 'school_admin' && exam?.schoolId && hasSchoolAccess(req.user, exam.schoolId)) ||
            (req.user.role === 'personal_teacher' && exam?.creatorId?.toString() === req.user._id.toString());

        if (!allowed) return res.status(403).json({ message: 'Access denied' });

        await submission.deleteOne();
        res.json({ message: 'Submission deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/exams/class/:classId
// @desc    Get exams for a specific classroom
// @access  Registered Student / Teacher
/**
 * @swagger
 * /api/exams/class/{classId}:
 *   get:
 *     summary: Get exams for a specific classroom
 *     tags: [Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of classroom exams
 */
router.get('/class/:classId', auth, async (req, res) => {
    try {
        const query = { classId: req.params.classId };
        // Staff need drafts in the classroom workspace; students only see published exams.
        if (req.user.role === 'student') query.isPublished = true;
        const exams = await Exam.find(query).sort({ createdAt: -1 });
        // Students must never receive answer keys from list endpoints.
        const payload = req.user.role === 'student' ? exams.map(e => sanitizeExam(e)) : exams;
        res.json(payload);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
