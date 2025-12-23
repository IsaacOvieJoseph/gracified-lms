const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const School = require('../models/School'); // Import School model
const SubscriptionPlan = require('../models/SubscriptionPlan'); // Import SubscriptionPlan model
const Tutorial = require('../models/Tutorial'); // Import Tutorial model
const { auth } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const router = express.Router();

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verify email configuration
const isEmailConfigured = () => {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
};

// Helper function to generate and send OTP
const generateAndSendOTP = async (user) => {
  try {
    // Check if email is configured
    if (!isEmailConfigured()) {
      console.error('Email not configured: SMTP_USER or SMTP_PASS missing');
      console.log(`OTP for ${user.email}: ${crypto.randomInt(100000, 999999).toString()}`);
      return;
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 3600000; // OTP expires in 1 hour
    await user.save();

    console.log(`Attempting to send OTP email to ${user.email}...`);
    
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: user.email,
      subject: 'Email Verification OTP',
      html: `
        <h2>Email Verification</h2>
        <p>Hello ${user.name},</p>
        <p>Your OTP for email verification is: <strong>${otp}</strong></p>
        <p>This OTP is valid for 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`OTP email sent successfully to ${user.email}. Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Error sending OTP email:', error.message);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    
    // Log OTP in console for development/debugging
    console.log(`OTP for ${user.email} (email failed): ${user.otp || 'not generated'}`);
    throw error; // Re-throw so caller can handle it
  }
};

// Register
router.post('/register', async (req, res) => {
  try {
    let { name, email, password, role, schoolName, tutorialName } = req.body;
    email = email.toLowerCase();

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

    const user = new User({ name, email, password, role, isVerified: false });
    await user.save();

    if (role === 'school_admin') {
      const school = new School({ name: schoolName, adminId: user._id });
      await school.save();
      user.schoolId.push(school._id); // Push into array
    } else if (role === 'personal_teacher') {
      const tutorial = new Tutorial({ name: tutorialName, teacherId: user._id });
      await tutorial.save();
      user.tutorialId = tutorial._id;
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
        tutorialId: user.tutorialId
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
    if ((user.role === 'school_admin' || user.role === 'personal_teacher') && user.subscriptionStatus === 'trial') {
      if (user.trialEndDate && user.trialEndDate < Date.now()) {
        trialExpired = true;
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
      },
      trialExpired,
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
      .populate('schoolId', 'name') // Populate school name
      .populate('tutorialId', 'name'); // Populate tutorial name
    
    // Check subscription status for School Admin and Personal Teacher
    let trialExpired = false;
    if ((user.role === 'school_admin' || user.role === 'personal_teacher') && user.subscriptionStatus === 'trial') {
      if (user.trialEndDate && user.trialEndDate < Date.now()) {
        trialExpired = true;
      }
    }

    res.json({
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
      },
      trialExpired,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Test email configuration endpoint (for debugging)
router.post('/test-email', async (req, res) => {
  try {
    if (!isEmailConfigured()) {
      return res.status(400).json({ 
        message: 'Email not configured',
        details: {
          SMTP_HOST: process.env.SMTP_HOST || 'not set',
          SMTP_PORT: process.env.SMTP_PORT || 'not set',
          SMTP_USER: process.env.SMTP_USER ? 'set' : 'not set',
          SMTP_PASS: process.env.SMTP_PASS ? 'set' : 'not set'
        }
      });
    }

    const testEmail = req.body.email || process.env.SMTP_USER;
    
    console.log(`Testing email configuration - sending test email to ${testEmail}...`);
    
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: testEmail,
      subject: 'Test Email from LMS',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from your LMS backend.</p>
        <p>If you received this, your email configuration is working correctly!</p>
      `
    });

    res.json({ 
      message: 'Test email sent successfully',
      messageId: info.messageId,
      to: testEmail
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      message: 'Failed to send test email',
      error: error.message,
      details: {
        code: error.code,
        command: error.command,
        response: error.response
      }
    });
  }
});

module.exports = router;

