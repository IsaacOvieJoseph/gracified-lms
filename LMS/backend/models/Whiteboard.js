const mongoose = require('mongoose');

const strokeSchema = new mongoose.Schema({
  prev: { x: Number, y: Number },
  curr: { x: Number, y: Number },
  color: { type: String, default: '#000' },
  width: { type: Number, default: 2 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  ts: { type: Date, default: Date.now }
}, { _id: false });

const whiteboardSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true, unique: true },
  strokes: { type: [strokeSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Whiteboard', whiteboardSchema);
