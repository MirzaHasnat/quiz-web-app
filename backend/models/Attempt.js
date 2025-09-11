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
  timingMode: {
    type: String,
    enum: ['total', 'per-question'],
    default: 'total'
  },
  questionStartTimes: {
    type: Map,
    of: Date,
    default: () => new Map() // Map of questionId -> start time for per-question mode
  },
  questionTimeRemaining: {
    type: Map,
    of: Number,
    default: () => new Map() // Map of questionId -> remaining time for per-question mode
  },
  timedOutQuestions: [{
    type: mongoose.Schema.Types.ObjectId
  }], // Questions that timed out in per-question mode
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

// Calculate remaining time for current question in per-question mode
AttemptSchema.methods.getQuestionRemainingTime = function(questionId, questionTimeLimit) {
  if (this.timingMode !== 'per-question') return null;
  
  const startTime = this.questionStartTimes.get(questionId.toString());
  if (!startTime) return questionTimeLimit;
  
  const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
  return Math.max(0, questionTimeLimit - elapsed);
};

// Start timing for a question in per-question mode
AttemptSchema.methods.startQuestionTimer = function(questionId) {
  if (this.timingMode === 'per-question') {
    this.questionStartTimes.set(questionId.toString(), new Date());
  }
};

// Check if a question has timed out
AttemptSchema.methods.isQuestionTimedOut = function(questionId) {
  return this.timedOutQuestions.includes(questionId);
};

// Mark a question as timed out
AttemptSchema.methods.markQuestionTimedOut = function(questionId) {
  if (!this.timedOutQuestions.includes(questionId)) {
    this.timedOutQuestions.push(questionId);
  }
};

module.exports = mongoose.model('Attempt', AttemptSchema);