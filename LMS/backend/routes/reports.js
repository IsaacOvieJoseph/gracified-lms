const express = require('express');
const router = express.Router();
const { auth: protect } = require('../middleware/auth');
const {
    getStudentPerformance,
    getClassPerformance,
    getSchoolPerformance,
    getAdminOverview,
    getAllStudentsReport
} = require('../controllers/reportController');

router.get('/student/me', protect, getStudentPerformance);
router.get('/class/:classId', protect, getClassPerformance);
router.get('/school/:schoolId', protect, getSchoolPerformance);
router.get('/admin/overview', protect, getAdminOverview);
router.get('/all-students', protect, getAllStudentsReport);

module.exports = router;
