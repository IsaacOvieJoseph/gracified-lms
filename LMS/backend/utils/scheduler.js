const cron = require('node-cron');
const mongoose = require('mongoose');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendEmail } = require('./email');

const startScheduler = () => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            // Adjust to +15 minutes for reminder
            const reminderTime = new Date(now.getTime() + 15 * 60 * 1000);

            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const currentDay = dayNames[reminderTime.getDay()];

            const hours = reminderTime.getHours().toString().padStart(2, '0');
            const minutes = reminderTime.getMinutes().toString().padStart(2, '0');
            const timeStr = `${hours}:${minutes}`;

            // Find classrooms with sessions starting in 15 minutes
            const classrooms = await Classroom.find({
                schedule: {
                    $elemMatch: {
                        dayOfWeek: currentDay,
                        startTime: timeStr
                    }
                }
            }).populate('teacherId', 'name email').populate('students', 'name email');

            for (const classroom of classrooms) {
                const recipients = [
                    { user: classroom.teacherId, role: 'teacher' },
                    ...classroom.students.map(s => ({ user: s, role: 'student' }))
                ];

                for (const { user, role } of recipients) {
                    if (!user || !user.email) continue;

                    const message = `Reminder: Your class "${classroom.name}" starts in 15 minutes at ${timeStr}.`;

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
                        console.error(`Failed to create in-app notification for ${user.email}:`, err.message);
                    }

                    // 2. Send Email
                    try {
                        await sendEmail({
                            to: user.email,
                            subject: `Class Reminder: ${classroom.name}`,
                            classroomId: classroom._id,
                            html: `
                              <h2 style="color: #4f46e5;">Class Session Reminder</h2>
                              <p>Hello <strong>${user.name}</strong>,</p>
                              <p>This is a reminder that your class session is starting soon:</p>
                              <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 5px 0;"><strong>Class:</strong> ${classroom.name}</p>
                                <p style="margin: 5px 0;"><strong>Starts At:</strong> ${timeStr}</p>
                                <p style="margin: 5px 0;"><strong>Day:</strong> ${currentDay}</p>
                              </div>
                              <p>Please log in and be ready to join the session.</p>
                              <a href="${(process.env.FRONTEND_URL || 'http://localhost:3000')}/classrooms/${classroom._id}" 
                                 style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                                Go to Classroom
                              </a>
                            `
                        });
                    } catch (err) {
                        console.error(`Failed to send email reminder to ${user.email}:`, err.message);
                    }
                }
                console.log(`Sent 15-min reminders for class: ${classroom.name} (${classroom._id}) at ${timeStr}`);
            }
        } catch (error) {
            console.error('Scheduler Error:', error.message);
        }
    });

    console.log('Class session scheduler started (running every minute)');
};

module.exports = { startScheduler };
