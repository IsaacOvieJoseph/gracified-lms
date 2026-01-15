
// @desc    Get consolidated students report for Teacher or School Admin
// @route   GET /api/reports/all-students
// @access  Private (Teacher, School Admin)
exports.getAllStudentsReport = async (req, res) => {
    try {
        const user = req.user;
        let classrooms = [];

        // 1. Identify relevant classrooms
        if (user.role === 'personal_teacher' || user.role === 'teacher') {
            classrooms = await Classroom.find({ teacherId: user._id }).populate('students', 'name email');
        } else if (user.role === 'school_admin') {
            // Find schools managed by this admin
            const schools = await School.find({ adminId: user._id });
            const schoolIds = schools.map(s => s._id);
            classrooms = await Classroom.find({ schoolId: { $in: schoolIds } }).populate('students', 'name email');
        } else {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const reportData = [];

        // 2. Iterate classrooms and calculate stats for each student
        // Note: This matches logic in getClassPerformance but aggregates across all classes
        for (const classroom of classrooms) {
            const assignments = await Assignment.find({ classroomId: classroom._id });
            const totalSessions = await CallSession.countDocuments({ classroomId: classroom._id });

            for (const student of classroom.students) {
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

                // Attendance
                const attendedCount = await Attendance.countDocuments({ classroomId: classroom._id, studentId: student._id });
                const attendPct = totalSessions > 0 ? (attendedCount / totalSessions) * 100 : 0;

                reportData.push({
                    id: `${student._id}-${classroom._id}`, // Unique key
                    studentName: student.name,
                    studentEmail: student.email,
                    className: classroom.name,
                    averagePercentage: parseFloat(percentage.toFixed(2)),
                    attendancePercentage: parseFloat(attendPct.toFixed(2)),
                    assignmentsSubmitted: submittedCount,
                    totalAssignments: assignments.length
                });
            }
        }

        res.json(reportData);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching students report' });
    }
};
