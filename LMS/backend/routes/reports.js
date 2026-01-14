const express = require('express');
const router = express.Router();
const { auth: protect } = require('../middleware/auth');
const {
    getStudentPerformance,
    getClassPerformance,
    getSchoolPerformance,
    getAdminOverview
} = require('../controllers/reportController');

router.get('/student/me', protect, getStudentPerformance);
router.get('/class/:classId', protect, getClassPerformance);
router.get('/school/:schoolId', protect, getSchoolPerformance);
router.get('/admin/overview', protect, getAdminOverview);

module.exports = router;
