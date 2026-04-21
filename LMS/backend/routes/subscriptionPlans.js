const express = require('express');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Get all subscription plans
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
