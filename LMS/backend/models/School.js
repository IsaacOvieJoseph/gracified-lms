const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  classes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
  }],
  logoUrl: {
    type: String,
    default: null
  },
  shortCode: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  slug: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    lowercase: true
  },
}, { timestamps: true });

// Generate unique shortCode and slug before saving
schoolSchema.pre('save', async function (next) {
  // Generate shortCode
  if (!this.shortCode) {
    const crypto = require('crypto');
    const generateCode = () => crypto.randomBytes(4).toString('hex');
    let code = generateCode();

    let exists = await this.constructor.findOne({ shortCode: code });
    while (exists) {
      code = generateCode();
      exists = await this.constructor.findOne({ shortCode: code });
    }
    this.shortCode = code;
  }

  // Generate slug from name
  if (this.isModified('name') || !this.slug) {
    const generateSlug = (name) => {
      return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    };

    let slug = generateSlug(this.name);
    let baseSlug = slug;
    let counter = 1;

    // Ensure slug uniqueness
    let exists = await this.constructor.findOne({ slug, _id: { $ne: this._id } });
    while (exists) {
      slug = `${baseSlug}-${counter}`;
      counter++;
      exists = await this.constructor.findOne({ slug, _id: { $ne: this._id } });
    }
    this.slug = slug;
  }

  next();
});

const School = mongoose.model('School', schoolSchema);

module.exports = School;

