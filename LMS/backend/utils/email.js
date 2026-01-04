const brevo = require('@getbrevo/brevo');
const defaultClient = brevo.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const brevoEmailApi = new brevo.TransactionalEmailsApi();

/**
 * Wraps HTML content with header (dynamic logo) and footer (Gracified logo)
 * @param {string} content - Main body content
 * @param {string} customLogoUrl - Optional school/tutorial logo URL
 */
function wrapEmail(content, customLogoUrl = null) {
    const gracifiedLogo = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/logo.jpg`;
    const headerLogo = customLogoUrl || gracifiedLogo;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 25px;">
          <img src="${headerLogo}" alt="Logo" style="max-height: 80px; width: auto; object-fit: contain;">
        </div>
        
        <div style="min-height: 200px;">
          ${content}
        </div>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0; text-align: center;">
          <div style="margin-bottom: 10px;">
            <img src="${gracifiedLogo}" alt="Gracified logo" style="max-height: 30px; vertical-align: middle; margin-right: 8px;">
            <span style="font-size: 12px; color: #6b7280; vertical-align: middle;">Powered by <strong>Gracified LMS</strong></span>
          </div>
          <p style="font-size: 11px; color: #9ca3af; margin: 0;">© ${new Date().getFullYear()} Gracified LMS. All rights reserved.</p>
        </div>
      </div>
    `;
}

/**
 * Helper to send transactional email via Brevo
 * @param {Object} options - { to, subject, html, classroomId }
 */
async function sendEmail({ to, subject, html, classroomId }) {
    let customLogoUrl = null;

    if (classroomId) {
        try {
            const Classroom = require('../models/Classroom');
            const School = require('../models/School');
            const Tutorial = require('../models/Tutorial');
            const User = require('../models/User');

            const classroom = await Classroom.findById(classroomId).populate('teacherId');
            if (classroom) {
                if (classroom.schoolId && classroom.schoolId.length > 0) {
                    const school = await School.findById(classroom.schoolId[0]);
                    if (school && school.logoUrl) customLogoUrl = school.logoUrl;
                } else if (classroom.teacherId && classroom.teacherId.tutorialId) {
                    const tutorial = await Tutorial.findById(classroom.teacherId.tutorialId);
                    if (tutorial && tutorial.logoUrl) customLogoUrl = tutorial.logoUrl;
                }
            }
        } catch (err) {
            console.error('Error fetching custom logo for email:', err.message);
        }
    }

    const finalHtml = wrapEmail(html, customLogoUrl);

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
    sendSmtpEmail.htmlContent = finalHtml;

    try {
        await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
    } catch (err) {
        console.error('Brevo sendEmail error:', err.message);
        throw err;
    }
}

module.exports = { sendEmail, wrapEmail };
