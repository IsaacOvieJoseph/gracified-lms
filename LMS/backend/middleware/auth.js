const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({ message: 'Internal server error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).populate('subscriptionPlan');

    if (!user) {
      return res.status(401).json({ message: 'Token is invalid, user not found' });
    }

    if (!user.isVerified && user.role !== 'root_admin') {
      return res.status(401).json({ message: 'Email not verified, please verify your email' });
    }

    req.user = user;
    req.token = token;

    // Track last active time (throttled to avoid write on every request)
    try {
      const now = Date.now();
      const last = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
      const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
      if (!last || now - last >= THROTTLE_MS) {
        user.lastActiveAt = new Date(now);
        // Save without blocking request latency too much
        user.save().catch(() => { });
      }
    } catch (_) { }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    // Root admin has access to everything
    if (req.user.role === 'root_admin') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource' });
    }
    next();
  };
};

module.exports = { auth, authorize };

