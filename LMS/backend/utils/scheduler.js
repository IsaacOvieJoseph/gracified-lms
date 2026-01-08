const cron = require('node-cron');
const { checkAndSendReminders } = require('./reminderHelper');

const startScheduler = () => {
    // Run every minute for class reminders
    // We use a cron expression that triggers at the start of every minute
    cron.schedule('* * * * *', async () => {
        try {
            await checkAndSendReminders();
        } catch (error) {
            console.error('[Cron] Scheduler execution failed:', error.message);
        }
    });

    console.log('Class session scheduler started (running every minute)');

    // Import topic progression helper
    const { checkAutoProgression } = require('./topicProgressionHelper');

    // Run topic auto-progression check daily at midnight
    cron.schedule('0 0 * * *', async () => {
        try {
            console.log('[Cron] Running topic auto-progression check...');
            const results = await checkAutoProgression();
            console.log(`[Cron] Topic auto-progression completed. Processed ${results.length} topics.`);
        } catch (error) {
            console.error('[Cron] Topic auto-progression failed:', error.message);
        }
    });

    console.log('Topic auto-progression scheduler started (running daily at midnight)');
};

module.exports = { startScheduler };
