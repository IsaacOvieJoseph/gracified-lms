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
  return `<p style="margin:0 0 10px; color:${color}; font-size:${size}; line-height:1.7; font-weight:${weight}; word-wrap:break-word; overflow-wrap:anywhere;">${text}</p>`;
}

/**
 * Primary/secondary action button. Rounded to match the 12px token.
 */
function emailButton(label, url, opts = {}) {
  const bg = opts.bg || NAVY;
  const fg = opts.fg || PAPER;
  const align = opts.align || 'left';
  return `<div style="margin:22px 0 4px; text-align:${align};">
    <a href="${url}" class="email-btn" style="display:inline-block; background:${bg}; color:${fg}; border-radius:12px; padding:13px 28px; font-family:${SANS}; font-size:14px; font-weight:600; text-decoration:none; letter-spacing:0.2px; box-shadow:0 1px 2px rgba(20,32,46,0.12);">${label}</a>
  </div>`;
}

/**
 * Info panel with optional accent bar (like the frontend's callout cards).
 */
function emailPanel(inner, opts = {}) {
  const bg = opts.bg || PANEL;
  const border = opts.border || HAIRLINE;
  const accent = opts.accent ? `border-left:3px solid ${opts.accent};` : '';
  return `<div class="email-panel" style="background:${bg}; border:1px solid ${border}; border-radius:12px; padding:18px 20px; margin:18px 0; ${accent} font-size:14px; line-height:1.7; color:${INK}; word-wrap:break-word; overflow-wrap:anywhere;">${inner}</div>`;
}

/**
 * Centered OTP/verification code block.
 */
