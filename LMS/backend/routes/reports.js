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

/**
 * @swagger
 * /api/reports/student/me:
 *   get:
 *     summary: Get performance report for the logged-in student
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student performance data
 */
router.get('/student/me', protect, getStudentPerformance);
/**
 * @swagger
 * /api/reports/class/{classId}:
 *   get:
 *     summary: Get performance report for a specific classroom
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Classroom performance data
 */
router.get('/class/:classId', protect, getClassPerformance);
router.get('/school/:schoolId', protect, getSchoolPerformance);
/**
 * @swagger
 * /api/reports/admin/overview:
 *   get:
 *     summary: Get system-wide overview report (Root Admin)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin overview data
 */
router.get('/admin/overview', protect, getAdminOverview);
router.get('/all-students', protect, getAllStudentsReport);

module.exports = router;
