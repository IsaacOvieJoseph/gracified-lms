/**
 * Migration script to generate slugs for existing schools and classrooms
 * Run with: node migrate-slugs.js
 */

const mongoose = require('mongoose');
const School = require('./models/School');
const Classroom = require('./models/Classroom');
require('dotenv').config();

const DB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/lms';

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

const generateUniqueSlug = async (model, name, excludeId = null) => {
  const generateSlugForName = (n) => generateSlug(n);
  let slug = generateSlugForName(name);
  let baseSlug = slug;
  let counter = 1;

  let query = { slug, _id: { $ne: excludeId } };
  let exists = await model.findOne(query);
  
  while (exists) {
    slug = `${baseSlug}-${counter}`;
    counter++;
    query = { slug, _id: { $ne: excludeId } };
    exists = await model.findOne(query);
  }
  
  return slug;
};

async function migrateSchools() {
  console.log('🏫 Starting school slug migration...');
  try {
    const schools = await School.find({ $or: [{ slug: { $exists: false } }, { slug: null }] });
    console.log(`Found ${schools.length} schools without slugs`);

    let updated = 0;
    for (const school of schools) {
      try {
        const slug = await generateUniqueSlug(School, school.name, school._id);
        school.slug = slug;
        await school.save();
        updated++;
        console.log(`✅ ${school.name} → ${slug}`);
      } catch (error) {
        console.error(`❌ Error migrating school ${school.name}:`, error.message);
      }
    }
    console.log(`✅ School migration complete: ${updated}/${schools.length} updated\n`);
  } catch (error) {
    console.error('❌ School migration failed:', error.message);
  }
}

async function migrateClassrooms() {
  console.log('📚 Starting classroom slug migration...');
  try {
    const classrooms = await Classroom.find({ $or: [{ slug: { $exists: false } }, { slug: null }] });
    console.log(`Found ${classrooms.length} classrooms without slugs`);

    let updated = 0;
    for (const classroom of classrooms) {
      try {
        const slug = await generateUniqueSlug(Classroom, classroom.name, classroom._id);
        classroom.slug = slug;
        await classroom.save();
        updated++;
        console.log(`✅ ${classroom.name} → ${slug}`);
      } catch (error) {
        console.error(`❌ Error migrating classroom ${classroom.name}:`, error.message);
      }
    }
    console.log(`✅ Classroom migration complete: ${updated}/${classrooms.length} updated\n`);
  } catch (error) {
    console.error('❌ Classroom migration failed:', error.message);
  }
}

async function runMigration() {
  try {
    console.log('🚀 Starting slug migration...\n');
    await mongoose.connect(DB_URL);
    console.log('✅ Connected to database\n');

    await migrateSchools();
    await migrateClassrooms();

    console.log('✅ All migrations complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runMigration();
