const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const scriptShareConfigSchema = new mongoose.Schema({
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    parentType: {
        type: String,
        enum: ['exam', 'assignment'],
        required: true
    },
    isShareable: {
        type: Boolean,
        default: false
    },
    // Default access type granted to people who use the share link
    defaultAccessType: {
        type: String,
        enum: ['view', 'grade'],
        default: 'view'
    },
    // How long (minutes) the requester has to enter the OTP after it is sent
    otpLifespanMinutes: {
        type: Number,
        default: 30,
        min: 5,
        max: 1440 // 24 hours max
    },
    // How long (minutes) the access session lasts after OTP is successfully verified
    accessDurationMinutes: {
        type: Number,
        default: 60,
        min: 5,
        max: 2880 // 48 hours max
    },
    // Optional: a specific user assigned as the marker (receives OTP emails preferentially)
    assignedMarkerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    configuredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

// Compound unique index – only one config per parent document
scriptShareConfigSchema.index({ parentId: 1, parentType: 1 }, { unique: true });

module.exports = mongoose.model('ScriptShareConfig', scriptShareConfigSchema);
