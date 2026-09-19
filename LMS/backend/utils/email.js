const brevo = require('@getbrevo/brevo');
const defaultClient = brevo.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = (process.env.BREVO_API_KEY || '').trim();

const brevoEmailApi = new brevo.TransactionalEmailsApi();

/* ===========================================================
   Gracified brand palette — mirrored from frontend/src/index.css
   =========================================================== */
const NAVY = '#1D3557';
const INK = '#14202E';
const SLATE = '#5B6B7C';
const HAIRLINE = '#E4E9EF';
const PANEL = '#F7F8FA';
const PAPER = '#FFFFFF';
const SOFT = '#F6F8FA';
const GOLD = '#A9791F';
const FOREST = '#2F6E4E';
const ROSE = '#A23B2E';

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Inter, 'Helvetica Neue', Arial, sans-serif";

/* ===========================================================
   Reusable content helpers (used inside template bodies)
   =========================================================== */

/**
 * Serif heading — the frontend renders h1–h6 with 'Source Serif 4'/Georgia.
 */
function emailHeading(text, opts = {}) {
  const color = opts.color || NAVY;
  const size = opts.size || '21px';
  return `<h2 style="margin:0 0 6px; font-family:${SERIF}; font-weight:600; letter-spacing:-0.01em; color:${color}; font-size:${size}; line-height:1.35;">${text}</h2>`;
}

/**
 * Small letter-spaced gold eyebrow label.
 */
function emailEyebrow(text) {
  return `<div style="margin:0 0 8px; font-size:11px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:${GOLD};">${text}</div>`;
}

/**
 * Body paragraph.
 */
function emailText(text, opts = {}) {
  const color = opts.color || INK;
  const weight = opts.bold ? '600' : '400';
  const size = opts.size || '15px';
  return `<p style="margin:0 0 10px; color:${color}; font-size:${size}; line-height:1.7; font-weight:${weight};">${text}</p>`;
}

/**
 * Primary/secondary action button. Rounded to match the 12px token.
 */
function emailButton(label, url, opts = {}) {
  const bg = opts.bg || NAVY;
  const fg = opts.fg || PAPER;
  const align = opts.align || 'left';
  return `<div style="margin:22px 0 4px; text-align:${align};">
    <a href="${url}" style="display:inline-block; background:${bg}; color:${fg}; border-radius:12px; padding:13px 28px; font-family:${SANS}; font-size:14px; font-weight:600; text-decoration:none; letter-spacing:0.2px; box-shadow:0 1px 2px rgba(20,32,46,0.12);">${label}</a>
  </div>`;
}

/**
 * Info panel with optional accent bar (like the frontend's callout cards).
 */
function emailPanel(inner, opts = {}) {
  const bg = opts.bg || PANEL;
  const border = opts.border || HAIRLINE;
  const accent = opts.accent ? `border-left:3px solid ${opts.accent};` : '';
  return `<div style="background:${bg}; border:1px solid ${border}; border-radius:12px; padding:18px 20px; margin:18px 0; ${accent} font-size:14px; line-height:1.7; color:${INK};">${inner}</div>`;
}

/**
 * Centered OTP/verification code block.
 */
function emailCode(code, opts = {}) {
  const label = opts.label || 'One-Time Password';
  const note = opts.note || '';
  return `<div style="background:${PANEL}; border:1px solid ${HAIRLINE}; border-radius:12px; padding:22px; margin:20px 0; text-align:center;">
    <div style="font-size:11px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:${SLATE}; margin-bottom:8px;">${label}</div>
    <div style="font-size:34px; font-weight:700; letter-spacing:8px; color:${NAVY}; margin:4px 0 10px;">${code}</div>
    ${note ? `<div style="font-size:13px; color:${SLATE};">${note}</div>` : ''}
  </div>`;
}

/**
 * Big score/result hero banner (navy solid, matching exam score cards).
 */
