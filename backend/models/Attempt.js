const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  selectedOptions: [{
    type: String
  }],
  textAnswer: {
    type: String,
    default: null
  },
  isCorrect: {
    type: Boolean,
    default: null
  },
  score: {
    type: Number,
    default: 0
  },
  negativeScore: {
    type: Number,
    default: 0
  },
  feedback: {
    type: String,
    default: null
  }
});

const AttemptSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  status: {
    type: String,
    enum: ['in-progress', 'submitted', 'reviewed', 'time_up', 'expired'],
    default: 'in-progress'
  },
  answers: [AnswerSchema],
  totalScore: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number,
    required: true
  },
  negativeMarkingApplied: {
    type: Boolean,
    default: false
  },
  recordings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recording'
  }],
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  activities: [{
    timestamp: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }]
});

// Calculate total score when submitted
AttemptSchema.methods.calculateScore = function() {
  const positiveScore = this.answers.reduce((total, answer) => total + answer.score, 0);
  const negativeScore = this.answers.reduce((total, answer) => total + answer.negativeScore, 0);
  this.totalScore = positiveScore - negativeScore;
  return this.totalScore;
};

// Calculate score breakdown for negative marking display
AttemptSchema.methods.getScoreBreakdown = function() {
  const positiveScore = this.answers.reduce((total, answer) => total + answer.score, 0);
  const negativeScore = this.answers.reduce((total, answer) => total + answer.negativeScore, 0);
  return {
    positiveScore,
    negativeScore,
    totalScore: positiveScore - negativeScore,
    maxScore: this.maxScore,
    negativeMarkingApplied: this.negativeMarkingApplied
  };
};

module.exports = mongoose.model('Attempt', AttemptSchema);