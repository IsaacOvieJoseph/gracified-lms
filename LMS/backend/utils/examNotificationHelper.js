const ExamSubmission = require('../models/ExamSubmission');
const User = require('../models/User');
const { sendEmail, emailHeading, emailText, emailResultHero, emailNote, NAVY } = require('./email');
const { examResultsArePublic } = require('./answerKey');
const { buildExamResultPdf } = require('./examResultPdf');

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sendExamResultEmail = async (submission, exam) => {
    let emailTo = submission.candidateEmail;
    let recipientName = submission.candidateName || 'Student';

    if (!emailTo && submission.studentId) {
        const user = await User.findById(submission.studentId).select('name email');
        if (user) {
            emailTo = user.email;
            if (!submission.candidateName) recipientName = user.name;
        }
    }

    if (!emailTo) return false;

    const maxPossible = (exam.questions || []).reduce((total, question) => total + (question.maxScore || 1), 0);
    const percentage = maxPossible > 0 ? Math.round((submission.totalScore / maxPossible) * 100) : 0;
    const attachments = [];
    if ((exam.questions || []).some(question => question.questionType === 'theory')) {
        const pdf = await buildExamResultPdf({ exam, submission, candidateName: recipientName });
        const safeExamTitle = String(exam.title || 'exam').replace(/[^a-z0-9-_]+/gi, '_');
        attachments.push({ name: `${safeExamTitle}_result.pdf`, content: pdf });
    }

    await sendEmail({
        to: emailTo,
        subject: `Exam Result Released: ${exam.title}`,
        classroomId: exam.classId,
        schoolId: exam.schoolId,
        attachments,
        html: `
            ${emailHeading('Exam Results Released')}
            ${emailText(`Hello <strong>${escapeHtml(recipientName)}</strong>,`)}
            ${emailText(`The results for the exam "<strong>${escapeHtml(exam.title)}</strong>" have been officially released.`)}
            ${emailResultHero({ eyebrow: 'Your Final Score', value: `${percentage}%`, meta: `${submission.totalScore} / ${maxPossible} Points`, tone: NAVY })}
            ${emailText('Your detailed candidate script, including your responses and examiner feedback, is attached as a PDF.')}
            ${emailNote('This is an automated notification from Gracified LMS. Please do not reply.')}
        `
    });

    submission.emailSent = true;
    await submission.save();
    return true;
};

/**
 * Sends result emails for graded submissions once their exam results are public.
 */
const processPendingExamResults = async (examId = null) => {
    const pendingSubmissions = await ExamSubmission.find({
        status: 'graded',
        emailSent: false,
        ...(examId ? { examId } : {})
    }).populate('examId');

    let sentCount = 0;
    let failedCount = 0;

    for (const submission of pendingSubmissions) {
        const exam = submission.examId;
        if (!exam || !examResultsArePublic(exam)) continue;

        try {
            if (await sendExamResultEmail(submission, exam)) sentCount++;
        } catch (error) {
            failedCount++;
            console.error(`[ExamResults] Failed to send result for submission ${submission._id}:`, error.message);
        }
    }

    return { processed: sentCount, failed: failedCount };
};

module.exports = {
    processPendingExamResults,
    sendExamResultEmail
};
