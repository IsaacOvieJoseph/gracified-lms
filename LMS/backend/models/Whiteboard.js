const mongoose = require('mongoose');

// allow storing arbitrary stroke objects (type-specific payloads)
const whiteboardSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true, unique: true },
  strokes: { type: [mongoose.Schema.Types.Mixed], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Whiteboard', whiteboardSchema);