function emailCode(code, opts = {}) {
  const label = opts.label || 'One-Time Password';
  const note = opts.note || '';
  return `<div class="email-code" style="background:${PANEL}; border:1px solid ${HAIRLINE}; border-radius:12px; padding:22px; margin:20px 0; text-align:center;">
    <div style="font-size:11px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:${SLATE}; margin-bottom:8px;">${label}</div>
    <div class="email-otp" style="font-size:34px; font-weight:700; letter-spacing:8px; color:${NAVY}; margin:4px 0 10px; word-wrap:break-word; overflow-wrap:anywhere; word-break:break-all;">${code}</div>
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
 * Short values render inline (label left, value right); long values can be
 * passed as a third item { stacked: true } to render the label above a full-width
 * wrapped paragraph (safe on narrow mobile viewports). Alternatively use
 * emailInfoBlock() outside the meta panel for standalone blocks.
 */
function emailMeta(rows) {
  const body = rows.map((row) => {
    const [k, v, opts = {}] = row;
    if (opts.stacked) {
      return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; margin:4px 0;">
        <tr><td style="color:${SLATE}; font-size:12px; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; padding:0 0 4px; vertical-align:top;">${k}</td></tr>
        <tr><td style="color:${INK}; font-weight:600; vertical-align:top; white-space:pre-line; word-wrap:break-word; overflow-wrap:anywhere; word-break:break-word; line-height:1.7;">${v}</td></tr>
      </table>`;
    }
    return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; margin:3px 0;">
        <tr>
          <td style="color:${SLATE}; font-weight:600; padding:2px 12px 2px 0; white-space:normal; vertical-align:top;">${k}</td>
          <td style="color:${INK}; text-align:right; font-weight:600; vertical-align:top; white-space:normal; word-wrap:break-word; overflow-wrap:anywhere; word-break:break-word;">${v}</td>
        </tr>
      </table>`;
  }).join('');
  return `<div class="email-panel" style="background:${PANEL}; border:1px solid ${HAIRLINE}; border-radius:12px; padding:14px 20px; margin:18px 0; font-size:14px; line-height:1.6;">${body}</div>`;
}

/**
 * Standalone label + full-width text block. Label sits on its own line and the
 * text is a left-aligned paragraph that preserves line breaks (pre-line) and
 * wraps safely on narrow mobile viewports — use this for long descriptive text
 * (topic descriptions, reminders, feedback, notes) instead of right-aligned
 * label/value table rows.
 */
function emailInfoBlock(label, text) {
  return `<div class="email-panel" style="background:${PANEL}; border:1px solid ${HAIRLINE}; border-radius:12px; padding:18px 20px; margin:18px 0; font-size:14px; line-height:1.7; color:${INK}; word-wrap:break-word; overflow-wrap:anywhere;">
    <div style="color:${SLATE}; font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin:0 0 8px;">${label}</div>
    <div style="color:${INK}; font-weight:500; white-space:pre-line; word-wrap:break-word; overflow-wrap:anywhere; word-break:break-word;">${text}</div>
  </div>`;
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

  // Normalize author-injected (marketing/AI) content: if a stored template is a
  // full HTML document, strip the wrapper tags so it embeds cleanly into the shell.
  const innerContent = String(content || '').replace(/<!DOCTYPE[^>]*>/i, '');
  const bodyMatch = innerContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const stripped = bodyMatch ? bodyMatch[1] : innerContent.replace(/<html[^>]*>|<\/html>|<head[^>]*>[\s\S]*?<\/head>|<body[^>]*>|<\/body>/gi, '');

  return `
    <!DOCTYPE html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Gracified LMS</title>
      <style>
        @media only screen and (max-width:600px) {
          .email-outer { background:#F0F3F6 !important; padding:14px 8px !important; }
          .email-card { border-radius:10px !important; }
          .email-header { padding:24px 14px 16px !important; }
          .email-header-logo { max-width:170px !important; }
          .email-body { padding:24px 14px 18px !important; }
          .email-btn { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; padding:15px 12px !important; }
          .email-panel { padding:14px 14px !important; }
          .email-code { padding:18px 12px !important; }
          .email-otp { font-size:28px !important; letter-spacing:5px !important; }
          .email-footer { padding:22px 14px !important; }
        }
      </style>
    </head>
    <body style="margin:0; padding:0;">
      <div class="email-outer" style="background:${SOFT}; padding:32px 16px; font-family:${SANS}; color:${INK};">
        <div class="email-card" style="max-width:600px; margin:0 auto; background:${PAPER}; border:1px solid ${HAIRLINE}; border-radius:12px; overflow:hidden; box-shadow:0 1px 2px rgba(20,32,46,0.04), 0 10px 28px -18px rgba(20,32,46,0.18);">
          <div style="height:4px; background:${NAVY};"></div>

          <div class="email-header" style="text-align:center; padding:34px 20px 22px; border-bottom:1px solid ${HAIRLINE};">
            <img class="email-header-logo" src="${headerLogo}" alt="Logo" style="max-height:60px; max-width:220px; width:auto; object-fit:contain;">
            <div style="width:44px; height:2px; background:${GOLD}; margin:14px auto 0; border-radius:2px;"></div>
          </div>

          <div class="email-body" style="padding:34px 40px 26px; min-height:240px; color:${INK}; font-size:15px; line-height:1.7;">
            ${stripped}
          </div>

          <div class="email-footer" style="padding:28px 20px; background:${PANEL}; border-top:1px solid ${HAIRLINE}; text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 10px; border-collapse:collapse;">
              <tr>
                <td style="vertical-align:middle; padding-right:8px; line-height:0;">
                  <img src="${gracifiedLogo}" alt="Gracified logo" width="20" height="20" style="display:block; width:20px; height:20px; border:0; border-radius:4px;">
                </td>
                <td style="vertical-align:middle; font-family:${SANS}; font-size:13px; color:${SLATE}; font-weight:500;">
                  Powered by <strong style="color:${NAVY};">Gracified LMS</strong>
                </td>
              </tr>
            </table>
            <p style="font-size:11px; color:${SLATE}; margin:0; letter-spacing:0.5px; text-transform:uppercase;">© ${new Date().getFullYear()} Gracified LMS. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
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
  emailInfoBlock,
  emailDivider,
  emailNote,
};