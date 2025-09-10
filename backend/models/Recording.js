const mongoose = require('mongoose');

const RecordingSchema = new mongoose.Schema({
  attemptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attempt',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['screen', 'camera', 'microphone'],
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  duration: {
    type: Number,
    default: 0
  },
  fileUrl: {
    type: String,
    default: null
  },
  fileSize: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['recording', 'processing', 'available', 'error'],
    default: 'recording'
  }
});

// Calculate duration when recording ends
RecordingSchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.round((this.endTime - this.startTime) / 1000);
  }
  next();
});

module.exports = mongoose.model('Recording', RecordingSchema);