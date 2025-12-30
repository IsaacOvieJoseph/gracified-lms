const express = require('express');
const brevo = require('@getbrevo/brevo');
const defaultClient = brevo.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const brevoEmailApi = new brevo.TransactionalEmailsApi();

// Helper to send transactional email via Brevo
async function sendEmail({ to, subject, html }) {
  const sender = { name: 'Gracified LMS', email: process.env.BREVO_FROM_EMAIL || process.env.BREVO_SENDER_EMAIL || 'no-reply@yourdomain.com' };
  const receivers = Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }];
  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.sender = sender;
  sendSmtpEmail.to = receivers;
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html;
  try {
    await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
  } catch (err) {
    console.error('Brevo sendEmail error:', err);
    throw err;
  }
}

// ========== OLD SIB-API-V3-SDK CODE (COMMENTED OUT) ==========
// const SibApiV3Sdk = require('sib-api-v3-sdk');
// const defaultClient = SibApiV3Sdk.ApiClient.instance;
// const apiKey = defaultClient.authentications['api-key'];
// apiKey.apiKey = process.env.BREVO_API_KEY;
// const brevoEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
//
// // Helper to send transactional email via Brevo (old version)
// async function sendEmail({ to, subject, html }) {
//   const sender = { name: 'LMS Platform', email: process.env.BREVO_SENDER_EMAIL || 'no-reply@yourdomain.com' };
//   const receivers = Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }];
//   const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
//   sendSmtpEmail.sender = sender;
//   sendSmtpEmail.to = receivers;
//   sendSmtpEmail.subject = subject;
//   sendSmtpEmail.htmlContent = html;
//   try {
//     await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
//   } catch (err) {
//     console.error('Brevo sendEmail error:', err);
//     throw err;
//   }
// }
// ==========================================================
const Classroom = require('../models/Classroom');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const internalAuth = require('../middleware/internalAuth'); // Import internalAuth middleware
const router = express.Router();


