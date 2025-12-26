const express = require('express');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const subscriptionCheck = require('../middleware/subscriptionCheck'); // Import subscriptionCheck middleware
const router = express.Router();

// Get all users (Root Admin, School Admin, Personal Teacher)
router.get('/', auth, authorize('root_admin', 'school_admin', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    let query = {};

    const { schoolId, role } = req.query; // Extract schoolId and role from query parameters

    // If schoolId is provided in query, filter by it
    if (schoolId) {
      query.schoolId = schoolId;
    }

    // If role is provided in query (e.g., "teacher,personal_teacher"), filter by it
    if (role) {
      const rolesArray = role.split(',').map(r => r.trim());
      query.role = { $in: rolesArray };
    }
    
    // Root Admin sees all users (unless specific query filters are applied)
    if (req.user.role === 'root_admin') {
      // No additional filter needed based on req.user.role, query is already built from req.query
    }
    // School Admin can only see teachers and students from their school (and only their schoolId if not provided in query)
    else if (req.user.role === 'school_admin') {
      // Ensure school admin can only view users within their school, overriding query if present
      // Use $in to match users whose schoolId array contains any of the admin's schoolIds
      if (Array.isArray(req.user.schoolId) && req.user.schoolId.length > 0) {
        query.schoolId = { $in: req.user.schoolId };
      } else if (req.user.schoolId) {
        // Handle case where schoolId might be a single value
        query.schoolId = req.user.schoolId;
      }
      if (!query.role) { // If role not specified in query, default to teachers/students
        query.role = { $in: ['teacher', 'student'] };
      }
    }
    // Personal Teacher can see all students (for adding to their classes)
    else if (req.user.role === 'personal_teacher') {
      query.role = 'student';
    }

    const users = await User.find(query).select('-password');
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

    // Root Admin can create any user
    if (req.user.role === 'root_admin') {
      // Can create any role
    }
    // School Admin can only create teachers and students for their school
    else if (req.user.role === 'school_admin') {
      if (!['teacher', 'student'].includes(role)) {
        return res.status(403).json({ message: 'School admin can only create teachers and students' });
      }
    }

    // School Admin can only create users for their school
    const finalSchoolId = req.user.role === 'school_admin' 
      ? req.user.schoolId 
      : schoolId;

    const user = new User({
      name,
      email,
      password,
      role,
      schoolId: finalSchoolId
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

// Update user
router.put('/:id', auth, authorize('root_admin', 'school_admin'), async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check permissions
    if (req.user.role === 'school_admin') {
      // School admin can only update users from their school
      if (targetUser.schoolId?.toString() !== req.user.schoolId?.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
      // Cannot update to roles other than teacher/student
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

// Delete user (Root Admin only)
router.delete('/:id', auth, authorize('root_admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get students for a teacher (Teachers can see their students)
router.get('/my-students', auth, authorize('teacher', 'personal_teacher'), async (req, res) => {
  try {
    const Classroom = require('../models/Classroom');
    const classrooms = await Classroom.find({ teacherId: req.user._id })
      .populate('students', 'name email enrolledClasses')
      .select('name students');
    
    // Get unique students from all classrooms
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

