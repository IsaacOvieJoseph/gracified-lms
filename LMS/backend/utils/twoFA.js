const crypto = require('crypto');
const { sendEmail } = require('./email');

/**
 * Generate a 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate backup codes (10 codes)
 */
function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push({
      code: crypto.randomBytes(4).toString('hex').toUpperCase(),
      used: false,
    });
  }
  return codes;
}

/**
 * Send 2FA OTP email
 */
async function send2FAOTP(user, otp) {
  try {
    const emailContent = `
      <h2>Your 2FA Verification Code</h2>
      <p>Hello ${user.name},</p>
      <p>Your two-factor authentication code is:</p>
      <h3 style="color: #007bff; font-size: 24px; letter-spacing: 2px;">${otp}</h3>
      <p>This code will expire in 5 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    `;

    await sendEmail({
      to: user.email,
      subject: 'Your 2FA Verification Code',
      html: emailContent,
    });

    return true;
  } catch (error) {
    console.error('Error sending 2FA OTP email:', error);
    throw error;
  }
}

/**
 * Generate and send 2FA OTP
 */
async function generateAndSend2FAOTP(user) {
  try {
    const otp = generateOTP();
    const expiryTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    user.twoFAOTP = otp;
    user.twoFAOTPExpires = expiryTime;
    await user.save();

    await send2FAOTP(user, otp);

    return true;
  } catch (error) {
    console.error('Error generating and sending 2FA OTP:', error);
    throw error;
  }
}

/**
 * Verify 2FA OTP
 */
function verify2FAOTP(user, otp) {
  if (!user.twoFAOTP || !user.twoFAOTPExpires) {
    return false;
  }

  if (Date.now() > user.twoFAOTPExpires) {
    return false;
  }

  return user.twoFAOTP === otp;
}

/**
 * Verify backup code
 */
function verifyBackupCode(user, code) {
  if (!user.twoFABackupCodes || user.twoFABackupCodes.length === 0) {
    return false;
  }

  const backupCode = user.twoFABackupCodes.find(
    (bc) => bc.code === code.toUpperCase() && !bc.used
  );

  if (!backupCode) {
    return false;
  }

  backupCode.used = true;
  return true;
}

/**
 * Generate temporary login token
 */
function generateTempLoginToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiryTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  user.tempLoginToken = token;
  user.tempLoginTokenExpires = expiryTime;

  return token;
}

/**
 * Verify temporary login token
 */
function verifyTempLoginToken(user, token) {
  if (!user.tempLoginToken || !user.tempLoginTokenExpires) {
    return false;
  }

  if (Date.now() > user.tempLoginTokenExpires) {
    return false;
  }

  return user.tempLoginToken === token;
}

/**
 * Clear 2FA OTP
 */
function clear2FAOTP(user) {
  user.twoFAOTP = null;
  user.twoFAOTPExpires = null;
}

/**
 * Clear temporary login token
 */
function clearTempLoginToken(user) {
  user.tempLoginToken = null;
  user.tempLoginTokenExpires = null;
}

module.exports = {
  generateOTP,
  generateBackupCodes,
  send2FAOTP,
  generateAndSend2FAOTP,
  verify2FAOTP,
  verifyBackupCode,
  generateTempLoginToken,
  verifyTempLoginToken,
  clear2FAOTP,
  clearTempLoginToken,
};