// Send class reminder
router.post('/class-reminder/:classroomId', internalAuth, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId)
      .populate('teacherId', 'name email')
      .populate('students', 'name email');

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const recipients = [
      { email: classroom.teacherId.email, name: classroom.teacherId.name },
      ...classroom.students.map(student => ({ email: student.email, name: student.name }))
    ];

    if (recipients.length === 0) {
      return res.status(400).json({ message: 'No recipients defined' });
    }

    await Promise.all(recipients.map(recipient => sendEmail({
      to: recipient.email,
      subject: `Class Reminder: ${classroom.name}`,
      html: `
        <h2>Class Reminder</h2>
        <p>Hello ${recipient.name},</p>
        <p>This is a reminder that you have a class scheduled:</p>
        <ul>
          <li><strong>Class:</strong> ${classroom.name}</li>
          <li><strong>Schedule:</strong> ${classroom.schedule}</li>
          <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
        </ul>
        <p>Please be prepared and join on time.</p>
      `
    })));

    res.json({ message: 'Class reminders sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send assignment reminder
router.post('/assignment-reminder/:assignmentId', internalAuth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId)
      .populate({
        path: 'classroomId',
        select: 'name students teacherId',
        populate: [
          { path: 'teacherId', select: 'name email' },
          { path: 'students', select: 'name email' }
        ]
      });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const classroom = assignment.classroomId;

    if (!classroom || !classroom.teacherId || !classroom.teacherId.email || !classroom.students) {
      console.error('Missing recipient data for assignment reminder:', { classroom: !!classroom, teacherId: !!classroom?.teacherId, teacherEmail: !!classroom?.teacherId?.email, studentsCount: classroom?.students?.length || 0 });
      return res.status(400).json({ message: 'No valid recipients found for this assignment' });
    }

    const recipients = [
      { email: classroom.teacherId.email, name: classroom.teacherId.name },
      ...classroom.students.map(student => ({ email: student.email, name: student.name }))
    ];

    if (recipients.length === 0) {
      return res.status(400).json({ message: 'No recipients defined' });
    }

    await Promise.all(recipients.map(recipient => sendEmail({
      to: recipient.email,
      subject: `Assignment Reminder: ${assignment.title}`,
      html: `
        <h2>Assignment Reminder</h2>
        <p>Hello ${recipient.name},</p>
        <p>This is a reminder about an assignment:</p>
        <ul>
          <li><strong>Assignment:</strong> ${assignment.title}</li>
          <li><strong>Class:</strong> ${classroom.name}</li>
          <li><strong>Due Date:</strong> ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'N/A'}</li>
        </ul>
        <p>Please make sure to submit before the due date.</p>
      `
    })));

    res.json({ message: 'Assignment reminders sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send assignment result
router.post('/assignment-result/:assignmentId/:studentId', internalAuth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId)
      .populate({
        path: 'classroomId',
        select: 'name teacherId',
        populate: { path: 'teacherId', select: 'name email' }
      })
      .populate({
        path: 'submissions.studentId',
        select: 'name email'
      });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const submission = assignment.submissions.find(
      sub => sub.studentId._id.toString() === req.params.studentId
    );

    if (!submission || submission.status !== 'graded') {
      return res.status(400).json({ message: 'Assignment not graded yet' });
    }

    const student = submission.studentId;
    const teacher = assignment.classroomId.teacherId;

    if (!student || !teacher || !student.email || !teacher.email) {
      console.error('Missing student or teacher data for assignment result notification:', { student: !!student, teacher: !!teacher, studentEmail: !!student?.email, teacherEmail: !!teacher?.email });
      return res.status(400).json({ message: 'Missing required recipient data for notification.' });
    }

    // Send to student
    await sendEmail({
      to: student.email,
      subject: `Assignment Result: ${assignment.title}`,
      html: `
        <h2>Assignment Result</h2>
        <p>Hello ${student.name},</p>
        <p>Your assignment has been graded:</p>
        <ul>
          <li><strong>Assignment:</strong> ${assignment.title}</li>
          <li><strong>Score:</strong> ${submission.score}/${assignment.maxScore}</li>
          <li><strong>Feedback:</strong> ${submission.feedback || 'No feedback provided'}</li>
        </ul>
      `
    });

    // Send to teacher
    await sendEmail({
      to: teacher.email,
      subject: `Assignment Graded: ${assignment.title}`,
      html: `
        <h2>Assignment Graded</h2>
        <p>Hello ${teacher.name},</p>
        <p>You have graded an assignment:</p>
        <ul>
          <li><strong>Assignment:</strong> ${assignment.title}</li>
          <li><strong>Student:</strong> ${student.name}</li>
          <li><strong>Score:</strong> ${submission.score}/${assignment.maxScore}</li>
        </ul>
      `
    });

    res.json({ message: 'Assignment results sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send payment notification
router.post('/payment-notification', internalAuth, async (req, res) => {
  try {
    const { userId, type, amount, status } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.name || !user.email) {
      console.error('Missing user name or email for payment notification:', { userId, name: user.name, email: user.email });
      return res.status(400).json({ message: 'Missing required user data for notification.' });
    }

    await sendEmail({
      to: user.email,
      subject: `Payment ${status}: ${type}`,
      html: `
        <h2>Payment Notification</h2>
        <p>Hello ${user.name},</p>
        <p>Your payment has been ${status}:</p>
        <ul>
          <li><strong>Type:</strong> ${type}</li>
          <li><strong>Amount:</strong> $${amount}</li>
          <li><strong>Status:</strong> ${status}</li>
        </ul>
      `
    });

    res.json({ message: 'Payment notification sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send payout notification
router.post('/payout-notification', internalAuth, async (req, res) => {
  try {
    const { userId, amount, status, classroomId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const classroomName = classroomId ? (await Classroom.findById(classroomId))?.name : 'class enrollment';

    await sendEmail({
      to: user.email,
      subject: `Payout Approved: ${classroomName}`,
      html: `
        <h2>Disbursement Notification</h2>
        <p>Hello ${user.name},</p>
        <p>Great news! Your disbursement has been approved and paid:</p>
        <ul>
          <li><strong>Amount:</strong> ₦${amount}</li>
          <li><strong>Class:</strong> ${classroomName}</li>
          <li><strong>Status:</strong> ${status}</li>
        </ul>
        <p>The funds should reflect in your registered bank account soon.</p>
      `
    });

    res.json({ message: 'Payout notification sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
