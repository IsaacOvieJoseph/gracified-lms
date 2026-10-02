const express = require('express');
const UserSubscription = require('../models/UserSubscription');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Get current user's subscription
/**
 * @swagger
 * /api/user-subscriptions/me:
 *   get:
 *     summary: Get current user's active subscription
 *     tags: [User Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription details
 */
router.get('/me', auth, async (req, res) => {
  try {
    const userSubscription = await UserSubscription.findOne({ userId: req.user._id })
      .populate('planId');

    if (!userSubscription) {
      return res.status(404).json({ message: 'No active subscription found for this user' });
    }
    res.json({ subscription: userSubscription });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all user subscriptions (Admin only)
/**
 * @swagger
 * /api/user-subscriptions:
 *   get:
 *     summary: Get all user subscriptions (Admin only)
 *     tags: [User Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user subscriptions
 */
router.get('/', auth, authorize('root_admin', 'school_admin'), async (req, res) => {
  try {
    let query = {};

    // School admins can only see subscriptions for users within their school
    if (req.user.role === 'school_admin' && req.user.schoolId) {
      const adminSchoolIds = Array.isArray(req.user.schoolId) ? req.user.schoolId : [req.user.schoolId];
      const schoolUsers = await User.find({ schoolId: { $in: adminSchoolIds } }).select('_id');
      const userIds = schoolUsers.map(user => user._id);
      query.userId = { $in: userIds };
    }

    const subscriptions = await UserSubscription.find(query)
      .populate('userId', 'name email role schoolId')
      .populate('planId');

    res.json({ subscriptions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create/Update user subscription (Admin only for direct creation, or internal for trial activation)
/**
 * @swagger
 * /api/user-subscriptions:
 *   post:
 *     summary: Create or update a user subscription manually (Admin only)
 *     tags: [User Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - planId
 *               - status
 *     responses:
 *       200:
 *         description: Subscription updated
 */
router.post('/', auth, authorize('root_admin', 'school_admin'), async (req, res) => {
  try {
    const { userId, planId, status, startDate, endDate, paymentId, stripeSubscriptionId } = req.body;

    // Ensure userId exists and is valid
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure planId exists and is valid
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    // Find and update existing subscription or create new one
    let userSubscription = await UserSubscription.findOneAndUpdate(
      { userId },
      { planId, status, startDate, endDate, paymentId, stripeSubscriptionId },
      { new: true, upsert: true, runValidators: true }
    );

    // Update user's subscription fields
    user.subscriptionPlan = planId;
    user.subscriptionStatus = status;
    user.subscriptionStartDate = startDate;
    user.subscriptionEndDate = endDate;
    await user.save();

    res.status(200).json({ subscription: userSubscription });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user subscription status (Admin only)
router.patch('/:id/status', auth, authorize('root_admin', 'school_admin'), async (req, res) => {
  try {
    const { status } = req.body;

    const userSubscription = await UserSubscription.findById(req.params.id);
    if (!userSubscription) {
      return res.status(404).json({ message: 'User subscription not found' });
    }

    userSubscription.status = status;
    await userSubscription.save();

    // Update user's main subscription status
    await User.findByIdAndUpdate(userSubscription.userId, { subscriptionStatus: status });

    res.json({ subscription: userSubscription });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Issue free access to users (Root Admin only)
/**
 * @swagger
 * /api/user-subscriptions/issue-free-access:
 *   post:
 *     summary: Issue free access to multiple users (Root Admin)
 *     tags: [User Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *               - durationDays
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               durationDays:
 *                 type: number
 *     responses:
 *       200:
 *         description: Access issued
 */
router.post('/issue-free-access', auth, authorize('root_admin'), async (req, res) => {
  try {
    const { userIds, durationDays } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs are required and must be an array' });
    }

    if (!durationDays || isNaN(durationDays)) {
      return res.status(400).json({ message: 'Duration in days is required' });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(durationDays));

    const results = [];
    for (const userId of userIds) {
      const user = await User.findById(userId);
      if (!user) {
        results.push({ userId, status: 'error', message: 'User not found' });
        continue;
      }

      // Update or create subscription
      await UserSubscription.findOneAndUpdate(
        { userId },
        { 
          status: 'active', 
          startDate, 
          endDate, 
          paymentId: null, 
          stripeSubscriptionId: 'free_access_by_admin' 
        },
        { new: true, upsert: true }
      );

      // Update user fields
      user.subscriptionStatus = 'active';
      user.subscriptionStartDate = startDate;
      user.subscriptionEndDate = endDate;
      await user.save();

      results.push({ userId, status: 'success' });
    }

    res.json({ message: 'Free access issued successfully', results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
