const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const School = require('../models/School'); // Import School model
const SubscriptionPlan = require('../models/SubscriptionPlan'); // Import SubscriptionPlan model
const Tutorial = require('../models/Tutorial'); // Import Tutorial model
const { auth } = require('../middleware/auth');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// Configure storage for logos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/logos';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed (jpeg, jpg, png, webp)'));
  }
});

// Logo upload endpoint
router.post('/upload-logo', upload.single('logo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  // Deep file validation (Magic Numbers)
  try {
    const fileTypeModule = await import('file-type');
    // Handle both ESM default export and direct exports
    const FileType = fileTypeModule.default || fileTypeModule;
    const fromFileFn = FileType.fromFile || FileType.fileTypeFromFile;

    if (typeof fromFileFn !== 'function') {
      console.error('file-type module structure:', Object.keys(fileTypeModule));
      if (fileTypeModule.default) console.error('file-type default structure:', Object.keys(fileTypeModule.default));
      throw new Error('file-type validation function not found');
    }

    const type = await fromFileFn(req.file.path);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!type || !allowedTypes.includes(type.mime)) {
      // Delete the invalid file
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Invalid file content. Only real images (JPG, PNG, WebP) are allowed.' });
    }
  } catch (err) {
    console.error('File validation error:', err.message);
    // If validation fails, we play it safe and delete the file
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ message: 'Error validating file content' });
  }

  const protocol = req.protocol;
  const host = req.get('host');
  const imageUrl = `${protocol}://${host}/uploads/logos/${req.file.filename}`;
  res.json({ imageUrl });
});

// Email configuration check
const isEmailConfigured = () => {
  return !!(process.env.BREVO_API_KEY && (process.env.BREVO_FROM_EMAIL || process.env.BREVO_SENDER_EMAIL));
};

// ========== OLD NODEMAILER CODE (COMMENTED OUT) ==========
// const nodemailer = require('nodemailer');
// 
// // Email transporter configuration
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST || 'smtp.gmail.com',
//   port: parseInt(process.env.SMTP_PORT) || 587,
//   secure: false,
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS
//   }
// });
// 
// // Verify email configuration (old)
// const isEmailConfigured = () => {
//   return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
// };
// ==========================================================

// Helper function to generate and send OTP using Brevo
const generateAndSendOTP = async (user) => {
  try {
    // Check if email is configured
    if (!isEmailConfigured()) {
      console.error('Email not configured: BREVO_API_KEY or BREVO_FROM_EMAIL missing');
      if (process.env.NODE_ENV === 'development') {
        const otp = crypto.randomInt(100000, 999999).toString();
        console.log(`OTP for ${user.email}: ${otp}`);
      }
      return;
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 3600000; // OTP expires in 1 hour
    await user.save();

    console.log(`Attempting to send OTP email to ${user.email} via Brevo...`);

    const result = await sendEmail({
      to: user.email,
      name: user.name,
      subject: 'Email Verification OTP',
      html: `
        <h2 style="color: #4f46e5;">Email Verification</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Thank you for joining Gracified LMS. To complete your registration, please use the following One-Time Password (OTP):</p>
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 8px; margin: 25px 0;">
          <h1 style="letter-spacing: 5px; color: #4f46e5; margin: 0; font-size: 32px;">${user.otp}</h1>
        </div>
        <p>This code is valid for 1 hour. If you did not request this, please ignore this email.</p>
        <div style="margin-top: 30px; text-align: center; color: #6b7280; font-size: 14px;">
          <p>Need help? Contact our support team.</p>
        </div>
      `
    });

    console.log(`OTP email sent successfully to ${user.email} via Brevo. Message ID: ${result.messageId || 'N/A'}`);
    return result;
  } catch (error) {
    console.error('Error sending OTP email via Brevo:', error.message);
    console.error('Error details:', {
      statusCode: error.statusCode,
      response: error.response?.body,
      message: error.message
    });

    // Log OTP in console for development/debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`OTP for ${user.email} (email failed): ${user.otp || 'not generated'}`);
    }
    throw error; // Re-throw so caller can handle it
  }
};

