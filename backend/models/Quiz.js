const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Please add option text']
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  probability: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  }
});

const QuestionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['single-select', 'multi-select', 'free-text'],
    required: [true, 'Please specify question type']
  },
  text: {
    type: String,
    required: [true, 'Please add question text']
  },
  options: [OptionSchema],
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  points: {
    type: Number,
    default: 1
  },
  timeLimit: {
    type: Number,
    default: null, // null for total timing mode
    min: [10, 'Time limit must be at least 10 seconds'],
    max: [3600, 'Time limit cannot exceed 3600 seconds (1 hour)'],
    validate: {
      validator: function(value) {
        // Only validate if parent quiz uses per-question timing
        if (!this.parent()) return true;
        const quiz = this.parent();
        return quiz.timingMode !== 'per-question' || (value && value >= 10);
      },
      message: 'Time limit is required for per-question timing mode'
    }
  }
});

const QuizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  timingMode: {
    type: String,
    enum: ['total', 'per-question'],
    default: 'total'
  },
  duration: {
    type: Number,
    required: function() {
      return this.timingMode === 'total';
    },
    min: [1, 'Duration must be at least 1 minute'],
    max: [300, 'Duration cannot exceed 300 minutes']
  },
  isActive: {
    type: Boolean,
    default: false
  },
  showResultsImmediately: {
    type: Boolean,
    default: false
  },
  resultVisibilitySettings: {
    showQuestionDetails: {
      type: Boolean,
      default: true
    },
    showCorrectAnswers: {
      type: Boolean,
      default: true
    },
    showUserAnswers: {
      type: Boolean,
      default: true
    },
    showFeedback: {
      type: Boolean,
      default: true
    }
  },
  recordingSettings: {
    enableMicrophone: {
      type: Boolean,
      default: true
    },
    enableCamera: {
      type: Boolean,
      default: true
    },
    enableScreen: {
      type: Boolean,
      default: true
    }
  },
  negativeMarking: {
    enabled: {
      type: Boolean,
      default: false
    },
    penaltyValue: {
      type: Number,
      min: [0, 'Penalty value must be positive'],
      default: 0
    }
  },
  questions: [QuestionSchema],
  activatedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on save and validate timing mode
QuizSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Validate timing mode consistency
  try {
    this.validateTimingMode();
    next();
  } catch (error) {
    next(error);
  }
});

// Calculate max score for the quiz
QuizSchema.methods.calculateMaxScore = function() {
  return this.questions.reduce((total, question) => total + question.points, 0);
};

// Validate timing mode consistency
QuizSchema.methods.validateTimingMode = function() {
  if (this.timingMode === 'per-question') {
    // Check that all questions have time limits
    for (let question of this.questions) {
      if (!question.timeLimit || question.timeLimit < 10) {
        throw new Error(`Question "${question.text.substring(0, 50)}..." requires a time limit of at least 10 seconds for per-question timing mode`);
      }
    }
  } else if (this.timingMode === 'total') {
    // Ensure duration is set for total mode
    if (!this.duration || this.duration < 1) {
      throw new Error('Duration is required for total timing mode');
    }
  }
  return true;
};

// Calculate total time for per-question mode
QuizSchema.methods.calculateTotalQuestionTime = function() {
  if (this.timingMode === 'per-question') {
    return this.questions.reduce((total, question) => total + (question.timeLimit || 0), 0);
  }
  return this.duration * 60; // Convert minutes to seconds for total mode
};

module.exports = mongoose.model('Quiz', QuizSchema);