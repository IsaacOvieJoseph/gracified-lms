const Exam = require('../models/Exam');
const ExamSubmission = require('../models/ExamSubmission');
const User = require('../models/User');
const { sendEmail } = require('./email');
const mongoose = require('mongoose');

/**
 * Checks for exams whose results are now public and sends results to participants
 * who haven't received them yet.
 */
const processPendingExamResults = async () => {
    try {
        const now = new Date();
        // console.log(`[ExamResults] Starting check at ${now.toISOString()}`);

        // Find all submissions that are graded but haven't had results sent yet
        const pendingSubmissions = await ExamSubmission.find({
            status: 'graded',
            emailSent: false
        }).populate('examId');

        // console.log(`[ExamResults] Found ${pendingSubmissions.length} graded submissions with pending emails.`);

        if (pendingSubmissions.length === 0) return { processed: 0 };

        let sentCount = 0;

        for (const submission of pendingSubmissions) {
            const exam = submission.examId;
            if (!exam) {
                // console.warn(`[ExamResults] Submission ${submission._id} is missing its examId.`);
                continue;
            }

            // Check if results are now public for this exam
            const resultsArePublic = exam.resultsPublished || (exam.resultPublishTime && new Date(exam.resultPublishTime) <= now);

            // console.log(`[ExamResults] Processing submission for exam: "${exam.title}". Results public: ${resultsArePublic}. PublishTime: ${exam.resultPublishTime ? new Date(exam.resultPublishTime).toISOString() : 'N/A'}`);

            if (resultsArePublic) {
                let emailTo = submission.candidateEmail;
                let recipientName = submission.candidateName || 'Student';

                // If it's a registered student and email isn't in submission, fetch from User model
                if (!emailTo && submission.studentId) {
                    try {
                        const User = mongoose.model('User');
                        const user = await User.findById(submission.studentId);
                        if (user) {
                            emailTo = user.email;
                            if (!submission.candidateName) recipientName = user.name;
                        }
                    } catch (err) {
                        console.error(`[ExamResults] Error fetching user ${submission.studentId}:`, err.message);
                    }
                }

                if (emailTo) {
                    try {
                        // console.log(`[ExamResults] Attempting to send result to ${emailTo} for "${exam.title}"...`);
                        const totalScore = submission.totalScore;
                        const maxPossible = exam.questions && exam.questions.length > 0
                            ? exam.questions.reduce((acc, q) => acc + (q.maxScore || 1), 0)
                            : 0;

                        const percentage = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;

                        await sendEmail({
                            to: emailTo,
                            subject: `Exam Result Released: ${exam.title}`,
                            classroomId: exam.classId,
                            schoolId: exam.schoolId,
                            html: `
                                <h2 style="color: #4f46e5;">Exam Results Released</h2>
                                <p>Hello <strong>${recipientName}</strong>,</p>
                                <p>The results for the exam "<strong>${exam.title}</strong>" have been officially released.</p>
                                
                                <div style="background: #4f46e5; color: white; padding: 30px; border-radius: 15px; text-align: center; margin: 25px 0;">
                                    <div style="font-size: 14px; text-transform: uppercase; font-weight: bold; opacity: 0.8; margin-bottom: 5px;">Your Final Score</div>
                                    <div style="font-size: 48px; font-weight: 900;">${percentage}%</div>
                                    <div style="font-size: 16px; margin-top: 10px;">${totalScore} / ${maxPossible} Points</div>
                                </div>
                                
                                <p>You can now log in to the portal to view your detailed performance breakdown and examiner feedback.</p>
                                <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">This is an automated notification from Gracified LMS. Please do not reply.</p>
                            `
                        });

                        submission.emailSent = true;
                        await submission.save();
                        sentCount++;
                        // console.log(`[ExamResults] Success: result sent to ${emailTo}`);
                    } catch (err) {
                        console.error(`[ExamResults] Failed to send email to ${emailTo}:`, err.message);
                    }
                } else {
                    // console.warn(`[ExamResults] No email address found for submission ${submission._id}`);
                }
            } else {
                // console.log(`[ExamResults] Results for "${exam.title}" are not yet public. Skipping.`);
            }
        }

        // console.log(`[ExamResults] Task completed. Sent ${sentCount} results.`);
        return { processed: sentCount };
    } catch (error) {
        console.error('[ExamResults] Critical Error in processor:', error.message);
        throw error;
    }
};

module.exports = {
    processPendingExamResults
};
