const express = require('express');
const Assignment = require('../models/Assignment');
const Classroom = require('../models/Classroom');
const Notification = require('../models/Notification'); // Import Notification model
const axios = require('axios'); // Ensure axios is imported here
const { auth, authorize } = require('../middleware/auth');
const subscriptionCheck = require('../middleware/subscriptionCheck'); // Import subscriptionCheck middleware
const { filterAssignmentsBySubscription, isClassroomOwnerSubscriptionValid } = require('../utils/subscriptionHelper');
const router = express.Router();

// Get assignments for a classroom
router.get('/classroom/:classroomId', auth, subscriptionCheck, async (req, res) => {
  try {
    // First check if classroom exists and owner's subscription is valid
    const classroom = await Classroom.findById(req.params.classroomId)
      .populate('teacherId', 'role subscriptionStatus trialEndDate')
      .populate({
        path: 'schoolId',
        select: 'adminId',
        populate: {
          path: 'adminId',
          select: 'subscriptionStatus trialEndDate'
        }
      });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    // Check subscription only if user is not a teacher or student
    if (req.user.role !== 'teacher' && req.user.role !== 'student') {
      const isOwnerSubscriptionValid = await isClassroomOwnerSubscriptionValid(classroom);
      if (!isOwnerSubscriptionValid) {
        return res.json({ assignments: [] }); // Return empty array if subscription expired
      }
    }
    
    // For teachers, allow access to their own class assignments regardless of subscription
    if (req.user.role === 'teacher') {
      const teacherId = classroom.teacherId._id || classroom.teacherId;
      if (teacherId.toString() !== req.user._id.toString()) {
        // Teacher trying to access someone else's class - check subscription
        const isOwnerSubscriptionValid = await isClassroomOwnerSubscriptionValid(classroom);
        if (!isOwnerSubscriptionValid) {
          return res.json({ assignments: [] });
        }
      }
    }
    
    // For students, allow access to enrolled class assignments regardless of subscription
    if (req.user.role === 'student') {
      const isEnrolled = classroom.students.some(
        studentId => (studentId._id || studentId).toString() === req.user._id.toString()
      ) || req.user.enrolledClasses.some(
        classId => classId.toString() === classroom._id.toString()
      );
      if (!isEnrolled) {
        return res.status(403).json({ message: 'You are not enrolled in this class.', enrollmentRequired: true });
      }
    }

    let assignments = await Assignment.find({ classroomId: req.params.classroomId })
      .populate('topicId', 'name')
      .populate({
        path: 'classroomId',
        populate: [
          {
            path: 'teacherId',
            select: 'role subscriptionStatus trialEndDate'
          },
          {
            path: 'schoolId',
            select: 'adminId',
            populate: {
              path: 'adminId',
              select: 'subscriptionStatus trialEndDate'
            }
          }
        ]
      })
      .populate({
        path: 'submissions.studentId',
        select: 'name email'
      })
      .sort({ dueDate: 1 });

    // Filter assignments to ensure classroom owner subscription is still valid (except for teachers and students)
    assignments = await filterAssignmentsBySubscription(assignments, req.user);

    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get assignment by ID
router.get('/:id', auth, subscriptionCheck, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate({
        path: 'classroomId',
        select: 'name teacherId schoolId',
        populate: [
          {
            path: 'teacherId',
            select: 'role subscriptionStatus trialEndDate'
          },
          {
            path: 'schoolId',
            select: 'adminId',
            populate: {
              path: 'adminId',
              select: 'subscriptionStatus trialEndDate'
            }
          }
        ]
      })
      .populate('topicId', 'name')
      .populate('submissions.studentId', 'name email');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Check if classroom owner's subscription is valid (skip check for teachers and students)
    if (assignment.classroomId) {
      // For teachers, allow access to their own class assignments
      if (req.user.role === 'teacher') {
        const teacherId = assignment.classroomId.teacherId?._id || assignment.classroomId.teacherId;
        if (teacherId && teacherId.toString() === req.user._id.toString()) {
          // Teacher's own class - allow access
        } else if (req.user.role !== 'student') {
          // Teacher accessing someone else's class - check subscription
          const isOwnerSubscriptionValid = await isClassroomOwnerSubscriptionValid(assignment.classroomId);
          if (!isOwnerSubscriptionValid) {
            return res.status(403).json({ message: 'This assignment is not available. The class owner\'s subscription has expired.', subscriptionExpired: true });
          }
        }
      }
      // For students, allow access to enrolled class assignments
      else if (req.user.role === 'student') {
        const isEnrolled = assignment.classroomId.students?.some(
          studentId => (studentId._id || studentId).toString() === req.user._id.toString()
        ) || req.user.enrolledClasses?.some(
          classId => classId.toString() === assignment.classroomId._id.toString()
        );
        if (!isEnrolled) {
          return res.status(403).json({ message: 'You are not enrolled in this class.', enrollmentRequired: true });
        }
      }
      // For other users, check subscription
      else {
        const isOwnerSubscriptionValid = await isClassroomOwnerSubscriptionValid(assignment.classroomId);
        if (!isOwnerSubscriptionValid) {
          return res.status(403).json({ message: 'This assignment is not available. The class owner\'s subscription has expired.', subscriptionExpired: true });
        }
      }
    }

    res.json({ assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create assignment
router.post('/', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    const { title, description, classroomId, topicId, dueDate, maxScore, assignmentType, questions, publishResultsAt } = req.body;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const canCreate =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
      classroom.teacherId.toString() === req.user._id.toString();

    if (!canCreate) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Basic validation for assignmentType and questions
    if (!assignmentType || !['mcq', 'theory'].includes(assignmentType)) {
      return res.status(400).json({ message: 'Invalid assignment type.' });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Assignments must have at least one question.' });
    }

    if (assignmentType === 'mcq') {
      for (const q of questions) {
        if (!q.questionText || !Array.isArray(q.options) || q.options.length < 2 || !q.correctOption) {
          return res.status(400).json({ message: 'MCQ questions must have text, at least two options, and a correct option.' });
        }
        if (!q.options.includes(q.correctOption)) {
          return res.status(400).json({ message: 'Correct option must be one of the provided options for MCQ.' });
        }
      }
      // Validation for publishResultsAt for MCQ assignments
      if (publishResultsAt && isNaN(new Date(publishResultsAt).getTime())) {
        return res.status(400).json({ message: 'Invalid publish results date.' });
      }
    } else if (assignmentType === 'theory') {
      for (const q of questions) {
        if (!q.questionText || !q.markingPreference || !['ai', 'manual'].includes(q.markingPreference)) {
          return res.status(400).json({ message: 'Theory questions must have text and a valid marking preference.' });
        }
        if (typeof q.maxScore !== 'number' || q.maxScore <= 0) {
          return res.status(400).json({ message: 'Each theory question must have a positive max score.' });
        }
      }
      if (publishResultsAt) {
        return res.status(400).json({ message: 'publishResultsAt is only applicable for MCQ assignments.' });
      }
    }

    // Calculate the total maxScore for the assignment based on individual question maxScores
    let calculatedOverallMaxScore = 0;
    if (assignmentType === 'theory') {
      calculatedOverallMaxScore = questions.reduce((sum, q) => sum + q.maxScore, 0);
    } else if (assignmentType === 'mcq') {
      // For MCQ, if maxScore is not provided, default to 100. If provided, use it.
      calculatedOverallMaxScore = maxScore || 100;
    } else {
      calculatedOverallMaxScore = maxScore || 100; // Default for other types or fallback
    }

    const assignment = new Assignment({
      title,
      description,
      classroomId,
      topicId,
      dueDate,
      maxScore: calculatedOverallMaxScore,
      assignmentType,
      questions,
      publishResultsAt: publishResultsAt || null
    });

    await assignment.save();

    // Add assignment to classroom
    classroom.assignments.push(assignment._id);
    await classroom.save();

    // Trigger assignment reminder if dueDate is set
    if (assignment.dueDate) {
      try {
        // Replace with actual backend notification service call
        // Example using internal API call if setup (requires proper base URL)
        await axios.post(`http://localhost:${process.env.PORT || 5000}/api/notifications/assignment-reminder/${assignment._id}`, {},
          { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } });
      } catch (notificationError) {
        console.error('Error sending assignment reminder notification:', notificationError.message);
      }
    }

    // Create in-app notifications for new assignment
    try {
      // Notification for teacher
      await Notification.create({
        userId: classroom.teacherId,
        message: `New assignment: "${assignment.title}" has been created in "${classroom.name}".`,
        type: 'new_assignment',
        entityId: assignment._id,
        entityRef: 'Assignment',
      });

      // Notifications for students in the classroom
      const studentNotifications = classroom.students.map(studentId => ({
        userId: studentId,
        message: `New assignment: "${assignment.title}" has been posted in "${classroom.name}".`,
        type: 'new_assignment',
        entityId: assignment._id,
        entityRef: 'Assignment',
      }));
      await Notification.insertMany(studentNotifications);
    } catch (inAppNotifError) {
      console.error('Error creating in-app notifications for new assignment:', inAppNotifError.message);
    }

    res.status(201).json({ assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update assignment
router.put('/:id', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    const { title, description, topicId, dueDate, maxScore, assignmentType, questions, publishResultsAt } = req.body;

    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Basic authorization check (can be expanded)
    const classroom = await Classroom.findById(assignment.classroomId);
    const canEdit =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
      classroom.teacherId.toString() === req.user._id.toString();

    if (!canEdit) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update fields
    if (title !== undefined) assignment.title = title;
    if (description !== undefined) assignment.description = description;
    if (topicId !== undefined) assignment.topicId = topicId;
    if (dueDate !== undefined) assignment.dueDate = dueDate;
    if (maxScore !== undefined) assignment.maxScore = maxScore;

    // Update new assignment type fields
    if (assignmentType !== undefined) {
      if (!['mcq', 'theory'].includes(assignmentType)) {
        return res.status(400).json({ message: 'Invalid assignment type.' });
      }
      assignment.assignmentType = assignmentType;
    }

    if (questions !== undefined) {
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ message: 'Assignments must have at least one question.' });
      }

      if (assignment.assignmentType === 'mcq') {
        for (const q of questions) {
          if (!q.questionText || !Array.isArray(q.options) || q.options.length < 2 || !q.correctOption) {
            return res.status(400).json({ message: 'MCQ questions must have text, at least two options, and a correct option.' });
          }
          if (!q.options.includes(q.correctOption)) {
            return res.status(400).json({ message: 'Correct option must be one of the provided options for MCQ.' });
          }
        }
      } else if (assignment.assignmentType === 'theory') {
        for (const q of questions) {
          if (!q.questionText || !q.markingPreference || !['ai', 'manual'].includes(q.markingPreference)) {
            return res.status(400).json({ message: 'Theory questions must have text and a valid marking preference.' });
          }
        }
      }
      assignment.questions = questions;
    }

    // Recalculate overall maxScore if questions were updated for a theory assignment
    if (assignment.assignmentType === 'theory' && questions !== undefined) {
      assignment.maxScore = questions.reduce((sum, q) => sum + q.maxScore, 0);
    } else if (assignment.assignmentType === 'mcq' && maxScore !== undefined) {
      assignment.maxScore = maxScore; // Allow updating overall maxScore directly for MCQ
    }

    // Update publishResultsAt field
    if (publishResultsAt !== undefined) {
      if (assignment.assignmentType === 'mcq') {
        if (publishResultsAt && isNaN(new Date(publishResultsAt).getTime())) {
          return res.status(400).json({ message: 'Invalid publish results date.' });
        }
        assignment.publishResultsAt = publishResultsAt;
      } else if (publishResultsAt) {
        return res.status(400).json({ message: 'publishResultsAt is only applicable for MCQ assignments.' });
      }
    }

    await assignment.save();

    // Trigger assignment reminder if dueDate is set/updated
    if (assignment.dueDate) {
      await axios.post(`http://localhost:${process.env.PORT || 5000}/api/notifications/assignment-reminder/${assignment._id}`, {},
        { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } }); // Assuming `api` is available or import `axios`
    }

    // Create in-app notifications for updated assignment (especially if dueDate changes)
    try {
      // Only send if dueDate actually changed and is set
      const oldDueDate = req.body.oldDueDate; // Assuming frontend sends old dueDate for comparison
      if (assignment.dueDate && (!oldDueDate || new Date(assignment.dueDate).getTime() !== new Date(oldDueDate).getTime())) {
        const message = `Assignment "${assignment.title}" in "${classroom.name}" has been updated. New due date: ${new Date(assignment.dueDate).toLocaleDateString()}.`;

        await Notification.create({
          userId: classroom.teacherId,
          message,
          type: 'assignment_reminder',
          entityId: assignment._id,
          entityRef: 'Assignment',
        });

        const studentNotifications = classroom.students.map(studentId => ({
          userId: studentId,
          message,
          type: 'assignment_reminder',
          entityId: assignment._id,
          entityRef: 'Assignment',
        }));
        await Notification.insertMany(studentNotifications);
      }
    } catch (inAppNotifError) {
      console.error('Error creating in-app notifications for updated assignment:', inAppNotifError.message);
    }

    res.json({ message: 'Assignment updated successfully', assignment });
  } catch (error) {
    res.status(500).json({ message: error.reason || error.message });
  }
});

// Submit assignment (Student)
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('classroomId', 'students');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Check if student is enrolled
    const isEnrolled = assignment.classroomId.students.some(
      student => student.toString() === req.user._id.toString()
    );

    if (!isEnrolled) {
      return res.status(403).json({ message: 'Not enrolled in this classroom' });
    }

    // Check if already submitted
    const existingSubmission = assignment.submissions.find(
      sub => sub.studentId.toString() === req.user._id.toString()
    );

    if (existingSubmission) {
      return res.status(400).json({ message: 'Already submitted' });
    }

    const { answers, files } = req.body; // Changed from 'content' to 'answers'
    let score = 0;
    let status = 'submitted';

    // MCQ Auto-marking
    if (assignment.assignmentType === 'mcq') {
      if (!Array.isArray(answers) || answers.length !== assignment.questions.length) {
        return res.status(400).json({ message: 'Invalid answers format for MCQ assignment.' });
      }
      let correctAnswersCount = 0;
      for (let i = 0; i < assignment.questions.length; i++) {
        if (assignment.questions[i].correctOption === answers[i]) {
          correctAnswersCount++;
        }
      }
      score = (correctAnswersCount / assignment.questions.length) * assignment.maxScore;
      status = 'graded'; // MCQ assignments are graded immediately
    }

    assignment.submissions.push({
      studentId: req.user._id,
      answers,
      files: files || [],
      score,
      status
    });

    await assignment.save();

    // Create in-app notification for the teacher about new submission
    try {
      // Populate classroom and teacherId to get teacher's ID
      await assignment.populate('classroomId', 'teacherId'); // Ensure teacherId is populated
      const teacherId = assignment.classroomId.teacherId;

      if (teacherId) {
        await Notification.create({
          userId: teacherId,
          message: `Student ${req.user.name} has submitted assignment "${assignment.title}" in "${assignment.classroomId.name}".`,
          type: 'new_submission',
          entityId: assignment._id,
          entityRef: 'Assignment',
        });
      }
    } catch (inAppNotifError) {
      console.error('Error creating in-app notification for new submission:', inAppNotifError.message);
    }

    res.json({ message: 'Assignment submitted successfully', assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Grade assignment (Teacher)
router.put('/:id/grade', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('classroomId');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const classroom = assignment.classroomId;
    const canGrade =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
      classroom.teacherId.toString() === req.user._id.toString();

    if (!canGrade) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { studentId, score, feedback } = req.body;

    const submission = assignment.submissions.find(
      sub => sub.studentId.toString() === studentId
    );

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    submission.score = score;
    submission.feedback = feedback;
    submission.status = 'graded';

    await assignment.save();

    // Trigger assignment result notification
    try {
      await axios.post(`http://localhost:${process.env.PORT || 5000}/api/notifications/assignment-result/${assignment._id}/${studentId}`, {},
        { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } });
    } catch (notificationError) {
      console.error('Error sending assignment result notification:', notificationError.message);
    }

    // Create in-app notifications for assignment graded
    try {
      // Notification for student
      await Notification.create({
        userId: studentId,
        message: `Your assignment "${assignment.title}" in "${classroom.name}" has been graded. Score: ${score}/${assignment.maxScore}.`,
        type: 'assignment_graded',
        entityId: assignment._id,
        entityRef: 'Assignment',
      });

      // Notification for teacher (who graded it)
      await Notification.create({
        userId: req.user._id, // The user grading is the teacher
        message: `You graded assignment "${assignment.title}" for ${submission.studentId.name}. Score: ${score}/${assignment.maxScore}.`,
        type: 'assignment_graded',
        entityId: assignment._id,
        entityRef: 'Assignment',
      });
    } catch (inAppNotifError) {
      console.error('Error creating in-app notifications for assignment graded:', inAppNotifError.message);
    }

    res.json({ message: 'Assignment graded successfully', assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Grade theory assignment (Teacher/Admin) - Manual or AI Placeholder
router.put('/:id/grade-theory', auth, authorize('root_admin', 'school_admin', 'teacher', 'personal_teacher'), subscriptionCheck, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('classroomId');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (assignment.assignmentType !== 'theory') {
      return res.status(400).json({ message: 'This route is for grading theory assignments only.' });
    }

    const classroom = assignment.classroomId;
    const canGrade =
      req.user.role === 'root_admin' ||
      (req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString()) ||
      classroom.teacherId.toString() === req.user._id.toString();

    if (!canGrade) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { studentId, questionScores } = req.body; // Expect an array of { questionIndex, score, feedback }

    const submission = assignment.submissions.find(
      sub => sub.studentId.toString() === studentId
    );

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    if (!Array.isArray(questionScores) || questionScores.length !== assignment.questions.length) {
      return res.status(400).json({ message: 'Invalid question scores format.' });
    }

    let totalScore = 0;
    const updatedQuestionScores = [];

    for (let i = 0; i < questionScores.length; i++) {
      const qScore = questionScores[i];
      const assignmentQuestion = assignment.questions[i];

      if (typeof qScore.score !== 'number' || qScore.score < 0) {
        return res.status(400).json({ message: `Invalid score for question ${i + 1}.` });
      }

      if (qScore.score > assignmentQuestion.maxScore) {
        return res.status(400).json({ message: `Score for question ${i + 1} exceeds its maximum allowed score (${assignmentQuestion.maxScore}).` });
      }

      updatedQuestionScores.push({
        questionIndex: i,
        score: qScore.score,
        feedback: qScore.feedback || ''
      });
      totalScore += qScore.score;
    }

    submission.questionScores = updatedQuestionScores;
    submission.score = totalScore;
    submission.status = 'graded';

    await assignment.save();

    // Create in-app notification for student that their assignment has been graded
    try {
      await Notification.create({
        userId: studentId,
        message: `Your theory assignment "${assignment.title}" in "${classroom.name}" has been graded. Total Score: ${submission.score}/${assignment.maxScore}.`,
        type: 'assignment_graded',
        entityId: assignment._id,
        entityRef: 'Assignment',
      });
    } catch (inAppNotifError) {
      console.error('Error creating in-app notification for graded theory assignment:', inAppNotifError.message);
    }

    res.json({ message: 'Theory assignment graded successfully', assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get assignment results (Student/Teacher/Admin)
router.get('/:id/results', auth, subscriptionCheck, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('classroomId', 'name teacherId schoolId') // Populate classroom for auth checks
      .populate({
        path: 'submissions.studentId',
        select: 'name email'
      });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const classroom = assignment.classroomId;

    // Authorization check
    const isStudent = req.user.role === 'student';
    const isTeacherOfClassroom = classroom.teacherId.toString() === req.user._id.toString();
    const isSchoolAdminOfClassroom = req.user.role === 'school_admin' && classroom.schoolId?.toString() === req.user.schoolId?.toString();
    const isRootAdmin = req.user.role === 'root_admin';

    if (!isStudent && !isTeacherOfClassroom && !isSchoolAdminOfClassroom && !isRootAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let submissionsToReturn = [];

    // Check publishResultsAt for MCQ assignments
    const canViewAllResults = isTeacherOfClassroom || isSchoolAdminOfClassroom || isRootAdmin;

    if (assignment.assignmentType === 'mcq' && assignment.publishResultsAt && new Date() < new Date(assignment.publishResultsAt)) {
      // If it's an MCQ and results are not yet published
      if (isStudent) {
        // Students cannot see results yet
        return res.status(403).json({ message: 'Assignment results are not yet published.' });
      } else if (canViewAllResults) {
        // Teachers/Admins can still see results, but we might want to flag it
        // For now, we'll allow them to see all submissions, but students won't
        submissionsToReturn = assignment.submissions;
      }
    } else {
      // Results are published or not an MCQ assignment
      if (isStudent) {
        const studentSubmission = assignment.submissions.find(sub => sub.studentId._id.toString() === req.user._id.toString());
        if (studentSubmission) {
          submissionsToReturn.push(studentSubmission);
        }
      } else if (canViewAllResults) {
        submissionsToReturn = assignment.submissions;
      }
    }

    res.json({ assignment: { ...assignment.toObject(), submissions: submissionsToReturn } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

