const express = require('express');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const School = require('../models/School');
const Notification = require('../models/Notification'); // New import
const CallSession = require('../models/CallSession');
const { auth, authorize } = require('../middleware/auth');
const subscriptionCheck = require('../middleware/subscriptionCheck'); // Import subscriptionCheck middleware
const { filterClassroomsBySubscription, isClassroomOwnerSubscriptionValid } = require('../utils/subscriptionHelper');
const router = express.Router();

// Get all classrooms
router.get('/', auth, subscriptionCheck, async (req, res) => {
  try {
    let query = {};

    // Students see only published classes (enrolled or available for enrollment)
    if (req.user.role === 'student') {
      query = {
        published: true,
        $or: [
          { students: req.user._id }, // Already enrolled
          { students: { $ne: req.user._id } } // Available to enroll
        ]
      };
    }
    // Teachers see their own classes
    else if (req.user.role === 'teacher' || req.user.role === 'personal_teacher') {
      query = { teacherId: req.user._id };
    }
    // School Admin sees classes from their schools (all schools they admin)
    else if (req.user.role === 'school_admin') {
      // Get all schools where this admin is the adminId
      const School = require('../models/School');
      const adminSchools = await School.find({ adminId: req.user._id }).select('_id');
      const adminSchoolIds = adminSchools.map(s => s._id);
      if (adminSchoolIds.length > 0) {
        query = { schoolId: { $in: adminSchoolIds } };
      } else {
        // If admin has no schools, return empty result
        query = { _id: null }; // This will return no results
      }
    }

    let classrooms = await Classroom.find(query)
      .populate({
        path: 'teacherId',
        select: 'name email role subscriptionStatus trialEndDate tutorialId',
        populate: {
          path: 'tutorialId',
          select: 'name'
        }
      })
      .populate('students', 'name email')
      .populate('topics', 'name description')
      .populate({
        path: 'schoolId',
        select: 'name adminId',
        populate: {
          path: 'adminId',
          select: 'subscriptionStatus trialEndDate'
        }
      })
      .sort({ createdAt: -1 });

    // Filter out classrooms where owner's subscription has expired (except for teachers and students)
    classrooms = await filterClassroomsBySubscription(classrooms, req.user);

    res.json({ classrooms });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all active meetings for user's classrooms
router.get('/active-meetings', auth, async (req, res) => {
  try {
    let classroomQuery = {};
    if (req.user.role === 'student') {
      classroomQuery = { students: req.user._id, published: true };
    } else if (req.user.role === 'teacher' || req.user.role === 'personal_teacher') {
      classroomQuery = { teacherId: req.user._id };
    } else if (req.user.role === 'school_admin') {
      const adminSchools = await School.find({ adminId: req.user._id }).select('_id');
      classroomQuery = { schoolId: { $in: adminSchools.map(s => s._id) } };
    }

    const classrooms = await Classroom.find(classroomQuery).select('_id');
    const classroomIds = classrooms.map(c => c._id);

    const fortyFiveMinAgo = new Date(Date.now() - 45 * 60 * 1000);
    const activeSessions = await CallSession.find({
      classroomId: { $in: classroomIds },
      startedAt: { $gt: fortyFiveMinAgo }
    }).sort({ startedAt: -1 });

    res.json({ activeSessions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get classroom by ID
router.get('/:id', auth, subscriptionCheck, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id)
      .populate({
        path: 'teacherId',
        select: 'name email role subscriptionStatus trialEndDate tutorialId',
        populate: {
          path: 'tutorialId',
          select: 'name'
        }
      })
      .populate('students', 'name email')
      .populate('topics', 'name description materials')
      .populate({
        path: 'assignments',
        populate: [
          { path: 'topicId', select: 'name' }, // Populate topic details
          {
            path: 'submissions.studentId', // Populate student details within submissions
            select: 'name email'
          }
        ]
      })
      .populate({
        path: 'schoolId',
        select: 'name adminId',
        populate: {
          path: 'adminId',
          select: 'name email subscriptionStatus trialEndDate'
        }
      });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check if classroom owner's subscription is valid (skip check for teachers and students)
    if (req.user.role !== 'teacher' && req.user.role !== 'student') {
      const isOwnerSubscriptionValid = await isClassroomOwnerSubscriptionValid(classroom);
      if (!isOwnerSubscriptionValid) {
        return res.status(403).json({ message: 'This class is not available. The class owner\'s subscription has expired.', subscriptionExpired: true });
      }
    }

    // For teachers, allow access to their own classes regardless of subscription
    if (req.user.role === 'teacher') {
      const teacherId = classroom.teacherId._id || classroom.teacherId;
      if (teacherId.toString() !== req.user._id.toString()) {
        // Teacher trying to access someone else's class - check subscription
        const isOwnerSubscriptionValid = await isClassroomOwnerSubscriptionValid(classroom);
        if (!isOwnerSubscriptionValid) {
          return res.status(403).json({ message: 'This class is not available. The class owner\'s subscription has expired.', subscriptionExpired: true });
        }
      }
    }

    // For students, allow access to enrolled classes regardless of subscription
    if (req.user.role === 'student') {
      const isEnrolled = classroom.students.some(
        studentId => (studentId._id || studentId).toString() === req.user._id.toString()
      ) || req.user.enrolledClasses.some(
        classId => classId.toString() === classroom._id.toString()
      );
      //comment out
      //  if (!isEnrolled) {
      //    return res.status(403).json({ message: 'You are not enrolled in this class.', enrollmentRequired: true });
      //  }
    }

    // Teachers can see their own classrooms even if unpublished
    // Students can only see published classrooms
    if (req.user.role === 'student' && !classroom.published) {
      return res.status(403).json({ message: 'Classroom not available' });
    }

    res.json({ classroom });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create classroom
router.post('/', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    const {
      name,
      description,
      schedule,
      capacity,
      pricing,
      isPaid,
      teacherId,
      schoolId,
      published
    } = req.body;

    // Validate schedule array
    if (!Array.isArray(schedule)) {
      return res.status(400).json({ message: 'Schedule must be an array' });
    }

    for (const session of schedule) {
      if (!session.dayOfWeek || !session.startTime || !session.endTime) {
        return res.status(400).json({ message: 'Each schedule session must have dayOfWeek, startTime, and endTime' });
      }
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (!validDays.includes(session.dayOfWeek)) {
        return res.status(400).json({ message: `Invalid dayOfWeek: ${session.dayOfWeek}` });
      }
    }

    // Determine teacher ID
    let finalTeacherId = teacherId;
    if (req.user.role === 'teacher' || req.user.role === 'personal_teacher') {
      // Teachers can only create classes for themselves
      finalTeacherId = req.user._id;
    } else if (req.user.role === 'root_admin' || req.user.role === 'school_admin') {
      // Root admin and school admin can assign teachers
      if (!teacherId) {
        return res.status(400).json({ message: 'teacherId is required for admin users' });
      }
      // Verify teacher exists and belongs to school (if school admin)
      const teacher = await User.findById(teacherId);
      if (!teacher || !['teacher', 'personal_teacher'].includes(teacher.role)) {
        return res.status(400).json({ message: 'Invalid teacher ID' });
      }

      if (req.user.role === 'school_admin') {
        const managedSchools = await School.find({ adminId: req.user._id }).select('_id');
        const managedSchoolIds = managedSchools.map(s => s._id.toString());

        // Fetch teacher again to get fresh schoolId data
        const teacherToVerify = await User.findById(teacherId);
        const teacherSchoolIds = (Array.isArray(teacherToVerify?.schoolId) ? teacherToVerify.schoolId : [teacherToVerify?.schoolId])
          .filter(Boolean)
          .map(id => (id._id || id).toString());

        const hasAccess = teacherSchoolIds.some(sid => managedSchoolIds.includes(sid));

        if (!hasAccess && teacherToVerify?.role !== 'personal_teacher') {
          // One final check: if the teacher belongs to NO schools yet, but is assigned to this school's admin,
          // or if there's any other indicator of association. 
          // For now, let's just make the error message more descriptive if it fails.
          return res.status(403).json({
            message: 'Teacher must belong to one of your schools. Please check the teacher\'s profile and ensure they are assigned to your school.',
            adminSchoolCount: managedSchools.length,
            teacherSchoolCount: teacherSchoolIds.length
          });
        }
      }
      finalTeacherId = teacherId;
    }

    // Determine school ID
    let finalSchoolId = [];
    if (req.user.role === 'school_admin') {
      const School = require('../models/School');
      if (schoolId) {
        const requestedSchoolIds = Array.isArray(schoolId) ? schoolId : [schoolId];
        const validSchools = await School.find({
          _id: { $in: requestedSchoolIds },
          adminId: req.user._id
        }).select('_id');

        finalSchoolId = validSchools.map(s => s._id);
        if (finalSchoolId.length === 0) {
          return res.status(403).json({ message: 'You can only create classrooms for your assigned schools' });
        }
      } else {
        // Default to first school if none provided
        const firstSchool = await School.findOne({ adminId: req.user._id }).sort({ createdAt: 1 });
        if (firstSchool) {
          finalSchoolId = [firstSchool._id];
        }
      }
    } else if (req.user.role === 'teacher') {
      finalSchoolId = Array.isArray(req.user.schoolId) ? req.user.schoolId : (req.user.schoolId ? [req.user.schoolId] : []);
    } else if (req.user.role === 'personal_teacher') {
      finalSchoolId = [];
    } else if (req.user.role === 'root_admin') {
      if (teacherId) {
        const assignedTeacher = await User.findById(teacherId);
        if (assignedTeacher && assignedTeacher.role === 'teacher') {
          finalSchoolId = Array.isArray(assignedTeacher.schoolId) ? assignedTeacher.schoolId : (assignedTeacher.schoolId ? [assignedTeacher.schoolId] : []);
        } else if (schoolId) {
          finalSchoolId = Array.isArray(schoolId) ? schoolId : [schoolId];
        }
      } else if (schoolId) {
        finalSchoolId = Array.isArray(schoolId) ? schoolId : [schoolId];
      }
    }

    const classroom = new Classroom({
      name,
      description,
      schedule,
      capacity,
      pricing: pricing || { type: 'per_class', amount: 0 },
      isPaid: (isPaid && pricing?.amount > 0) ? true : false,
      teacherId: finalTeacherId,
      schoolId: finalSchoolId,
      published: published !== undefined ? published : false
    });

    await classroom.save();
    await classroom.populate('teacherId', 'name email');

    // Notify School Admin if a class is created in their school
    if (classroom.schoolId) {
      try {
        const school = await School.findById(classroom.schoolId);
        if (school && school.adminId) {
          await Notification.create({
            userId: school.adminId,
            message: `A new class "${classroom.name}" has been created by ${req.user.name} in your school and is awaiting review.`,
            type: 'new_class_created',
            entityId: classroom._id,
            entityRef: 'Classroom',
          });
        }
      } catch (notificationError) {
        console.error('Error creating in-app notification for school admin on class creation:', notificationError.message);
      }
    }

    res.status(201).json({ classroom });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update classroom
router.put('/:id', auth, subscriptionCheck, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check managed schools for school admin
    let hasAccess = false;
    if (req.user.role === 'school_admin') {
      const managedSchools = await School.find({ adminId: req.user._id }).select('_id');
      const managedSchoolIds = managedSchools.map(s => s._id.toString());
      const classSchoolIds = Array.isArray(classroom.schoolId)
        ? classroom.schoolId.map(sid => sid.toString())
        : (classroom.schoolId ? [classroom.schoolId.toString()] : []);

      hasAccess = classSchoolIds.some(sid => managedSchoolIds.includes(sid));
    }

    const canEdit =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && hasAccess) ||
      (req.user.role === 'teacher' && classroom.teacherId.toString() === req.user._id.toString()) ||
      (req.user.role === 'personal_teacher' && classroom.teacherId.toString() === req.user._id.toString()) ||
      (!classroom.published && ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(req.user.role));

    if (!canEdit) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, description, schedule, capacity, pricing, isPaid, teacherId, schoolId, published } = req.body;

    if (name) classroom.name = name;
    if (description) classroom.description = description;
    if (capacity) classroom.capacity = capacity;
    if (pricing) classroom.pricing = pricing;
    if (isPaid !== undefined || pricing) {
      // Re-evaluate isPaid if either isPaid or pricing is provided
      const newIsPaid = isPaid !== undefined ? isPaid : classroom.isPaid;
      const newAmount = pricing ? pricing.amount : (classroom.pricing ? classroom.pricing.amount : 0);
      classroom.isPaid = !!(newIsPaid && newAmount > 0);
    }
    if (teacherId) classroom.teacherId = teacherId; // Further authorization/validation might be needed here
    if (schoolId) classroom.schoolId = schoolId; // Further authorization/validation might be needed here
    if (published !== undefined) classroom.published = published;

    // Handle schedule update with validation
    if (schedule) {
      if (!Array.isArray(schedule)) {
        return res.status(400).json({ message: 'Schedule must be an array' });
      }
      for (const session of schedule) {
        if (!session.dayOfWeek || !session.startTime || !session.endTime) {
          return res.status(400).json({ message: 'Each schedule session must have dayOfWeek, startTime, and endTime' });
        }
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        if (!validDays.includes(session.dayOfWeek)) {
          return res.status(400).json({ message: `Invalid dayOfWeek: ${session.dayOfWeek}` });
        }
      }
      classroom.schedule = schedule;
    }







    Object.assign(classroom, req.body);
    classroom.updatedAt = Date.now();
    await classroom.save();

    await classroom.populate('teacherId', 'name email');
    res.json({ classroom });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete classroom
router.delete('/:id', auth, subscriptionCheck, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check managed schools for school admin
    let hasAccess = false;
    if (req.user.role === 'school_admin') {
      const managedSchools = await School.find({ adminId: req.user._id }).select('_id');
      const managedSchoolIds = managedSchools.map(s => s._id.toString());
      const classSchoolIds = Array.isArray(classroom.schoolId)
        ? classroom.schoolId.map(sid => sid.toString())
        : (classroom.schoolId ? [classroom.schoolId.toString()] : []);

      hasAccess = classSchoolIds.some(sid => managedSchoolIds.includes(sid));
    }

    const canDelete =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && hasAccess) ||
      (req.user.role === 'teacher' && classroom.teacherId.toString() === req.user._id.toString()) ||
      (req.user.role === 'personal_teacher' && classroom.teacherId.toString() === req.user._id.toString());

    if (!canDelete) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Classroom.findByIdAndDelete(req.params.id);
    res.json({ message: 'Classroom deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Publish/Unpublish classroom
router.put('/:id/publish', auth, authorize('root_admin', 'school_admin', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check managed schools for school admin
    let hasAccess = false;
    if (req.user.role === 'school_admin') {
      const managedSchools = await School.find({ adminId: req.user._id }).select('_id');
      const managedSchoolIds = managedSchools.map(s => s._id.toString());
      const classSchoolIds = Array.isArray(classroom.schoolId)
        ? classroom.schoolId.map(sid => sid.toString())
        : (classroom.schoolId ? [classroom.schoolId.toString()] : []);

      hasAccess = classSchoolIds.some(sid => managedSchoolIds.includes(sid));
    }

    const canPublish =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && hasAccess) ||
      (req.user.role === 'personal_teacher' && classroom.teacherId.toString() === req.user._id.toString());

    if (!canPublish) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { published } = req.body;
    classroom.published = published !== undefined ? published : !classroom.published;
    classroom.updatedAt = Date.now();
    await classroom.save();

    // Send notifications if the class is being published
    if (published) {
      try {
        // Notify the teacher
        await Notification.create({
          userId: classroom.teacherId,
          message: `Your class "${classroom.name}" has been published by the school admin!`,
          type: 'class_published',
          entityId: classroom._id,
          entityRef: 'Classroom',
        });

        // Notify all enrolled students (if any)
        if (classroom.students && classroom.students.length > 0) {
          const studentNotifications = classroom.students.map(studentId => ({
            userId: studentId,
            message: `The class "${classroom.name}" you are enrolled in has been published!`,
            type: 'class_published',
            entityId: classroom._id,
            entityRef: 'Classroom',
          }));
          await Notification.insertMany(studentNotifications);
        }
      } catch (notificationError) {
        console.error('Error creating in-app notifications on class publishing:', notificationError.message);
      }
    }

    res.json({
      message: classroom.published ? 'Classroom published' : 'Classroom unpublished',
      classroom
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Enroll student (after payment or free class)
router.post('/:id/enroll', auth, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Only students can enroll themselves
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can enroll' });
    }

    // Check if classroom is published
    if (!classroom.published) {
      return res.status(400).json({ message: 'Classroom is not available for enrollment' });
    }

    // Check if already enrolled
    if (classroom.students.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already enrolled' });
    }

    // Check capacity
    if (classroom.students.length >= classroom.capacity) {
      return res.status(400).json({ message: 'Classroom is full' });
    }

    // Only allow direct enrollment if class is free (amount #0)
    if (classroom.isPaid && classroom.pricing?.amount > 0) {
      return res.status(400).json({ message: 'This is a paid class. Please enroll through the payment flow.' });
    }

    // Enroll student
    classroom.students.push(req.user._id);
    await classroom.save();

    // Update user's enrolled classes
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { enrolledClasses: classroom._id }
    });

    res.json({ message: 'Enrolled successfully', classroom });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add student to classroom (School Admin, Personal Teacher, Root Admin)
router.post('/:id/students', auth, authorize('root_admin', 'school_admin', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    const { studentId } = req.body;
    const classroom = await Classroom.findById(req.params.id).populate('teacherId');

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check permissions
    // Check managed schools for school admin
    let hasAccess = false;
    if (req.user.role === 'school_admin') {
      const managedSchools = await School.find({ adminId: req.user._id }).select('_id');
      const managedSchoolIds = managedSchools.map(s => s._id.toString());
      const classSchoolIds = (Array.isArray(classroom.schoolId) ? classroom.schoolId : [classroom.schoolId])
        .filter(Boolean)
        .map(sid => (sid._id || sid).toString());

      hasAccess = classSchoolIds.some(sid => managedSchoolIds.includes(sid));
    }

    const canManage =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && hasAccess) ||
      (req.user.role === 'personal_teacher' && classroom.teacherId._id.toString() === req.user._id.toString());

    if (!canManage) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Verify student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(400).json({ message: 'Invalid student ID' });
    }

    // Check if already enrolled
    if (classroom.students.includes(studentId)) {
      return res.status(400).json({ message: 'Student already enrolled' });
    }

    // Check capacity
    if (classroom.students.length >= classroom.capacity) {
      return res.status(400).json({ message: 'Classroom is full' });
    }

    // Add student
    classroom.students.push(studentId);
    await classroom.save();

    // Update user's enrolled classes
    await User.findByIdAndUpdate(studentId, {
      $addToSet: { enrolledClasses: classroom._id }
    });

    await classroom.populate('students', 'name email');
    res.json({ message: 'Student added successfully', classroom });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove student from classroom
router.delete('/:id/students/:studentId', auth, authorize('root_admin', 'school_admin', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id).populate('teacherId');

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check permissions
    const canManage =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
      (req.user.role === 'personal_teacher' && classroom.teacherId._id.toString() === req.user._id.toString());

    if (!canManage) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Remove student
    classroom.students = classroom.students.filter(
      studentId => studentId.toString() !== req.params.studentId
    );
    await classroom.save();

    // Update user's enrolled classes
    await User.findByIdAndUpdate(req.params.studentId, {
      $pull: { enrolledClasses: classroom._id }
    });

    await classroom.populate('students', 'name email');
    res.json({ message: 'Student removed successfully', classroom });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update teacher (Root Admin only, for non-personal teacher classes)
router.put('/:id/teacher', auth, authorize('root_admin'), subscriptionCheck, async (req, res) => {
  try {
    const { teacherId } = req.body;
    const classroom = await Classroom.findById(req.params.id).populate('teacherId');

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Cannot change teacher for personal teacher classes
    if (!classroom.schoolId && classroom.teacherId.role === 'personal_teacher') {
      return res.status(403).json({ message: 'Cannot change teacher for personal teacher classes' });
    }

    // Verify new teacher exists
    const newTeacher = await User.findById(teacherId);
    if (!newTeacher || !['teacher', 'personal_teacher'].includes(newTeacher.role)) {
      return res.status(400).json({ message: 'Invalid teacher ID' });
    }

    // Update teacher
    classroom.teacherId = teacherId;
    await classroom.save();

    await classroom.populate('teacherId', 'name email');
    res.json({ message: 'Teacher updated successfully', classroom });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate a pseudo Google Meet link (note: creating a real Meet requires Google Workspace API/OAuth)
function generateGoogleMeetLink() {
  const rand = (len) => Array.from({ length: len }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
  return `https://meet.google.com/${rand(3)}-${rand(4)}-${rand(3)}`;
}

// Start a class call (teacher, personal_teacher owner, school_admin of school, root_admin)
router.post('/:id/call/start', auth, subscriptionCheck, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id).populate('schoolId');
    if (!classroom) return res.status(404).json({ message: 'Classroom not found' });

    const user = req.user;

    // Permission: teacher assigned, personal_teacher owner, school_admin of the school, or root_admin
    const teacherIdStr = classroom.teacherId?._id ? classroom.teacherId._id.toString() : (classroom.teacherId ? classroom.teacherId.toString() : null);
    const isTeacherOwner = teacherIdStr && user._id.toString() === teacherIdStr;
    const isPersonalTeacherOwner = user.role === 'personal_teacher' && isTeacherOwner;
    const isRoot = user.role === 'root_admin';
    // Check managed schools for school admin
    let isSchoolAdminOfClass = false;
    if (user.role === 'school_admin') {
      const managedSchools = await School.find({ adminId: user._id }).select('_id');
      const managedSchoolIds = managedSchools.map(s => s._id.toString());
      const classSchoolIds = (Array.isArray(classroom.schoolId) ? classroom.schoolId : [classroom.schoolId])
        .filter(Boolean)
        .map(sid => (sid._id || sid).toString());

      isSchoolAdminOfClass = classSchoolIds.some(sid => managedSchoolIds.includes(sid));
    }

    if (!(isTeacherOwner || isPersonalTeacherOwner || isRoot || isSchoolAdminOfClass)) {
      return res.status(403).json({ message: 'Access denied. Only class teacher or admins can start the call.' });
    }

    // Find latest call session
    const latest = await CallSession.findOne({ classroomId: classroom._id }).sort({ startedAt: -1 });
    const now = new Date();
    let link = null;
    let created = false;

    if (!latest) {
      // create a real Google Meet if configured, otherwise fallback to pseudo link
      let eventId = null;
      let htmlLink = null;
      try {
        const { createGoogleMeet } = require('../utils/googleMeet');
        const meet = await createGoogleMeet({ summary: `Class: ${classroom.name}`, attendees: [] });
        link = meet.meetUrl || generateGoogleMeetLink();
        eventId = meet.eventId || null;
        htmlLink = meet.htmlLink || null;
      } catch (err) {
        console.warn('Google Meet creation failed, falling back to pseudo link:', err.message);
        link = generateGoogleMeetLink();
      }
      const session = new CallSession({ classroomId: classroom._id, startedBy: user._id, link, startedAt: now, eventId, htmlLink });
      await session.save();
      created = true;
    } else {
      const diffMs = now - new Date(latest.startedAt);
      const fortyFiveMin = 45 * 60 * 1000;
      if (diffMs > fortyFiveMin) {
        let eventId = null;
        let htmlLink = null;
        try {
          const { createGoogleMeet } = require('../utils/googleMeet');
          const meet = await createGoogleMeet({ summary: `Class: ${classroom.name}`, attendees: [] });
          link = meet.meetUrl || generateGoogleMeetLink();
          eventId = meet.eventId || null;
          htmlLink = meet.htmlLink || null;
        } catch (err) {
          console.warn('Google Meet creation failed, falling back to pseudo link:', err.message);
          link = generateGoogleMeetLink();
        }
        const session = new CallSession({ classroomId: classroom._id, startedBy: user._id, link, startedAt: now, eventId, htmlLink });
        await session.save();
        created = true;
      } else {
        link = latest.link;
        // carry over any metadata from latest
        if (latest.eventId) {
          // prefer latest's event metadata
          res.locals._callEventId = latest.eventId;
          res.locals._callHtmlLink = latest.htmlLink;
        }
      }
    }

    // prepare response metadata
    const resp = { link, created, startedAt: now };
    if (res.locals._callEventId) {
      resp.eventId = res.locals._callEventId;
      resp.htmlLink = res.locals._callHtmlLink || null;
    } else if (created) {
      // load the just-created session to return event metadata if present
      const justCreated = await CallSession.findOne({ classroomId: classroom._id }).sort({ createdAt: -1 });
      if (justCreated) {
        resp.eventId = justCreated.eventId || null;
        resp.htmlLink = justCreated.htmlLink || null;
      }
    }

    res.json(resp);
  } catch (error) {
    console.error('Error starting class call:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get latest call link for a classroom (join) - allowed for enrolled students, teacher, school admin of school, personal teacher owner, root_admin
router.get('/:id/call', auth, subscriptionCheck, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id).populate('students').populate('schoolId');
    if (!classroom) return res.status(404).json({ message: 'Classroom not found' });

    const user = req.user;

    const enrolled = (classroom.students || []).some(s => (s._id ? s._id.toString() : s.toString()) === user._id.toString()) || (user.enrolledClasses || []).some(cid => cid.toString() === classroom._id.toString());
    const teacherIdStr = classroom.teacherId?._id ? classroom.teacherId._id.toString() : (classroom.teacherId ? classroom.teacherId.toString() : null);
    const isTeacherOwner = teacherIdStr && user._id.toString() === teacherIdStr;
    const isRoot = user.role === 'root_admin';
    // Check managed schools for school admin
    let isSchoolAdminOfClass = false;
    if (user.role === 'school_admin') {
      const managedSchools = await School.find({ adminId: user._id }).select('_id');
      const managedSchoolIds = managedSchools.map(s => s._id.toString());
      const classSchoolIds = (Array.isArray(classroom.schoolId) ? classroom.schoolId : [classroom.schoolId])
        .filter(Boolean)
        .map(sid => (sid._id || sid).toString());

      isSchoolAdminOfClass = classSchoolIds.some(sid => managedSchoolIds.includes(sid));
    }
    const isPersonalTeacherOwner = user.role === 'personal_teacher' && isTeacherOwner;

    if (!(enrolled || isTeacherOwner || isRoot || isSchoolAdminOfClass || isPersonalTeacherOwner)) {
      return res.status(403).json({ message: 'Access denied. Only enrolled students, class teacher, school admin, personal teacher owner, or root admin can join the call.' });
    }

    const latest = await CallSession.findOne({ classroomId: classroom._id }).sort({ startedAt: -1 });
    if (!latest) return res.status(404).json({ message: 'No active call found' });

    res.json({ link: latest.link, startedAt: latest.startedAt });
  } catch (error) {
    console.error('Error fetching class call:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

