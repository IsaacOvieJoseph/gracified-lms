const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const scriptAccessSessionSchema = new mongoose.Schema({
    // The share token embedded in the public URL (unique per submission share)
    shareToken: {
        type: String,
        unique: true,
        required: true,
        default: () => randomUUID().replace(/-/g, '')
    },
    // What is being accessed
    submissionType: {
        type: String,
        enum: ['exam', 'assignment'],
        required: true
    },
    // For exam: ExamSubmission._id. For assignment: stored as string "{assignmentId}:{studentId}"
    submissionRef: {
        type: String
    },
    submissionRefs: {
        type: [String],
        default: []
    },
    // A human-readable group name for shared links when sharing multiple scripts
    groupName: {
        type: String,
        default: null
    },
    // Parent exam or assignment ID (for quick lookups and authority resolution)
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    // Student whose script is being shared (for display)
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    // Who is requesting access
    requesterName: {
        type: String,
        trim: true
    },
    requesterEmail: {
        type: String,
        trim: true,
        lowercase: true
    },

    // What access type this session grants
    accessType: {
        type: String,
        enum: ['view', 'grade'],
        default: 'view'
    },

    // OTP fields (OTP is hashed before storage)
    otpHash: {
        type: String
    },
    otpExpiresAt: {
        type: Date
    },

    // Access token issued after successful OTP verification
    accessToken: {
        type: String,
        sparse: true,
        index: true
    },
    accessTokenExpiresAt: {
        type: Date
    },

    // Session lifecycle
    status: {
        type: String,
        enum: ['pending_otp', 'active', 'expired', 'saved', 'discarded'],
        default: 'pending_otp'
    },

    // Who was notified (authority users that received the OTP email)
    notifiedAuthorityIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // Temporary grading data saved by the marker before session expires
    gradingSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    savedSubmissions: [{
        submissionRef: String,
        savedAt: Date
    }],
    savedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// Index for quick token lookups
scriptAccessSessionSchema.index({ shareToken: 1 });
scriptAccessSessionSchema.index({ accessToken: 1 });
scriptAccessSessionSchema.index({ parentId: 1 });
scriptAccessSessionSchema.index({ accessTokenExpiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL on access token

module.exports = mongoose.model('ScriptAccessSession', scriptAccessSessionSchema);
