const mongoose = require('mongoose');
const User = require('./models/User');
const School = require('./models/School');
const Classroom = require('./models/Classroom');
const dotenv = require('dotenv');

dotenv.config();

async function inspect() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms');
    console.log('MongoDB Connected!');

    const admins = await User.find({ role: 'school_admin' }).select('name email schoolId');
    console.log('\n--- SCHOOL ADMINS ---');
    for (const admin of admins) {
      console.log(`Admin: ${admin.name} (${admin.email}), ID: ${admin._id}`);
      console.log(`  schoolId array on User:`, admin.schoolId);

      // Find schools where this admin is set
      const schools = await School.find({ adminId: admin._id });
      console.log(`  Schools managed (where adminId matches):`);
      schools.forEach(s => {
        console.log(`    - School: ${s.name}, ID: ${s._id}, shortCode: ${s.shortCode}`);
      });

      // Find classrooms created for these schools
      const schoolIds = schools.map(s => s._id);
      const classrooms = await Classroom.find({ schoolId: { $in: schoolIds } }).populate('teacherId', 'name email');
      console.log(`  Classrooms for managed schools:`);
      classrooms.forEach(c => {
        console.log(`    - Class: ${c.name}, ID: ${c._id}, schoolId:`, c.schoolId, `, teacher: ${c.teacherId?.name || 'none'}`);
      });

      // Find users created by this admin
      const users = await User.find({ createdBy: admin._id }).select('name email role schoolId');
      console.log(`  Users created by this admin:`);
      users.forEach(u => {
        console.log(`    - User: ${u.name} (${u.email}), Role: ${u.role}, schoolId:`, u.schoolId);
      });
    }

    await mongoose.disconnect();
    console.log('\nInspection finished!');
  } catch (error) {
    console.error('Error:', error);
  }
}

inspect();
