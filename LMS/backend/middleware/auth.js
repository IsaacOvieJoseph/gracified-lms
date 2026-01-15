const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    console.log('Auth middleware: Attempting to authenticate request.');
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      console.log('Auth middleware: No token found. Returning 401.');
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    console.log('Auth middleware: Token received. Attempting to verify...');
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({ message: 'Internal server error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Auth middleware: Token decoded. Decoded userId:', decoded.userId);

    const user = await User.findById(decoded.userId);

    if (!user) {
      console.log('Auth middleware: User not found for decoded token. Returning 401.');
      return res.status(401).json({ message: 'Token is invalid, user not found' });
    }

    // Check if user is verified (if email verification is enabled)
    // Root admin bypasses verification check
    if (!user.isVerified && user.role !== 'root_admin') {
      console.log('Auth middleware: User is not verified. Returning 401.');
      return res.status(401).json({ message: 'Email not verified, please verify your email' });
    }

    console.log('Auth middleware: User authenticated and verified. User role:', user.role);
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth middleware: Authentication error:', error.message);
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