// ========== OLD NODEMAILER CODE (COMMENTED OUT) ==========
// // Helper function to generate and send OTP (old nodemailer version)
// const generateAndSendOTP = async (user) => {
//   try {
//     // Check if email is configured
//     if (!isEmailConfigured()) {
//       console.error('Email not configured: SMTP_USER or SMTP_PASS missing');
//       console.log(`OTP for ${user.email}: ${crypto.randomInt(100000, 999999).toString()}`);
//       return;
//     }
//
//     const otp = crypto.randomInt(100000, 999999).toString();
//     user.otp = otp;
//     user.otpExpires = Date.now() + 3600000; // OTP expires in 1 hour
//     await user.save();
//
//     console.log(`Attempting to send OTP email to ${user.email}...`);
//     
//     const mailOptions = {
//       from: process.env.SMTP_USER,
//       to: user.email,
//       subject: 'Email Verification OTP',
//       html: `
//         <h2>Email Verification</h2>
//         <p>Hello ${user.name},</p>
//         <p>Your OTP for email verification is: <strong>${otp}</strong></p>
//         <p>This OTP is valid for 1 hour.</p>
//         <p>If you did not request this, please ignore this email.</p>
//       `
//     };
//
//     const info = await transporter.sendMail(mailOptions);
//     console.log(`OTP email sent successfully to ${user.email}. Message ID: ${info.messageId}`);
//     return info;
//   } catch (error) {
//     console.error('Error sending OTP email:', error.message);
//     console.error('Error details:', {
//       code: error.code,
//       command: error.command,
//       response: error.response,
//       responseCode: error.responseCode
//     });
//     
//     // Log OTP in console for development/debugging
//     console.log(`OTP for ${user.email} (email failed): ${user.otp || 'not generated'}`);
//     throw error; // Re-throw so caller can handle it
//   }
// };
// ==========================================================

