const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'school_admin', 'personal_teacher', 'root_admin'],
    default: 'student',
  },
  schoolId: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
  }], // Changed to array to allow multiple schools for an admin
  tutorialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutorial' },
  enrolledClasses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
  }],
  otp: String, // Field for storing OTP (email verification)
  otpExpires: Date, // Field for OTP expiry time (email verification)
  passwordResetOTP: String, // Field for storing password reset OTP
  passwordResetOTPExpires: Date, // Field for password reset OTP expiry time
  isVerified: {
    type: Boolean,
    default: false, // Default to false, user needs to verify email
  },
  // New fields for subscriptions
  subscriptionPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    default: null,
  },
  subscriptionStatus: {
    type: String,
    enum: ['none', 'trial', 'active', 'canceled', 'expired', 'pay_as_you_go'],
    default: 'none', // Default to 'none' for users without an active subscription
  },
  subscriptionStartDate: {
    type: Date,
    default: null,
  },
  subscriptionEndDate: {
    type: Date,
    default: null,
  },
  trialEndDate: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;

