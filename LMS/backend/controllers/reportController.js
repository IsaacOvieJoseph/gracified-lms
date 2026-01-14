const User = require('../models/User');
const Assignment = require('../models/Assignment');
const Classroom = require('../models/Classroom');
const School = require('../models/School');

// Helper to calculate basic stats
const calculateStats = (scores) => {
    if (!scores.length) return { average: 0, min: 0, max: 0, count: 0 };
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = sum / scores.length;
    return {
        average: parseFloat(avg.toFixed(2)),
        min: Math.min(...scores),
        max: Math.max(...scores),
        count: scores.length
    };
};

// @desc    Get performance report for the logged-in student
// @route   GET /api/reports/student/me
// @access  Private (Student)
exports.getStudentPerformance = async (req, res) => {
    try {
        const studentId = req.user._id;

        // Find all classrooms the student is enrolled in
        const classrooms = await Classroom.find({ students: studentId });
        const classroomIds = classrooms.map(c => c._id);

        // Find all assignments in these classrooms
        // AND populate submissions for this student
        const assignments = await Assignment.find({
            classroomId: { $in: classroomIds },
            published: true // Only count published assignments
        }).populate('classroomId', 'name');

        let totalAssignments = 0;
        let submittedCount = 0;
        let totalScore = 0;
        let maxPossibleScore = 0;

        const performanceByClass = {};

        const assignmentDetails = [];

        assignments.forEach(assignment => {
            const classId = assignment.classroomId._id.toString();
            const className = assignment.classroomId.name;

            if (!performanceByClass[classId]) {
                performanceByClass[classId] = {
                    className,
                    totalAssignments: 0,
                    submittedCount: 0,
                    totalScore: 0,
                    maxPossibleScore: 0,
                    assignments: []
                };
            }

            performanceByClass[classId].totalAssignments++;
            totalAssignments++;

            // Find submission for this student
            const submission = assignment.submissions.find(sub =>
                sub.studentId.toString() === studentId.toString()
            );

            let score = 0;
            let status = 'pending';

            if (submission) {
                submittedCount++;
                performanceByClass[classId].submittedCount++;

                if (submission.status === 'graded' || submission.status === 'returned') {
                    score = submission.score;
                    status = submission.status;

                    totalScore += score;
                    maxPossibleScore += assignment.maxScore;

                    performanceByClass[classId].totalScore += score;
                    performanceByClass[classId].maxPossibleScore += assignment.maxScore;
                } else {
                    status = 'submitted'; // Submitted but not graded
                }
            } else {
                status = 'missing';
            }

            const assignmentData = {
                id: assignment._id,
                title: assignment.title,
                className,
                dueDate: assignment.dueDate,
                score,
                maxScore: assignment.maxScore,
                status
            };

            assignmentDetails.push(assignmentData);
            performanceByClass[classId].assignments.push(assignmentData);
        });

        // Calculate percentages
        const overallPercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

        Object.values(performanceByClass).forEach(cls => {
            cls.averagePercentage = cls.maxPossibleScore > 0 ? (cls.totalScore / cls.maxPossibleScore) * 100 : 0;
        });

        res.json({
            summary: {
                totalAssignments,
                submittedCount,
                overallPercentage: parseFloat(overallPercentage.toFixed(2)),
                pendingCount: totalAssignments - submittedCount // Roughly, or specifically calculate 'missing'
            },
            byClass: Object.values(performanceByClass),
            recentAssignments: assignmentDetails.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)).slice(0, 10)
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching student report' });
    }
};