// Register
router.post('/register', async (req, res) => {
  try {
    let { name, email, password, role, schoolName, tutorialName, bankName, bankCode, accountNumber, accountName, payoutFrequency, schoolId, logoUrl } = req.body;
    email = email.toLowerCase();

    // Prevent creation of root_admin via public registration
    if (role === 'root_admin') {
      return res.status(403).json({ message: 'Registration as root_admin is not allowed.' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (!existingUser.isVerified) {
        // If user exists but is not verified, resend OTP (send email in background)
        generateAndSendOTP(existingUser).catch(err => {
          console.error('Error sending OTP email for existing user:', err.message);
        });
        return res.status(200).json({ message: 'User already registered but not verified. New OTP sent.', redirectToVerify: true, email });
      }
      return res.status(400).json({ message: 'User already exists and is verified' });
    }

    const user = new User({
      name,
      email,
      password,
      role,
      isVerified: false,
      bankDetails: (role === 'school_admin' || role === 'personal_teacher') ? {
        bankName,
        bankCode,
        accountNumber,
        accountName,
      } : undefined,
      payoutPreference: (role === 'school_admin' || role === 'personal_teacher') ? {
        frequency: payoutFrequency || 'weekly'
      } : undefined
    });
    await user.save();

    if (role === 'school_admin') {
      const school = new School({ name: schoolName, adminId: user._id, logoUrl: logoUrl || null });
      await school.save();
      user.schoolId.push(school._id); // Push into array
      if (logoUrl) user.profilePicture = logoUrl; // Sync logo with profile picture
    } else if (role === 'personal_teacher') {
      const tutorial = new Tutorial({ name: tutorialName, teacherId: user._id, logoUrl: logoUrl || null });
      await tutorial.save();
      user.tutorialId = tutorial._id;
      if (logoUrl) user.profilePicture = logoUrl; // Sync logo with profile picture
    } else if (role === 'student' && schoolId) {
      // If student selects a school/tutorial center
      if (schoolId !== 'none') {
        user.schoolId.push(schoolId);
      }
    }

    // Assign free trial for School Admins and Personal Teachers
    if (role === 'school_admin' || role === 'personal_teacher') {
      const freeTrialPlan = await SubscriptionPlan.findOne({ planType: 'trial' });
      if (freeTrialPlan) {
        user.subscriptionPlan = freeTrialPlan._id;
        user.subscriptionStatus = 'trial';
        user.subscriptionStartDate = Date.now();
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14); // 2 weeks trial
        user.trialEndDate = trialEndDate;
      }
    }

    await user.save(); // Save again to update schoolId, tutorialId, and subscription details

    // Send response immediately, then send email in background
    res.status(201).json({ message: 'Registration successful. Please verify your email with the OTP sent to your email.', redirectToVerify: true, email });

    // Generate and send OTP asynchronously (don't block response)
    generateAndSendOTP(user).catch(err => {
      console.error('Error sending OTP email after registration:', err.message);
      console.error('User registered but email failed. OTP is saved in database.');
      // Email sending failed, but user is already registered
      // In production, you might want to queue this for retry
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message || 'Registration failed. Please try again.' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    let { email, otp } = req.body;
    email = email.toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        _id: user._id, // ensure _id is present
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        schoolId: user.schoolId,
        tutorialId: user.tutorialId,
        bankDetails: user.bankDetails,
        payoutPreference: user.payoutPreference,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    let { email } = req.body;
    email = email.toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    // Send response immediately, then send email in background
    res.json({ message: 'New OTP sent to your email' });

    generateAndSendOTP(user).catch(err => {
      console.error('Error sending OTP email:', err.message);
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    email = email.toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      // If user is not verified, send OTP and inform frontend (send email in background)
      generateAndSendOTP(user).catch(err => {
        console.error('Error sending OTP email during login:', err.message);
      });
      return res.status(403).json({ message: 'Email not verified. An OTP has been sent to your email.', redirectToVerify: true, email });
    }

    // Check subscription status for School Admin and Personal Teacher
    let trialExpired = false;
    let subscriptionExpired = false;
    if ((user.role === 'school_admin' || user.role === 'personal_teacher')) {
      if (user.subscriptionStatus === 'trial' && user.trialEndDate && user.trialEndDate < Date.now()) {
        trialExpired = true;
      }
      if (user.subscriptionStatus === 'active' && user.subscriptionEndDate && user.subscriptionEndDate < Date.now()) {
        subscriptionExpired = true;
      }
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        _id: user._id, // ensure _id is present
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        schoolId: user.schoolId,
        tutorialId: user.tutorialId,
        enrolledClasses: user.enrolledClasses,
        subscriptionStatus: user.subscriptionStatus,
        trialEndDate: user.trialEndDate,
        subscriptionEndDate: user.subscriptionEndDate,
        defaultPricingType: user.defaultPricingType,
        profilePicture: user.profilePicture,
        bankDetails: user.bankDetails,
        payoutPreference: user.payoutPreference
      },
      trialExpired,
      subscriptionExpired,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('enrolledClasses', 'name schedule')
      .populate('schoolId', 'name logoUrl') // Populate school name and logo
      .populate('tutorialId', 'name logoUrl'); // Populate tutorial name and logo

    // Check subscription status for School Admin and Personal Teacher
    let trialExpired = false;
    let subscriptionExpired = false;
    if ((user.role === 'school_admin' || user.role === 'personal_teacher')) {
      if (user.subscriptionStatus === 'trial' && user.trialEndDate && user.trialEndDate < Date.now()) {
        trialExpired = true;
      }
      if (user.subscriptionStatus === 'active' && user.subscriptionEndDate && user.subscriptionEndDate < Date.now()) {
        subscriptionExpired = true;
      }
    }

    res.json({
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        schoolId: user.schoolId,
        tutorialId: user.tutorialId,
        enrolledClasses: user.enrolledClasses,
        subscriptionStatus: user.subscriptionStatus,
        trialEndDate: user.trialEndDate,
        subscriptionEndDate: user.subscriptionEndDate,
        defaultPricingType: user.defaultPricingType,
        profilePicture: user.profilePicture,
        bankDetails: user.bankDetails,
        payoutPreference: user.payoutPreference
      },
      trialExpired,
      subscriptionExpired,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to generate and send password reset OTP
const generateAndSendPasswordResetOTP = async (user) => {
  try {
    // Check if email is configured
    if (!isEmailConfigured()) {
      console.error('Email not configured: BREVO_API_KEY or BREVO_FROM_EMAIL missing');
      if (process.env.NODE_ENV === 'development') {
        const otp = crypto.randomInt(100000, 999999).toString();
        console.log(`Password Reset OTP for ${user.email}: ${otp}`);
      }
      return;
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    user.passwordResetOTP = otp;
    user.passwordResetOTPExpires = Date.now() + 3600000; // OTP expires in 1 hour
    await user.save();

    console.log(`Attempting to send password reset OTP email to ${user.email} via Brevo...`);

    const result = await sendEmail({
      to: user.email,
      name: user.name,
      subject: 'Password Reset OTP',
      html: `
        <h2 style="color: #4f46e5;">Password Reset Request</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>We received a request to reset your password. Use the code below to proceed:</p>
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 8px; margin: 25px 0;">
          <h1 style="letter-spacing: 5px; color: #4f46e5; margin: 0; font-size: 32px;">${user.passwordResetOTP}</h1>
        </div>
        <p>This code is valid for 1 hour. If you did not request this, you can safely ignore this email.</p>
        <a href="${process.env.FRONTEND_URL}/reset-password?email=${user.email}" 
           style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; font-weight: bold;">
          Reset Password
        </a>
      `
    });

    console.log(`Password reset OTP email sent successfully to ${user.email} via Brevo. Message ID: ${result.messageId || 'N/A'}`);
    return result;
  } catch (error) {
    console.error('Error sending password reset OTP email via Brevo:', error.message);
    console.error('Error details:', {
      statusCode: error.statusCode,
      response: error.response?.body,
      message: error.message
    });
    throw error;
  }
};

// Forgot Password - Request OTP
router.post('/forgot-password', async (req, res) => {
  try {
    let { email } = req.body;
    email = email.toLowerCase();

    const user = await User.findOne({ email });

    // Only send OTP if user exists (don't reveal if user exists or not for security)
    if (user) {
      // Send response immediately, then send email in background
      res.json({
        message: 'If an account exists with this email, a password reset OTP has been sent.',
        email: email // Return email for frontend to use in next step
      });

      // Generate and send password reset OTP asynchronously
      generateAndSendPasswordResetOTP(user).catch(err => {
        console.error('Error sending password reset OTP email:', err.message);
      });
    } else {
      // Still return success message (don't reveal user doesn't exist)
      res.json({
        message: 'If an account exists with this email, a password reset OTP has been sent.',
        email: email
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: error.message || 'Failed to process password reset request' });
  }
});

// Verify Password Reset OTP
router.post('/verify-reset-otp', async (req, res) => {
  try {
    let { email, otp } = req.body;
    email = email.toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.passwordResetOTP || user.passwordResetOTP !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (user.passwordResetOTPExpires && user.passwordResetOTPExpires < Date.now()) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // OTP is valid - return success (don't clear OTP yet, wait for password reset)
    res.json({
      message: 'OTP verified successfully. You can now reset your password.',
      verified: true
    });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({ message: error.message || 'Failed to verify OTP' });
  }
});

// Resend Password Reset OTP
router.post('/resend-reset-otp', async (req, res) => {
  try {
    let { email } = req.body;
    email = email.toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({ message: 'If an account exists with this email, a password reset OTP has been sent.' });
    }

    // Send response immediately, then send email in background
    res.json({ message: 'Password reset OTP sent to your email' });

    generateAndSendPasswordResetOTP(user).catch(err => {
      console.error('Error sending password reset OTP email:', err.message);
    });
  } catch (error) {
    console.error('Resend reset OTP error:', error);
    res.status(500).json({ message: error.message || 'Failed to resend OTP' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    let { email, otp, newPassword } = req.body;
    email = email.toLowerCase();

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify OTP
    if (!user.passwordResetOTP || user.passwordResetOTP !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (user.passwordResetOTPExpires && user.passwordResetOTPExpires < Date.now()) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Reset password
    user.password = newPassword; // Will be hashed by pre-save hook
    user.isVerified = true;
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpires = undefined;
    await user.save();

    res.json({
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: error.message || 'Failed to reset password' });
  }
});

// Test email configuration endpoint (for debugging) - Using Brevo
router.post('/test-email', async (req, res) => {
  try {
    if (!isEmailConfigured()) {
      return res.status(400).json({
        message: 'Email not configured',
        details: {
          BREVO_API_KEY: process.env.BREVO_API_KEY ? 'set' : 'not set',
          BREVO_FROM_EMAIL: process.env.BREVO_FROM_EMAIL || process.env.BREVO_SENDER_EMAIL || 'not set'
        }
      });
    }

    const testEmail = req.body.email || process.env.BREVO_FROM_EMAIL || process.env.BREVO_SENDER_EMAIL;

    console.log(`Testing email configuration - sending test email to ${testEmail} via Brevo...`);

    const result = await sendEmail({
      to: testEmail,
      subject: 'Test Email from LMS',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from your LMS backend.</p>
        <p>If you received this, your branded email configuration is working correctly!</p>
      `
    });

    res.json({
      message: 'Test email sent successfully via Brevo',
      messageId: result.messageId || 'N/A',
      to: testEmail
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      message: 'Failed to send test email',
      error: error.message,
      details: {
        statusCode: error.statusCode,
        response: error.response?.body
      }
    });
  }
});


// ========== OLD NODEMAILER TEST ENDPOINT (COMMENTED OUT) ==========
// // Test email configuration endpoint (for debugging) - Old nodemailer version
// router.post('/test-email', async (req, res) => {
//   try {
//     if (!isEmailConfigured()) {
//       return res.status(400).json({ 
//         message: 'Email not configured',
//         details: {
//           SMTP_HOST: process.env.SMTP_HOST || 'not set',
//           SMTP_PORT: process.env.SMTP_PORT || 'not set',
//           SMTP_USER: process.env.SMTP_USER ? 'set' : 'not set',
//           SMTP_PASS: process.env.SMTP_PASS ? 'set' : 'not set'
//         }
//       });
//     }
//
//     const testEmail = req.body.email || process.env.SMTP_USER;
//     
//     console.log(`Testing email configuration - sending test email to ${testEmail}...`);
//     
//     const info = await transporter.sendMail({
//       from: process.env.SMTP_USER,
//       to: testEmail,
//       subject: 'Test Email from LMS',
//       html: `
//         <h2>Test Email</h2>
//         <p>This is a test email from your LMS backend.</p>
//         <p>If you received this, your email configuration is working correctly!</p>
//       `
//     });
//
//     res.json({ 
//       message: 'Test email sent successfully',
//       messageId: info.messageId,
//       to: testEmail
//     });
//   } catch (error) {
//     console.error('Test email error:', error);
//     res.status(500).json({ 
//       message: 'Failed to send test email',
//       error: error.message,
//       details: {
//         code: error.code,
//         command: error.command,
//         response: error.response
//       }
//     });
//   }
// });
// ==========================================================

// ==========================================================

// Set password for invited users
router.post('/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    // Find user with valid invite token
    const user = await User.findOne({
      inviteToken: token,
      inviteTokenExpires: { $gt: Date.now() },
      isPendingInvite: true
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired invite link' });
    }

    // Set the new password
    user.password = password;
    user.inviteToken = null;
    user.inviteTokenExpires = null;
    user.isPendingInvite = false;
    user.isVerified = true;

    await user.save();

    // Generate JWT token for automatic login
    const jwtToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Password set successfully',
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Verify invite token (check if token is valid before showing set password form)
router.get('/verify-invite/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      inviteToken: req.params.token,
      inviteTokenExpires: { $gt: Date.now() },
      isPendingInvite: true
    }).select('name email role');

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired invite link' });
    }

    res.json({
      valid: true,
      user: {
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update profile settings
router.put('/profile', auth, async (req, res) => {
  try {
    const {
      name,
      defaultPricingType,
      bankName,
      bankCode,
      accountNumber,
      accountName,
      payoutFrequency,
      paystackRecipientCode,
      profilePicture,
      schoolLogoUrl, // Expected if school admin wants to change logo
      tutorialLogoUrl, // Expected if personal teacher wants to change logo
      currentPassword,
      newPassword,
      confirmNewPassword
    } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 1. Password Change Logic
    if (newPassword || currentPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required.' });
      }
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect current password.' });
      }

      if (newPassword) {
        if (newPassword !== confirmNewPassword) {
          return res.status(400).json({ message: 'New passwords do not match.' });
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ message: 'Password must be at least 6 characters.' });
        }
        user.password = newPassword; // Will be hashed by pre-save hook
      }
    }

    // 2. Profile Updates
    if (name) user.name = name;
    if (defaultPricingType) user.defaultPricingType = defaultPricingType;
    if (profilePicture) user.profilePicture = profilePicture;

    // 3. Bank Details
    if (bankName || bankCode || accountNumber || accountName || paystackRecipientCode) {
      user.bankDetails = {
        ...user.bankDetails,
        ...(bankName && { bankName }),
        ...(bankCode && { bankCode }),
        ...(accountNumber && { accountNumber }),
        ...(accountName && { accountName }),
        ...(paystackRecipientCode && { paystackRecipientCode })
      };
    }

    // 4. Payout Preference
    if (payoutFrequency) {
      if (!user.payoutPreference) user.payoutPreference = {};
      user.payoutPreference.frequency = payoutFrequency;
    }

    // 5. School/Tutorial Logo Updates
    if (schoolLogoUrl && user.role === 'school_admin' && user.schoolId && user.schoolId.length > 0) {
      // Update all schools managed by this admin (or specific one if passed, but keeping it simple)
      await School.updateMany(
        { _id: { $in: user.schoolId } },
        { $set: { logoUrl: schoolLogoUrl } }
      );
      user.profilePicture = schoolLogoUrl; // Sync school logo with profile picture
    }

    if (tutorialLogoUrl && user.role === 'personal_teacher' && user.tutorialId) {
      await Tutorial.findByIdAndUpdate(user.tutorialId, { logoUrl: tutorialLogoUrl });
      user.profilePicture = tutorialLogoUrl; // Sync tutorial logo with profile picture
    }

    await user.save();

    // Explicitly populate for the response so frontend UI (logos, etc.) updates immediately
    await user.populate([
      { path: 'schoolId', select: 'name logoUrl' },
      { path: 'tutorialId', select: 'name logoUrl' }
    ]);

    // Return full user object (excluding password)
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.otp;

    // If we updated logos, we might want to refetch school/tutorial to return updated data if user object contains populated fields,
    // but typically user obj just has IDs. The frontend will have to handle the school logo update separately or we return it.
    // For now, let's just return the user. The logo URL for school/tutorial isn't directly on user (except maybe if we synced it, which we don't).

    res.json({
      message: 'Profile updated successfully',
      user: userObj
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;

