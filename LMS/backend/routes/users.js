const express = require('express');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const subscriptionCheck = require('../middleware/subscriptionCheck');
const crypto = require('crypto');
const { sendEmail } = require('../utils/email');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const router = express.Router();

// Configure multer for CSV upload
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Get all users (Root Admin, School Admin, Personal Teacher)
router.get('/', auth, authorize('root_admin', 'school_admin', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    let query = {};

    const { schoolId, role } = req.query;

    if (schoolId) {
      query.schoolId = schoolId;
    }

    if (role) {
      const rolesArray = role.split(',').map(r => r.trim());
      query.role = { $in: rolesArray };
    }

    if (req.user.role === 'root_admin') {
      // No additional filter
    }
    else if (req.user.role === 'school_admin') {
      const School = require('../models/School');
      const adminSchools = await School.find({ adminId: req.user._id }).select('_id');
      const adminSchoolIds = adminSchools.map(s => s._id);

      if (req.query.schoolId) {
        const requestedSchoolId = req.query.schoolId;
        if (adminSchoolIds.some(id => id.toString() === requestedSchoolId.toString())) {
          query.schoolId = requestedSchoolId;
        } else {
          query._id = null;
        }
      } else {
        if (adminSchoolIds.length > 0) {
          query.schoolId = { $in: adminSchoolIds };
        } else {
          query._id = null;
        }
      }

      if (!query.role) {
        query.role = { $in: ['teacher', 'student'] };
      }
    }
    else if (req.user.role === 'personal_teacher') {
      query.role = 'student';
    }

    const users = await User.find(query).select('-password').populate('schoolId', 'name');
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create user (Root Admin, School Admin)
router.post('/', auth, authorize('root_admin', 'school_admin'), async (req, res) => {
  try {
    const { name, email, password, role, schoolId } = req.body;

    if (req.user.role === 'root_admin') {
      if (role === 'root_admin') {
        return res.status(403).json({ message: 'Creating root_admin users is not allowed.' });
      }
    }
    else if (req.user.role === 'school_admin') {
      if (!['teacher', 'student'].includes(role)) {
        return res.status(403).json({ message: 'School admin can only create teachers and students' });
      }
    }

    let finalSchoolId = schoolId;
    // Normalize schoolId to array if it's stringified JSON
    if (typeof schoolId === 'string' && schoolId.startsWith('[')) {
      try {
        finalSchoolId = JSON.parse(schoolId);
      } catch (e) {
        finalSchoolId = [schoolId];
      }
    } else if (schoolId && !Array.isArray(schoolId)) {
      finalSchoolId = [schoolId];
    }

    if (req.user.role === 'school_admin') {
      if (finalSchoolId && finalSchoolId.length > 0) {
        const School = require('../models/School');
        const schools = await School.find({
          _id: { $in: finalSchoolId },
          adminId: req.user._id
        });

        if (schools.length !== finalSchoolId.length) {
          return res.status(403).json({ message: 'You can only assign users to your assigned schools' });
        }
      } else {
        return res.status(400).json({ message: 'School ID is required. Please select a school from the dropdown.' });
      }
    }

    const user = new User({
      name,
      email,
      password,
      role,
      schoolId: finalSchoolId,
      createdBy: req.user._id
    });

    await user.save();
    res.status(201).json({
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

// Bulk CSV upload with invite links
router.post('/bulk-invite', auth, authorize('root_admin', 'school_admin'), upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }


    const { role, schoolId } = req.body;
    const results = [];
    const errors = [];

    // Validate school access for school admin
    let finalSchoolId = schoolId;
    // Normalize schoolId to array if it's stringified JSON
    if (typeof schoolId === 'string' && schoolId.startsWith('[')) {
      try {
        finalSchoolId = JSON.parse(schoolId);
      } catch (e) {
        finalSchoolId = [schoolId];
      }
    } else if (schoolId && !Array.isArray(schoolId)) {
      finalSchoolId = [schoolId];
    }

    if (req.user.role === 'school_admin') {
      // School ID is only required if CSV doesn't have schoolIds column
      // We'll validate per-user schools later when processing CSV
      if (finalSchoolId && finalSchoolId.length > 0) {
        const School = require('../models/School');
        const schools = await School.find({
          _id: { $in: finalSchoolId },
          adminId: req.user._id
        });

        if (schools.length !== finalSchoolId.length) {
          fs.unlinkSync(req.file.path);
          return res.status(403).json({ message: 'You can only assign users to your assigned schools' });
        }
      }
    }

    // Parse CSV
    const users = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => {
        users.push(row);
      })
      .on('end', async () => {
        try {
          for (let i = 0; i < users.length; i++) {
            const userData = users[i];
            const { name, email } = userData;

            if (!name || !email) {
              errors.push({ row: i + 1, email: email || 'N/A', error: 'Missing name or email' });
              continue;
            }

            // Check if user already exists
            const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
            if (existingUser) {
              errors.push({ row: i + 1, email, error: 'User already exists' });
              continue;
            }

            // Generate invite token
            const inviteToken = crypto.randomBytes(32).toString('hex');
            const inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days


            // Determine school IDs for this user
            let userSchoolIds = finalSchoolId;

            // If CSV has schoolIds column, use that instead
            if (userData.schoolIds && userData.schoolIds.trim()) {
              const csvSchoolIds = userData.schoolIds.split(';').map(id => id.trim()).filter(id => id);
              if (csvSchoolIds.length > 0) {
                userSchoolIds = csvSchoolIds;
              }
            }

            // Validate students must have at least one school
            const userRole = userData.role || role || 'student';
            if (userRole === 'student') {
              if (!userSchoolIds || (Array.isArray(userSchoolIds) && userSchoolIds.length === 0)) {
                errors.push({ row: i + 1, email, error: 'Students must belong to at least one school' });
                continue;
              }
            }

            // For school_admin, validate they can only assign to their schools
            if (req.user.role === 'school_admin' && userSchoolIds) {
              const School = require('../models/School');
              const adminSchools = await School.find({ adminId: req.user._id }).select('_id');
              const adminSchoolIds = adminSchools.map(s => s._id.toString());

              const schoolIdsToCheck = Array.isArray(userSchoolIds) ? userSchoolIds : [userSchoolIds];
              const invalidSchools = schoolIdsToCheck.filter(id => !adminSchoolIds.includes(id.toString()));

              if (invalidSchools.length > 0) {
                errors.push({ row: i + 1, email, error: 'You can only assign users to your assigned schools' });
                continue;
              }
            }

            // Create user with pending invite
            const newUser = new User({
              name: name.trim(),
              email: email.toLowerCase().trim(),
              password: crypto.randomBytes(16).toString('hex'), // Temporary password
              role: userRole,
              schoolId: userSchoolIds,
              createdBy: req.user._id,
              inviteToken,
              inviteTokenExpires,
              isPendingInvite: true,
              isVerified: false
            });

            await newUser.save();

            // Send invite email
            const inviteLink = `${process.env.FRONTEND_URL}/set-password?token=${inviteToken}`;

            try {
              await sendEmail({
                to: newUser.email,
                subject: 'Welcome to Gracified LMS - Set Your Password',
                html: `
                  <h2>Welcome to Gracified LMS!</h2>
                  <p>Hello ${newUser.name},</p>
                  <p>You have been invited to join Gracified LMS as a ${newUser.role}.</p>
                  <p>Please click the link below to set your password and activate your account:</p>
                  <p><a href="${inviteLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Set Your Password</a></p>
                  <p>Or copy and paste this link in your browser:</p>
                  <p>${inviteLink}</p>
                  <p>This link will expire in 7 days.</p>
                  <p>Best regards,<br>Gracified LMS Team</p>
                `
              });

              results.push({ row: i + 1, name, email, status: 'success' });
            } catch (emailError) {
              console.error('Email send error:', emailError);
              results.push({ row: i + 1, name, email, status: 'created_but_email_failed' });
            }
          }

          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          res.json({
            message: `Processed ${users.length} users`,
            successful: results.length,
            failed: errors.length,
            results,
            errors
          });
        } catch (processingError) {
          fs.unlinkSync(req.file.path);
          res.status(500).json({ message: processingError.message });
        }
      })
      .on('error', (error) => {
        fs.unlinkSync(req.file.path);
        res.status(500).json({ message: 'Error parsing CSV: ' + error.message });
      });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message });
  }
});

// Update user
router.put('/:id', auth, authorize('root_admin', 'school_admin'), async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user.role === 'root_admin') {
      if (req.body.role === 'root_admin' && targetUser.role !== 'root_admin') {
        return res.status(403).json({ message: 'Cannot elevate a user to root_admin.' });
      }
    } else if (req.user.role === 'school_admin') {
      if (targetUser.schoolId?.toString() !== req.user.schoolId?.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (req.body.role && !['teacher', 'student'].includes(req.body.role)) {
        return res.status(403).json({ message: 'Cannot change to this role' });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete user (Root Admin, School Admin for their own users)
router.delete('/:id', auth, authorize('root_admin', 'school_admin'), async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Permission check
    if (req.user.role === 'school_admin') {
      if (!targetUser.createdBy || targetUser.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied: You can only delete users you created.' });
      }
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get students for a teacher
router.get('/my-students', auth, authorize('teacher', 'personal_teacher'), async (req, res) => {
  try {
    const Classroom = require('../models/Classroom');
    const classrooms = await Classroom.find({ teacherId: req.user._id })
      .populate('students', 'name email enrolledClasses')
      .select('name students');

    const studentMap = new Map();
    classrooms.forEach(classroom => {
      classroom.students.forEach(student => {
        if (!studentMap.has(student._id.toString())) {
          studentMap.set(student._id.toString(), student);
        }
      });
    });

    const students = Array.from(studentMap.values());
    res.json({ students });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
