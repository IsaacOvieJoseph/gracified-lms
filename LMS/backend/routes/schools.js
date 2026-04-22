const express = require('express');
const School = require('../models/School');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Create a school (root admin or school admin)
router.post('/', auth, authorize('root_admin', 'school_admin'), async (req, res) => {
  try {
    const User = require('../models/User');
    const { name, adminId: requestedAdminId } = req.body;
    let finalAdminId = req.user._id; // Default to current user for school_admin

    if (req.user.role === 'root_admin' && requestedAdminId) {
      finalAdminId = requestedAdminId; // Root admin can assign another admin
    }

    const school = new School({ name, adminId: finalAdminId });
    await school.save();

    // Update the admin's schoolId array to include the new school
    if (finalAdminId) {
      const admin = await User.findById(finalAdminId);
      if (admin) {
        // Ensure schoolId is an array
        if (!admin.schoolId) {
          admin.schoolId = [];
        } else if (!Array.isArray(admin.schoolId)) {
          admin.schoolId = [admin.schoolId];
        }

        // Add the new school ID if it's not already in the array
        const schoolIdString = school._id.toString();
        if (!admin.schoolId.some(id => id.toString() === schoolIdString)) {
          admin.schoolId.push(school._id);
          await admin.save();
        }
      }
    }

    return res.status(201).json({ message: 'School created successfully', school });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET PUBLIC SCHOOLS (For Registration lists)
router.get('/public', async (req, res) => {
  try {
    const schools = await School.find().select('_id name');
    res.json({ schools });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET PUBLIC SCHOOL BY IDENTIFIER (shortCode or ID)
router.get('/public/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const mongoose = require('mongoose');
    let school = await School.findOne({ shortCode: identifier });

    if (!school && mongoose.Types.ObjectId.isValid(identifier)) {
      school = await School.findById(identifier);
    }

    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    // Populate admin info and fetch classrooms
    const populatedSchool = await School.findById(school._id).populate('adminId', 'name email');
    const Classroom = require('../models/Classroom');
    const classrooms = await Classroom.find({ schoolId: school._id, published: true })
      .populate('teacherId', 'name')
      .select('name description subject level shortCode pricing isPaid');

    res.json({
      school: populatedSchool,
      classrooms
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET ALL SCHOOLS (Root Admin) or MY SCHOOL (School Admin)
router.get("/", auth, authorize('root_admin', 'school_admin'), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'school_admin') {
      // School admin should only see their own school
      query = { adminId: req.user._id };
    }

    const schools = await School.find(query)
      .populate("adminId", "name email") // admin fields
      .lean();

    // Format response
    const formatted = schools.map((s) => ({
      _id: s._id,
      name: s.name,
      shortCode: s.shortCode,
      admin: s.adminId
        ? { name: s.adminId.name, email: s.adminId.email }
        : null,
    }));

    res.json({ schools: formatted }); // Wrap in an object for consistency with other APIs
  } catch (error) {
    console.error("Error loading schools:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

// GET SCHOOL BY ID (Authorized)
router.get("/:id", auth, authorize('root_admin', 'school_admin'), async (req, res) => {
  try {
    let query = { _id: req.params.id };

    if (req.user.role === 'school_admin') {
      // School admin can only access their own school by ID
      query.adminId = req.user._id;
    }

    const s = await School.findOne(query)
      .populate("adminId", "name email");

    if (!s) return res.status(404).json({ message: "School not found or not authorized" });

    res.json({
      _id: s._id,
      name: s.name,
      admin: s.adminId, // Note: This is populated as an object
      shortCode: s.shortCode,
      createdAt: s.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error loading school" });
  }
});

// DELETE SCHOOL (Root Admin Only)
router.delete("/:id", auth, authorize('root_admin'), async (req, res) => {
  try {
    const deleted = await School.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "School not found" });

    res.json({ message: "School deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error deleting school" });
  }
});


module.exports = router;