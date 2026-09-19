const Classroom = require('../models/Classroom');
const Notification = require('../models/Notification');
const { sendEmail, emailHeading, emailText, emailMeta, emailButton, emailNote } = require('./email');

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
            const dueLabel = assignment.dueDate
                ? `${new Date(assignment.dueDate).toLocaleDateString()} at ${new Date(assignment.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (GMT)`
                : 'Open ended';
            const html = `
                ${emailHeading('New Assignment Posted')}
                ${emailText(`Hello <strong>${recipient.name}</strong>,`)}
                ${emailText(`A new assignment has been posted in <strong>${classroom.name}</strong>. Here are the details:`)}
                ${emailMeta([
                    ['Assignment', assignment.title],
                    ['Due Date', dueLabel],
                    ['Type', assignment.assignmentType.toUpperCase()]
                ])}
                ${emailText('Log in to your dashboard to view the full details and start working on it.')}
                ${emailButton('View Assignment', `${process.env.FRONTEND_URL || 'http://localhost:3000'}/classrooms/${classroom._id}`)}
                ${emailNote('This is an automated notification from Gracified LMS. Please do not reply.')}
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