// @desc    Get performance report for a specific class (for Teacher)
// @route   GET /api/reports/class/:classId
// @access  Private (Teacher, Admin)
exports.getClassPerformance = async (req, res) => {
    try {
        const { classId } = req.params;

        // Authorization: User must be teacher of this class OR admin
        const classroom = await Classroom.findById(classId).populate('students', 'name email');
        if (!classroom) {
            return res.status(404).json({ message: 'Classroom not found' });
        }

        if (req.user.role !== 'root_admin' &&
            req.user.role !== 'school_admin' &&
            classroom.teacherId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to view this report' });
        }

        const assignments = await Assignment.find({ classroomId: classId }); // Include unpublished? Maybe not.

        const studentStats = [];
        const assignmentStats = [];

        // Calculate Assignment Stats (Avg score usually)
        assignments.forEach(assign => {
            const scores = assign.submissions
                .filter(sub => sub.status === 'graded' || sub.status === 'returned')
                .map(sub => sub.score);

            const stats = calculateStats(scores);

            assignmentStats.push({
                id: assign._id,
                title: assign.title,
                maxScore: assign.maxScore,
                averageScore: stats.average,
                submissionCount: assign.submissions.length,
                totalStudents: classroom.students.length
            });
        });

        // Calculate Student Stats
        classroom.students.forEach(student => {
            let totalScore = 0;
            let maxPossible = 0;
            let submittedCount = 0;

            assignments.forEach(assign => {
                const sub = assign.submissions.find(s => s.studentId.toString() === student._id.toString());
                if (sub) {
                    submittedCount++;
                    if (sub.status === 'graded' || sub.status === 'returned') {
                        totalScore += sub.score;
                        maxPossible += assign.maxScore;
                    }
                }
            });

            const percentage = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;

            studentStats.push({
                id: student._id,
                name: student.name,
                email: student.email,
                assignmentsSubmitted: submittedCount,
                totalAssignments: assignments.length,
                averagePercentage: parseFloat(percentage.toFixed(2))
            });
        });

        res.json({
            classroom: {
                id: classroom._id,
                name: classroom.name,
                studentCount: classroom.students.length
            },
            assignmentStats,
            studentStats: studentStats.sort((a, b) => b.averagePercentage - a.averagePercentage)
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching class report' });
    }
};

// @desc    Get performance report for a school (School Admin)
// @route   GET /api/reports/school/:schoolId
// @access  Private (School Admin, Root Admin)
exports.getSchoolPerformance = async (req, res) => {
    try {
        const { schoolId } = req.params;

        const school = await School.findById(schoolId);
        if (!school) return res.status(404).json({ message: 'School not found' });

        // Authorization: Check if user is root_admin or the school's admin
        if (req.user.role !== 'root_admin' && school.adminId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Get all classrooms for this school
        const classrooms = await Classroom.find({ schoolId: schoolId });
        const classroomIds = classrooms.map(c => c._id);

        // Aggregate data
        const totalStudents = new Set();
        let totalAssignmentsCount = 0;
        let totalSubmissionsCount = 0;
        let globalScoreSum = 0;
        let globalMaxScoreSum = 0;

        const classPerformance = [];

        // We can do this more efficiently with aggregation pipeline, but loop is fine for now
        for (const classroom of classrooms) {
            classroom.students.forEach(s => totalStudents.add(s.toString()));

            const assignments = await Assignment.find({ classroomId: classroom._id });

            let clsScore = 0;
            let clsMax = 0;
            let clsSubs = 0;

            assignments.forEach(a => {
                totalAssignmentsCount++;
                clsSubs += a.submissions.length;

                a.submissions.forEach(s => {
                    if (s.status === 'graded' || s.status === 'returned') {
                        clsScore += s.score;
                        clsMax += a.maxScore;
                    }
                });
            });

            totalSubmissionsCount += clsSubs;
            globalScoreSum += clsScore;
            globalMaxScoreSum += clsMax;

            const clsAvg = clsMax > 0 ? (clsScore / clsMax) * 100 : 0;

            classPerformance.push({
                id: classroom._id,
                name: classroom.name,
                studentCount: classroom.students.length,
                averagePercentage: parseFloat(clsAvg.toFixed(2)),
                assignmentCount: assignments.length
            });
        }

        res.json({
            schoolName: school.name,
            totalStudents: totalStudents.size,
            totalClassrooms: classrooms.length,
            overallAverage: globalMaxScoreSum > 0 ? parseFloat(((globalScoreSum / globalMaxScoreSum) * 100).toFixed(2)) : 0,
            classPerformance: classPerformance.sort((a, b) => b.averagePercentage - a.averagePercentage)
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching school report' });
    }
};

// @desc    Get dashboard stats for root admin
// @route   GET /api/reports/admin/overview
// @access  Private (Root Admin)
exports.getAdminOverview = async (req, res) => {
    try {
        if (req.user.role !== 'root_admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const stats = {
            totalSchools: await School.countDocuments(),
            totalUsers: await User.countDocuments(),
            totalClassrooms: await Classroom.countDocuments(),
            totalAssignments: await Assignment.countDocuments()
        };

        // Maybe add some recent activity or revenue stats later

        res.json(stats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
