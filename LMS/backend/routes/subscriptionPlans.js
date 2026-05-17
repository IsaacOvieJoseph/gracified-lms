const express = require('express');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Get all subscription plans
/**
 * @swagger
 * /api/subscription-plans:
 *   get:
 *     summary: Get all available subscription plans
 *     tags: [Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of plans
 */
router.get('/', auth, async (req, res) => {
  try {
    let query = { isActive: true };
    if (req.user && req.user.role === 'root_admin') {
      query = {}; // Root admin sees all plans
    }
    const plans = await SubscriptionPlan.find(query);
    res.json({ plans });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a single subscription plan by ID
/**
 * @swagger
 * /api/subscription-plans/{id}:
 *   get:
 *     summary: Get a subscription plan by ID
 *     tags: [Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan details
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }
    res.json({ plan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new subscription plan (Admin only)
/**
 * @swagger
 * /api/subscription-plans:
 *   post:
 *     summary: Create a new subscription plan (Root Admin)
 *     tags: [Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - planType
 *               - price
 *     responses:
 *       201:
 *         description: Plan created
 */
router.post('/', auth, authorize('root_admin'), async (req, res) => {
  try {
    const { name, description, planType, price, durationDays, revenueSharePercentage, features } = req.body;

    const newPlan = new SubscriptionPlan({
      name,
      description,
      planType,
      price,
      durationDays,
      revenueSharePercentage,
      features,
    });

    await newPlan.save();
    res.status(201).json({ plan: newPlan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a subscription plan (Admin only)
router.put('/:id', auth, authorize('root_admin'), async (req, res) => {
  try {
    const { name, description, planType, price, durationDays, revenueSharePercentage, features, isActive } = req.body;

    const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.id,
      { name, description, planType, price, durationDays, revenueSharePercentage, features, isActive },
      { new: true, runValidators: true }
    );

    if (!updatedPlan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    res.json({ plan: updatedPlan });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a subscription plan (Admin only)
router.delete('/:id', auth, authorize('root_admin'), async (req, res) => {
  try {
    const deletedPlan = await SubscriptionPlan.findByIdAndDelete(req.params.id);

    if (!deletedPlan) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    res.json({ message: 'Subscription plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
