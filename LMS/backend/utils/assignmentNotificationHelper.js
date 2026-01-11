const Classroom = require('../models/Classroom');
const Notification = require('../models/Notification');
const { sendEmail } = require('./email');

/**
 * Sends notifications to students and teacher when an assignment is created or re-published
 * @param {Object} assignment - The assignment object (with classroomId populated)
 */
const notifyNewAssignment = async (assignment) => {
    try {
        // Ensure classroom and students are populated
        const classroom = await Classroom.findById(assignment.classroomId).populate('students', 'name email').populate('teacherId', 'name email');
        if (!classroom) {
            console.error('Classroom not found for assignment notification:', assignment.classroomId);
            return;
        }

        // 1. Email Notifications
        const recipients = [
            { email: classroom.teacherId.email, name: classroom.teacherId.name },
            ...classroom.students.map(s => ({ email: s.email, name: s.name }))
        ].filter(r => r.email);

        const emailSubject = `New Assignment: ${assignment.title}`;
        const emailPromises = recipients.map(recipient => {
            const html = `
                <h2 style="color: #4f46e5;">New Assignment Posted</h2>
                <p>Hello <strong>${recipient.name}</strong>,</p>
                <p>A new assignment has been posted in <strong>${classroom.name}</strong>. Please check the details below:</p>
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Title:</strong> ${assignment.title}</p>
                    <p style="margin: 5px 0;"><strong>Due Date:</strong> ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() + ' (GMT)' : 'N/A'}</p>
                    <p style="margin: 5px 0;"><strong>Type:</strong> ${assignment.assignmentType.toUpperCase()}</p>
                </div>
                <p>Log in to your dashboard to view the full details and start working on it.</p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/classrooms/${classroom._id}" 
                   style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; font-weight: bold;">
                    View Assignment
                </a>
            `;
            return sendEmail({
                to: recipient.email,
                subject: emailSubject,
                classroomId: classroom._id,
                html
            }).catch(err => console.error('Error sending assignment email to', recipient.email, err.message));
        });

        // 2. In-app Notifications
        const inAppNotifications = [
            // Teacher
            {
                userId: classroom.teacherId._id,
                message: `New assignment: "${assignment.title}" has been created in "${classroom.name}".`,
                type: 'new_assignment',
                entityId: assignment._id,
                entityRef: 'Assignment',
            },
            // Students
            ...classroom.students.map(student => ({
                userId: student._id,
                message: `New assignment: "${assignment.title}" has been posted in "${classroom.name}".`,
                type: 'new_assignment',
                entityId: assignment._id,
                entityRef: 'Assignment',
            }))
        ];

        await Notification.insertMany(inAppNotifications);
        await Promise.all(emailPromises);

    } catch (error) {
        console.error('Error in notifyNewAssignment:', error.message);
    }
};

module.exports = {
    notifyNewAssignment
};
