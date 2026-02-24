const brevo = require('@getbrevo/brevo');
const defaultClient = brevo.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = (process.env.BREVO_API_KEY || '').trim();

const brevoEmailApi = new brevo.TransactionalEmailsApi();

/**
 * Wraps HTML content with header (dynamic logo) and footer (Gracified logo)
 * @param {string} content - Main body content
 * @param {string} customLogoUrl - Optional school/tutorial logo URL
 */
function wrapEmail(content, customLogoUrl = null) {
  const gracifiedLogo = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/logo.jpg`;

  // The school/tutorial logo at the top, fallback to Gracified if not available
  const headerLogo = customLogoUrl || gracifiedLogo;

  return `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 0; border: 1px solid #f0f0f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); background-color: #ffffff;">
        <div style="text-align: center; padding: 40px 20px 30px 20px; background-color: #ffffff;">
          <img src="${headerLogo}" alt="Logo" style="max-height: 70px; width: auto; object-fit: contain;">
        </div>
        
        <div style="padding: 0 40px; min-height: 250px; color: #374151; font-size: 16px; line-height: 1.6;">
          ${content}
        </div>

        <div style="margin-top: 50px; padding: 40px 20px; background-color: #f9fafb; border-top: 1px solid #f0f0f0; text-align: center;">
          <div style="margin-bottom: 15px; display: flex; align-items: center; justify-content: center;">
            <img src="${gracifiedLogo}" alt="Gracified logo" style="max-height: 24px; vertical-align: middle; margin-right: 10px; border-radius: 4px;">
            <span style="font-size: 13px; color: #4b5563; font-weight: 500;">Powered by <strong>Gracified LMS</strong></span>
          </div>
          <p style="font-size: 11px; color: #9ca3af; margin: 0; letter-spacing: 0.5px; text-transform: uppercase;">© ${new Date().getFullYear()} Gracified LMS. All rights reserved.</p>
        </div>
      </div>
    `;
}

/**
 * Helper to send transactional email via Brevo
 * @param {Object} options - { to, subject, html, classroomId, userId, schoolId, tutorialId, isSystemEmail }
 */
async function sendEmail({ to, subject, html, classroomId, userId, schoolId, tutorialId, isSystemEmail = false }) {
  let customLogoUrl = null;

  try {
    const Classroom = require('../models/Classroom');
    const School = require('../models/School');
    const Tutorial = require('../models/Tutorial');
    const User = require('../models/User');

    // If it's a system email (like OTP), we don't look for a school logo
    if (!isSystemEmail) {
      // 1. If schoolId or tutorialId passed directly, use it
      if (schoolId) {
        const school = await School.findById(schoolId);
        if (school && school.logoUrl) customLogoUrl = school.logoUrl;
      } else if (tutorialId) {
        const tutorial = await Tutorial.findById(tutorialId);
        if (tutorial && tutorial.logoUrl) customLogoUrl = tutorial.logoUrl;
      }

      // 2. If classroomId passed, try to get logo from school or teacher's tutorial
      if (!customLogoUrl && classroomId) {
        const classroom = await Classroom.findById(classroomId).populate('teacherId');
        if (classroom) {
          if (classroom.schoolId && classroom.schoolId.length > 0) {
            const sId = Array.isArray(classroom.schoolId) ? classroom.schoolId[0] : classroom.schoolId;
            const school = await School.findById(sId);
            if (school && school.logoUrl) customLogoUrl = school.logoUrl;
          } else if (classroom.teacherId && classroom.teacherId.tutorialId) {
            const tutorial = await Tutorial.findById(classroom.teacherId.tutorialId);
            if (tutorial && tutorial.logoUrl) customLogoUrl = tutorial.logoUrl;
          }
        }
      }

      // 3. If userId passed OR if it's a single recipient, try to find user's school/tutorial
      if (!customLogoUrl) {
        let targetUserId = userId;

        // If no userId but single 'to' email, try to find the user
        if (!targetUserId && typeof to === 'string') {
          const recipientUser = await User.findOne({ email: to.toLowerCase() });
          if (recipientUser) targetUserId = recipientUser._id;
        }

        if (targetUserId) {
          const user = await User.findById(targetUserId);
          if (user) {
            if (user.schoolId && user.schoolId.length > 0) {
              const sId = Array.isArray(user.schoolId) ? user.schoolId[0] : user.schoolId;
              const school = await School.findById(sId);
              if (school && school.logoUrl) customLogoUrl = school.logoUrl;
            } else if (user.tutorialId) {
              const tutorial = await Tutorial.findById(user.tutorialId);
              if (tutorial && tutorial.logoUrl) customLogoUrl = tutorial.logoUrl;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching custom logo for email:', err.message);
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
    const result = await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
    return result;
  } catch (err) {
    console.error('Brevo sendEmail error:', err.message);
    throw err;
  }
}

module.exports = { sendEmail, wrapEmail };
