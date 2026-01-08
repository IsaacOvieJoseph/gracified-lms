const cron = require('node-cron');
const { checkAndSendReminders } = require('./reminderHelper');

const startScheduler = () => {
    // Run every minute
    // We use a cron expression that triggers at the start of every minute
    cron.schedule('* * * * *', async () => {
        try {
            await checkAndSendReminders();
        } catch (error) {
            console.error('[Cron] Scheduler execution failed:', error.message);
        }
    });

    console.log('Class session scheduler started (running every minute)');
};

module.exports = { startScheduler };
