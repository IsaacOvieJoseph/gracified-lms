const mongoose = require('mongoose');
const dotenv = require('dotenv');
const SubscriptionPlan = require('./models/SubscriptionPlan');

dotenv.config();

const seedSubscriptionPlans = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
    // Ensure the database name is consistently lowercase
    mongoUri = mongoUri.replace(/\/LMS$/, '/lms');

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected for seeding subscription plans');

    await SubscriptionPlan.deleteMany({}); // Clear existing plans to prevent duplicates on re-run
    console.log('Existing subscription plans cleared.');

    const plans = [
      {
        name: 'Free Trial',
        description: '2-week free trial for School Admins and Personal Teachers',
        planType: 'trial',
        price: 0,
        durationDays: 14,
        revenueSharePercentage: 0,
        features: ['Access to all core features for 2 weeks'],
        isActive: true,
      },
      {
        name: 'Pay-as-you-go',
        description: '5% deduction from student payments for Personal Teachers',
        planType: 'pay_as_you_go',
        price: 0,
        durationDays: 0, // No fixed duration
        revenueSharePercentage: 5,
        features: ['No upfront cost', '5% revenue share', 'Student enrollment monthly'],
        isActive: true,
      },
      {
        name: 'Monthly',
        description: 'Standard monthly billing',
        planType: 'monthly',
        price: 5000,
        durationDays: 30, // Approximately 30 days
        revenueSharePercentage: 0,
        features: ['Full access for one month'],
        isActive: true,
      },
      {
        name: 'Yearly',
        description: 'Best value - save more annually',
        planType: 'yearly',
        price: 50000,
        durationDays: 365, // Approximately 365 days
        revenueSharePercentage: 0,
        features: ['Full access for one year', 'Save ₦10,000 annually'],
        isActive: true,
      },
    ];

    await SubscriptionPlan.insertMany(plans);
    console.log('Subscription plans seeded successfully!');

    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding subscription plans:', error);
    process.exit(1);
  }
};

seedSubscriptionPlans();
