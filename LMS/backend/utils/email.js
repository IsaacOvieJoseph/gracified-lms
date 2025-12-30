const brevo = require('@getbrevo/brevo');
const defaultClient = brevo.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const brevoEmailApi = new brevo.TransactionalEmailsApi();

/**
 * Helper to send transactional email via Brevo
 * @param {Object} options - { to, subject, html }
 */
async function sendEmail({ to, subject, html }) {
    const sender = {
        name: 'Gracified LMS',
        email: process.env.BREVO_FROM_EMAIL || process.env.BREVO_SENDER_EMAIL || 'no-reply@gracifiedlms.com'
    };

    const receivers = Array.isArray(to)
        ? to.map(email => ({ email }))
        : [{ email: to }];

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = sender;
    sendSmtpEmail.to = receivers;
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;

    try {
        await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
    } catch (err) {
        console.error('Brevo sendEmail error:', err.message);
        throw err;
    }
}

module.exports = { sendEmail };
