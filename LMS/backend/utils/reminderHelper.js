const Classroom = require('../models/Classroom');
const Notification = require('../models/Notification');
const { sendEmail } = require('./email');

/**
 * Core logic to check for upcoming classes and send reminders.
 * Can be called by internal node-cron or via external HTTP trigger.
 */
const checkAndSendReminders = async (forcedTime = null) => {
    try {
        const now = forcedTime ? new Date(forcedTime) : new Date();

        // Adjust to +15 minutes for reminder
        const reminderTime = new Date(now.getTime() + 15 * 60 * 1000);

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = dayNames[reminderTime.getUTCDay()];

        const hours = reminderTime.getUTCHours().toString().padStart(2, '0');
        const minutes = reminderTime.getUTCMinutes().toString().padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;

        console.log(`[Scheduler] Checking for classes starting at ${timeStr} UTC on ${currentDay} (Server Time: ${new Date().toISOString()})`);

        // Find classrooms with sessions starting in 15 minutes
        const classrooms = await Classroom.find({
            schedule: {
                $elemMatch: {
                    dayOfWeek: currentDay,
                    startTime: timeStr
                }
            }
        })
            .populate('teacherId', 'name email')
            .populate('students', 'name email')
            .populate('currentTopicId', 'name description status');

        if (classrooms.length === 0) {
            return { processed: 0, message: 'No classes found for this window' };
        }

        let totalReminders = 0;
        for (const classroom of classrooms) {
            const recipients = [];
            if (classroom.teacherId) recipients.push({ user: classroom.teacherId, role: 'teacher' });
            if (classroom.students) {
                classroom.students.forEach(s => recipients.push({ user: s, role: 'student' }));
            }

            // Get topic information
            const topicInfo = classroom.currentTopicId ? {
                name: classroom.currentTopicId.name,
                description: classroom.currentTopicId.description,
                status: classroom.currentTopicId.status
            } : null;

            for (const { user, role } of recipients) {
                if (!user || !user.email) continue;

                let message = `Reminder: Your class "${classroom.name}" starts in 15 minutes at ${timeStr}.`;
                if (topicInfo) {
                    message += ` Current topic: ${topicInfo.name}`;
                }

                // 1. Create In-app Notification
                try {
                    await Notification.create({
                        userId: user._id,
                        message,
                        type: 'class_reminder',
                        entityId: classroom._id,
                        entityRef: 'Classroom'
                    });
                } catch (err) {
                    console.error(`[Scheduler] In-app Error for ${user.email}:`, err.message);
                }

                // 2. Send Email
                try {
                    let emailHtml = `
                      <h2 style="color: #4f46e5;">Class Session Reminder</h2>
                      <p>Hello <strong>${user.name}</strong>,</p>
                      <p>This is a reminder that your class session is starting soon:</p>
                      <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Class:</strong> ${classroom.name}</p>
                        <p style="margin: 5px 0;"><strong>Starts At:</strong> ${timeStr}</p>
                        <p style="margin: 5px 0;"><strong>Day:</strong> ${currentDay}</p>`;

                    if (topicInfo) {
                        emailHtml += `
                        <p style="margin: 5px 0;"><strong>Current Topic:</strong> ${topicInfo.name}</p>`;
                        if (topicInfo.description) {
                            emailHtml += `
                        <p style="margin: 5px 0; color: #6b7280;"><em>${topicInfo.description}</em></p>`;
                        }
                    }

                    emailHtml += `
                      </div>
                      <p>Please log in and be ready to join the session.</p>
                      <a href="${(process.env.FRONTEND_URL || 'http://localhost:3000')}/classrooms/${classroom._id}" 
                         style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                        Go to Classroom
                      </a>
                    `;

                    await sendEmail({
                        to: user.email,
                        subject: `Class Reminder: ${classroom.name}${topicInfo ? ` - ${topicInfo.name}` : ''}`,
                        classroomId: classroom._id,
                        html: emailHtml
                    });
                } catch (err) {
                    console.error(`[Scheduler] Email Error for ${user.email}:`, err.message);
                }
                totalReminders++;
            }
            console.log(`[Scheduler] Sent reminders for class: ${classroom.name} at ${timeStr}${topicInfo ? ` (Topic: ${topicInfo.name})` : ''}`);
        }
        return { processed: classrooms.length, reminders: totalReminders };
    } catch (error) {
        console.error('[Scheduler] Critical Error:', error.message);
        throw error;
    }
};

module.exports = { checkAndSendReminders };