function emailResultHero(opts = {}) {
  const eyebrow = opts.eyebrow || 'Your Score';
  const value = opts.value || '';
  const meta = opts.meta || '';
  const tone = opts.tone || NAVY;
  return `<div style="background:${tone}; border-radius:12px; padding:28px 20px; margin:22px 0; text-align:center; color:#FFFFFF;">
    <div style="font-size:11px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; opacity:0.85; margin-bottom:6px;">${eyebrow}</div>
    <div style="font-size:40px; font-weight:700; letter-spacing:-0.01em; line-height:1.1;">${value}</div>
    ${meta ? `<div style="font-size:15px; margin-top:8px; opacity:0.92;">${meta}</div>` : ''}
  </div>`;
}

/**
 * Label/value rows (table-based for maximum client support).
 */
function emailMeta(rows) {
  const body = rows.map(([k, v]) => `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; margin:3px 0;">
        <tr>
          <td style="color:${SLATE}; font-weight:600; padding:2px 12px 2px 0; white-space:normal; vertical-align:top;">${k}</td>
          <td style="color:${INK}; text-align:right; font-weight:600; vertical-align:top;">${v}</td>
        </tr>
      </table>`).join('');
  return `<div style="background:${PANEL}; border:1px solid ${HAIRLINE}; border-radius:12px; padding:14px 20px; margin:18px 0; font-size:14px; line-height:1.6;">${body}</div>`;
}

/**
 * Thin hairline divider.
 */
function emailDivider() {
  return `<div style="height:1px; background:${HAIRLINE}; margin:22px 0;"></div>`;
}

/**
 * Small muted footnote (automated notices, T&C, etc.).
 */
function emailNote(text) {
  return `<p style="font-size:12px; color:${SLATE}; margin:18px 0 0; line-height:1.6;">${text}</p>`;
}

/* ===========================================================
   Shell
   =========================================================== */

/**
 * Wraps HTML content with a branded header (dynamic logo) and footer
 * (Gracified wordmark), styled to match the Gracified frontend.
 * @param {string} content - Main body content
 * @param {string} customLogoUrl - Optional school/tutorial logo URL
 */
function wrapEmail(content, customLogoUrl = null) {
  const gracifiedLogo = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/logo.jpg`;

  // The school/tutorial logo at the top, fallback to Gracified if not available
  const headerLogo = customLogoUrl || gracifiedLogo;

  return `
      <div style="background:${SOFT}; padding:32px 16px; font-family:${SANS}; color:${INK};">
        <div style="max-width:600px; margin:0 auto; background:${PAPER}; border:1px solid ${HAIRLINE}; border-radius:12px; overflow:hidden; box-shadow:0 1px 2px rgba(20,32,46,0.04), 0 10px 28px -18px rgba(20,32,46,0.18);">
          <div style="height:4px; background:${NAVY};"></div>

          <div style="text-align:center; padding:34px 20px 22px; border-bottom:1px solid ${HAIRLINE};">
            <img src="${headerLogo}" alt="Logo" style="max-height:60px; max-width:220px; width:auto; object-fit:contain;">
            <div style="width:44px; height:2px; background:${GOLD}; margin:14px auto 0; border-radius:2px;"></div>
          </div>

          <div style="padding:34px 40px 26px; min-height:240px; color:${INK}; font-size:15px; line-height:1.7;">
            ${content}
          </div>

          <div style="padding:28px 20px; background:${PANEL}; border-top:1px solid ${HAIRLINE}; text-align:center;">
            <div style="margin-bottom:10px; display:flex; align-items:center; justify-content:center;">
              <img src="${gracifiedLogo}" alt="Gracified logo" style="max-height:22px; width:auto; vertical-align:middle; margin-right:10px; border-radius:4px;">
              <span style="font-size:13px; color:${SLATE}; font-weight:500;">Powered by <strong style="color:${NAVY};">Gracified LMS</strong></span>
            </div>
            <p style="font-size:11px; color:${SLATE}; margin:0; letter-spacing:0.5px; text-transform:uppercase;">© ${new Date().getFullYear()} Gracified LMS. All rights reserved.</p>
          </div>
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

module.exports = {
  sendEmail,
  wrapEmail,
  // Brand tokens
  NAVY, INK, SLATE, HAIRLINE, PANEL, PAPER, SOFT, GOLD, FOREST, ROSE, SERIF, SANS,
  // Content helpers
  emailHeading,
  emailEyebrow,
  emailText,
  emailButton,
  emailPanel,
  emailCode,
  emailResultHero,
  emailMeta,
  emailDivider,
  emailNote,
};