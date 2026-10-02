const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    callSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CallSession', required: true },
    attendedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Prevent duplicate attendance for the same session
attendanceSchema.index({ studentId: 1, callSessionId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
