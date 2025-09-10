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
  duration: {
    type: Number,
    required: [true, 'Please add duration in minutes']
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

// Update the updatedAt field on save
QuizSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Calculate max score for the quiz
QuizSchema.methods.calculateMaxScore = function() {
  return this.questions.reduce((total, question) => total + question.points, 0);
};

module.exports = mongoose.model('Quiz', QuizSchema);