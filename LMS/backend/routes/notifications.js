const express = require('express');
const router = express.Router();
const { sendEmail } = require('../utils/email');
// ==========================================================
const Classroom = require('../models/Classroom');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const internalAuth = require('../middleware/internalAuth'); // Import internalAuth middleware


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
      classroomId: classroom._id,
      html: `
        <h2 style="color: #4f46e5;">Class Session Reminder</h2>
        <p>Hello <strong>${recipient.name}</strong>,</p>
        <p>This is a reminder for your upcoming class session:</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Class:</strong> ${classroom.name}</p>
          <p style="margin: 5px 0;"><strong>Schedule:</strong> ${classroom.schedule}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <p>Please be prepared and join the session on time.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/classrooms/${classroom._id}" 
           style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; font-weight: bold;">
          Join Classroom
        </a>
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
      classroomId: classroom._id,
      html: `
        <h2 style="color: #f59e0b;">Assignment Reminder</h2>
        <p>Hello <strong>${recipient.name}</strong>,</p>
        <p>This is a reminder about an upcoming assignment deadline:</p>
        <div style="background-color: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 5px 0;"><strong>Assignment:</strong> ${assignment.title}</p>
          <p style="margin: 5px 0;"><strong>Class:</strong> ${classroom.name}</p>
          <p style="margin: 5px 0;"><strong>Due Date:</strong> ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'N/A'}</p>
        </div>
        <p>Don't forget to submit your work before the deadline!</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/classrooms/${classroom._id}" 
           style="display: inline-block; padding: 10px 20px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; font-weight: bold;">
          Open Assignment
        </a>
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
      classroomId: assignment.classroomId._id,
      html: `
        <h2 style="color: #4f46e5;">Assignment Result Ready</h2>
        <p>Hello <strong>${student.name}</strong>,</p>
        <p>Your assignment for <strong>"${assignment.title}"</strong> has been graded.</p>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">Your Score</p>
          <h1 style="margin: 10px 0; color: #1e1b4b; font-size: 36px;">${submission.score} / ${assignment.maxScore}</h1>
          <p style="margin: 5px 0; color: #4b5563;"><strong>Feedback:</strong> ${submission.feedback || 'Good job!'}</p>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/classrooms/${assignment.classroomId._id}" 
           style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
          View Detailed Results
        </a>
      `
    });

    // Send to teacher
    await sendEmail({
      to: teacher.email,
      subject: `Assignment Graded: ${assignment.title}`,
      classroomId: assignment.classroomId._id,
      html: `
        <h2 style="color: #4f46e5;">Assignment Graded</h2>
        <p>Hello <strong>${teacher.name}</strong>,</p>
        <p>You have successfully graded an assignment for <strong>${student.name}</strong>.</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Assignment:</strong> ${assignment.title}</p>
          <p style="margin: 5px 0;"><strong>Student:</strong> ${student.name}</p>
          <p style="margin: 5px 0;"><strong>Final Score:</strong> ${submission.score} / ${assignment.maxScore}</p>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/classrooms/${assignment.classroomId._id}" 
           style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Go to Classroom
        </a>
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
        <h2 style="color: ${status === 'success' ? '#10b981' : '#ef4444'}; text-transform: capitalize;">Payment ${status}</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Your payment for <strong>${type}</strong> has been processed.</p>
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Amount:</strong> ₦${amount}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> <span style="font-weight: bold; color: ${status === 'success' ? '#10b981' : '#ef4444'};">${status.toUpperCase()}</span></p>
        </div>
        <p>If you have any questions, please contact our support team.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
           style="display: inline-block; padding: 10px 20px; background-color: #1e1b4b; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Go to Dashboard
        </a>
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
      classroomId: classroomId,
      html: `
        <h2 style="color: #10b981;">Payout Successful</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Great news! Your disbursement has been approved and paid out to your registered bank account.</p>
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbf7d0;">
          <p style="margin: 5px 0; color: #166534;"><strong>Amount:</strong> ₦${amount}</p>
          <p style="margin: 5px 0; color: #166534;"><strong>Source:</strong> ${classroomName}</p>
          <p style="margin: 5px 0; color: #166534;"><strong>Status:</strong> PAID</p>
        </div>
        <p>The funds should reflect in your account within 1-3 business days depending on your bank.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
           style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
          View Transaction History
        </a>
      `
    });

    res.json({ message: 'Payout notification sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
