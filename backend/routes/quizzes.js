const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Quiz = require('../models/Quiz');
const resultVisibilityController = require('../controllers/resultVisibilityController');

// All routes in this file require authentication
router.use(protect);

// @route   GET /api/quizzes
// @desc    Get all quizzes (filtered by role)
// @access  Private
router.get('/', async (req, res, next) => {
  try {
    let query = {};
    let sortOptions = {};
    
    // Build query based on user role
    if (req.user.role === 'admin') {
      // Admins can see all quizzes with optional filters
      if (req.query.isActive !== undefined) {
        query.isActive = req.query.isActive === 'true';
      }
      
      // Add search functionality
      if (req.query.search) {
        query.$or = [
          { title: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } }
        ];
      }
    } else {
      // Regular users can only see quizzes activated for them
      query = {
        activatedUsers: req.user._id,
        isActive: true
      };
    }
    
    // Handle sorting
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    sortOptions[sortBy] = sortOrder;
    
    // Handle pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const total = await Quiz.countDocuments(query);
    
    // Execute query with pagination and sorting
    const quizzes = await Quiz.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username')
      .lean();
    
    res.status(200).json({
      status: 'success',
      count: total,
      data: quizzes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/quizzes
// @desc    Create a quiz
// @access  Private/Admin
router.post('/', [
  authorize('admin'),
  check('title').notEmpty().withMessage('Title is required'),
  check('description').notEmpty().withMessage('Description is required'),
  check('duration').isNumeric().withMessage('Duration must be a number'),
  check('recordingSettings.enableMicrophone').optional().isBoolean()
    .withMessage('enableMicrophone must be a boolean'),
  check('recordingSettings.enableCamera').optional().isBoolean()
    .withMessage('enableCamera must be a boolean'),
  check('recordingSettings.enableScreen').optional().isBoolean()
    .withMessage('enableScreen must be a boolean'),
  check('negativeMarking.enabled').optional().isBoolean()
    .withMessage('negativeMarking.enabled must be a boolean'),
  check('negativeMarking.penaltyValue').optional().isFloat({ min: 0 })
    .withMessage('negativeMarking.penaltyValue must be a positive number'),
  validate
], async (req, res, next) => {
  try {
    // Add user to request body
    req.body.createdBy = req.user._id;
    
    const quiz = await Quiz.create(req.body);
    
    res.status(201).json({
      status: 'success',
      data: quiz
    });
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/quizzes/:id
// @desc    Get single quiz
// @access  Private
router.get('/:id', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    // Check if user has access to this quiz
    if (req.user.role !== 'admin' && 
        (!quiz.activatedUsers.includes(req.user._id) || !quiz.isActive)) {
      return res.status(403).json({
        status: 'error',
        code: 'QUIZ_ACCESS_DENIED',
        message: 'You do not have access to this quiz'
      });
    }

    if (req.user.role !== 'admin') {
      // For regular users, remove correct answers from questions for security
      const sanitizedQuestions = quiz.questions.map(question => {
        const sanitizedQuestion = question.toObject();
        if (sanitizedQuestion.options) {
          sanitizedQuestion.options = sanitizedQuestion.options.map(option => ({
            _id: option._id,
            text: option.text,
            probability: option.probability, // Keep probability for multi-select if needed
            isCorrect: null
            // isCorrect is intentionally removed for security for non-admin users
          }));
        }
        return sanitizedQuestion;
      });
      quiz.questions = sanitizedQuestions;
    }


    res.status(200).json({
      status: 'success',
      data: quiz
    });
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/quizzes/:id
// @desc    Update quiz
// @access  Private/Admin
router.put('/:id', [
  authorize('admin'),
  check('title').optional().notEmpty().withMessage('Title is required'),
  check('description').optional().notEmpty().withMessage('Description is required'),
  check('duration').optional().isNumeric().withMessage('Duration must be a number'),
  check('recordingSettings.enableMicrophone').optional().isBoolean()
    .withMessage('enableMicrophone must be a boolean'),
  check('recordingSettings.enableCamera').optional().isBoolean()
    .withMessage('enableCamera must be a boolean'),
  check('recordingSettings.enableScreen').optional().isBoolean()
    .withMessage('enableScreen must be a boolean'),
  check('negativeMarking.enabled').optional().isBoolean()
    .withMessage('negativeMarking.enabled must be a boolean'),
  check('negativeMarking.penaltyValue').optional().isFloat({ min: 0 })
    .withMessage('negativeMarking.penaltyValue must be a positive number'),
  validate
], async (req, res, next) => {
  try {
    let quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    // Check if negative marking settings are being changed
    const negativeMarkingChanged = 
      (req.body.negativeMarking?.enabled !== undefined && 
       req.body.negativeMarking.enabled !== quiz.negativeMarking?.enabled) ||
      (req.body.negativeMarking?.penaltyValue !== undefined && 
       req.body.negativeMarking.penaltyValue !== quiz.negativeMarking?.penaltyValue);

    quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    // If negative marking settings changed, recalculate scores for all attempts
    if (negativeMarkingChanged) {
      const Attempt = require('../models/Attempt');
      
      // Get all attempts for this quiz that are submitted or reviewed
      const attempts = await Attempt.find({
        quizId: quiz._id,
        status: { $in: ['submitted', 'reviewed'] }
      });
      
      let updatedCount = 0;
      
      // Process each attempt
      for (const attempt of attempts) {
        let scoreChanged = false;
        
        // Recalculate negative scores for each answer
        for (const answer of attempt.answers) {
          const question = quiz.questions.id(answer.questionId);
          
          if (!question) continue;
          
          let newNegativeScore = 0;
          
          // Apply negative marking if enabled and answer is incorrect
          if (quiz.negativeMarking.enabled && answer.isCorrect === false) {
            // For single-select and multi-select questions
            if (['single-select', 'multi-select'].includes(question.type)) {
              newNegativeScore = quiz.negativeMarking.penaltyValue;
            }
          }
          
          // Update if negative score changed
          if (answer.negativeScore !== newNegativeScore) {
            answer.negativeScore = newNegativeScore;
            scoreChanged = true;
          }
        }
        
        // Update negative marking applied flag
        const newNegativeMarkingApplied = quiz.negativeMarking.enabled;
        if (attempt.negativeMarkingApplied !== newNegativeMarkingApplied) {
          attempt.negativeMarkingApplied = newNegativeMarkingApplied;
          scoreChanged = true;
        }
        
        // Recalculate total score if anything changed
        if (scoreChanged) {
          attempt.calculateScore();
          await attempt.save();
          updatedCount++;
        }
      }
      
      // Add recalculation info to response
      quiz._doc.scoresRecalculated = {
        attemptsProcessed: attempts.length,
        attemptsUpdated: updatedCount
      };
    }

    res.status(200).json({
      status: 'success',
      data: quiz
    });
  } catch (err) {
    next(err);
  }
});

// @route   DELETE /api/quizzes/:id
// @desc    Delete quiz
// @access  Private/Admin
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    await Quiz.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: 'success',
      data: {}
    });
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/quizzes/:id/activate
// @desc    Activate/deactivate quiz for users
// @access  Private/Admin
router.put('/:id/activate', authorize('admin'), async (req, res, next) => {
  try {
    const { userId, activate } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_FIELDS',
        message: 'Please provide userId field'
      });
    }
    
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    // Update activated users
    if (activate) {
      // Add user if not already in the list
      if (!quiz.activatedUsers.includes(userId)) {
        quiz.activatedUsers.push(userId);
      }
    } else {
      // Remove user from the list
      quiz.activatedUsers = quiz.activatedUsers.filter(
        id => id.toString() !== userId
      );
    }
    
    await quiz.save();

    res.status(200).json({
      status: 'success',
      data: quiz
    });
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/quizzes/:id/questions
// @desc    Get all questions for a quiz
// @access  Private
router.get('/:id/questions', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    // Check if user has access to this quiz
    if (req.user.role !== 'admin' && 
        (!quiz.activatedUsers.includes(req.user._id) || !quiz.isActive)) {
      return res.status(403).json({
        status: 'error',
        code: 'QUIZ_ACCESS_DENIED',
        message: 'You do not have access to this quiz'
      });
    }

    // For admin users, return full question data including correct answers
    // For regular users, remove isCorrect from options for security
    const sanitizedQuestions = quiz.questions.map(question => {
      const sanitizedQuestion = question.toObject();
      if (sanitizedQuestion.options && req.user.role !== 'admin') {
        sanitizedQuestion.options = sanitizedQuestion.options.map(option => ({
          _id: option._id,
          text: option.text,
          probability: option.probability // Keep probability for multi-select if needed
          // isCorrect is intentionally removed for security for non-admin users
        }));
      }
      return sanitizedQuestion;
    });

    res.status(200).json({
      status: 'success',
      count: sanitizedQuestions.length,
      data: sanitizedQuestions
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/quizzes/:id/questions
// @desc    Add a question to a quiz
// @access  Private/Admin
router.post('/:id/questions', [
  authorize('admin'),
  check('type').isIn(['single-select', 'multi-select', 'free-text'])
    .withMessage('Question type must be single-select, multi-select, or free-text'),
  check('text').notEmpty().withMessage('Question text is required'),
  check('points').isNumeric().withMessage('Points must be a number'),
  check('options').custom((options, { req }) => {
    // Options are required for single-select and multi-select questions
    if (['single-select', 'multi-select'].includes(req.body.type)) {
      if (!Array.isArray(options) || options.length < 2) {
        throw new Error('Multiple choice questions require at least 2 options');
      }
      
      // Check if each option has text
      const validOptions = options.every(option => option.text && option.text.trim() !== '');
      if (!validOptions) {
        throw new Error('All options must have text');
      }
      
      // For single-select, exactly one option must be marked as correct
      if (req.body.type === 'single-select') {
        const correctOptions = options.filter(option => option.isCorrect);
        if (correctOptions.length !== 1) {
          throw new Error('Single-select questions must have exactly one correct option');
        }
      }
      
      // For multi-select, at least one option must be marked as correct
      if (req.body.type === 'multi-select') {
        const correctOptions = options.filter(option => option.isCorrect);
        if (correctOptions.length < 1) {
          throw new Error('Multi-select questions must have at least one correct option');
        }
      }
    }
    return true;
  }),
  validate
], async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    // Create the new question
    const newQuestion = {
      type: req.body.type,
      text: req.body.text,
      points: req.body.points || 1,
      options: req.body.options || []
    };

    // For free-text questions, store correctAnswer if provided
    if (req.body.type === 'free-text' && req.body.correctAnswer) {
      newQuestion.correctAnswer = req.body.correctAnswer;
    }

    // Add the question to the quiz
    quiz.questions.push(newQuestion);
    await quiz.save();

    res.status(201).json({
      status: 'success',
      data: quiz.questions[quiz.questions.length - 1]
    });
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/quizzes/:id/questions/:qid
// @desc    Update a question
// @access  Private/Admin
router.put('/:id/questions/:qid', [
  authorize('admin'),
  check('type').optional().isIn(['single-select', 'multi-select', 'free-text'])
    .withMessage('Question type must be single-select, multi-select, or free-text'),
  check('text').optional().notEmpty().withMessage('Question text is required'),
  check('points').optional().isNumeric().withMessage('Points must be a number'),
  check('options').optional().custom((options, { req }) => {
    // If type is being updated or options are being updated for a multiple choice question
    if (req.body.type && ['single-select', 'multi-select'].includes(req.body.type) || 
        (options && req.body.type === undefined)) {
      
      if (!Array.isArray(options) || options.length < 2) {
        throw new Error('Multiple choice questions require at least 2 options');
      }
      
      // Check if each option has text
      const validOptions = options.every(option => option.text && option.text.trim() !== '');
      if (!validOptions) {
        throw new Error('All options must have text');
      }
      
      // For single-select, exactly one option must be marked as correct
      if (req.body.type === 'single-select' || 
          (req.body.type === undefined && req.quiz && req.quiz.questions.id(req.params.qid).type === 'single-select')) {
        const correctOptions = options.filter(option => option.isCorrect);
        if (correctOptions.length !== 1) {
          throw new Error('Single-select questions must have exactly one correct option');
        }
      }
      
      // For multi-select, at least one option must be marked as correct
      if (req.body.type === 'multi-select' || 
          (req.body.type === undefined && req.quiz && req.quiz.questions.id(req.params.qid).type === 'multi-select')) {
        const correctOptions = options.filter(option => option.isCorrect);
        if (correctOptions.length < 1) {
          throw new Error('Multi-select questions must have at least one correct option');
        }
      }
    }
    return true;
  }),
  validate
], async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    // Find the question
    const question = quiz.questions.id(req.params.qid);
    
    if (!question) {
      return res.status(404).json({
        status: 'error',
        code: 'QUESTION_NOT_FOUND',
        message: 'Question not found'
      });
    }

    // Update question fields
    if (req.body.type) question.type = req.body.type;
    if (req.body.text) question.text = req.body.text;
    if (req.body.points !== undefined) question.points = req.body.points;
    if (req.body.options) question.options = req.body.options;
    if (req.body.correctAnswer !== undefined) question.correctAnswer = req.body.correctAnswer;

    await quiz.save();

    res.status(200).json({
      status: 'success',
      data: question
    });
  } catch (err) {
    next(err);
  }
});

// @route   DELETE /api/quizzes/:id/questions/:qid
// @desc    Delete a question
// @access  Private/Admin
router.delete('/:id/questions/:qid', authorize('admin'), async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    // Find the question
    const question = quiz.questions.id(req.params.qid);
    
    if (!question) {
      return res.status(404).json({
        status: 'error',
        code: 'QUESTION_NOT_FOUND',
        message: 'Question not found'
      });
    }

    // Remove the question (using pull for newer Mongoose versions)
    quiz.questions.pull(question._id);
    await quiz.save();

    res.status(200).json({
      status: 'success',
      data: {}
    });
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/quizzes/:id/reorder
// @desc    Reorder questions in a quiz
// @access  Private/Admin
router.put('/:id/reorder', [
  authorize('admin'),
  check('questionIds').isArray().withMessage('Question IDs must be an array'),
  validate
], async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    const { questionIds } = req.body;
    
    // Verify all question IDs exist in the quiz
    const allQuestionsExist = questionIds.every(id => 
      quiz.questions.some(question => question._id.toString() === id)
    );
    
    if (!allQuestionsExist || questionIds.length !== quiz.questions.length) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_QUESTION_IDS',
        message: 'All question IDs must exist in the quiz and all questions must be included'
      });
    }

    // Create a new array of questions in the specified order
    const reorderedQuestions = questionIds.map(id => 
      quiz.questions.find(question => question._id.toString() === id)
    );
    
    // Replace the questions array
    quiz.questions = reorderedQuestions;
    await quiz.save();

    res.status(200).json({
      status: 'success',
      data: quiz.questions
    });
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/quizzes/:id/result-visibility
// @desc    Update result visibility settings for a quiz
// @access  Private/Admin
router.put('/:id/result-visibility', authorize('admin'), resultVisibilityController.updateResultVisibility);

// @route   GET /api/quizzes/:id/result-visibility
// @desc    Get result visibility status for a quiz
// @access  Private/Admin
router.get('/:id/result-visibility', authorize('admin'), resultVisibilityController.getResultVisibility);

// @route   GET /api/quizzes/:id/recording-requirements
// @desc    Get recording requirements for a specific quiz
// @access  Private
router.get('/:id/recording-requirements', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id).select('recordingSettings title');
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    // Check if user has access to this quiz (for non-admin users)
    if (req.user.role !== 'admin') {
      const fullQuiz = await Quiz.findById(req.params.id);
      if (!fullQuiz.activatedUsers.includes(req.user._id) || !fullQuiz.isActive) {
        return res.status(403).json({
          status: 'error',
          code: 'QUIZ_ACCESS_DENIED',
          message: 'You do not have access to this quiz'
        });
      }
    }

    // Return recording requirements
    const recordingRequirements = {
      enableMicrophone: quiz.recordingSettings?.enableMicrophone ?? true,
      enableCamera: quiz.recordingSettings?.enableCamera ?? true,
      enableScreen: quiz.recordingSettings?.enableScreen ?? true
    };

    res.status(200).json({
      status: 'success',
      data: {
        quizId: quiz._id,
        quizTitle: quiz.title,
        recordingRequirements
      }
    });
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/quizzes/:id/negative-marking
// @desc    Get negative marking settings for a specific quiz
// @access  Private
router.get('/:id/negative-marking', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id).select('negativeMarking title');
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    // Check if user has access to this quiz (for non-admin users)
    if (req.user.role !== 'admin') {
      const fullQuiz = await Quiz.findById(req.params.id);
      if (!fullQuiz.activatedUsers.includes(req.user._id) || !fullQuiz.isActive) {
        return res.status(403).json({
          status: 'error',
          code: 'QUIZ_ACCESS_DENIED',
          message: 'You do not have access to this quiz'
        });
      }
    }

    // Return negative marking settings
    const negativeMarkingSettings = {
      enabled: quiz.negativeMarking?.enabled ?? false,
      penaltyValue: quiz.negativeMarking?.penaltyValue ?? 0
    };

    res.status(200).json({
      status: 'success',
      data: {
        quizId: quiz._id,
        quizTitle: quiz.title,
        negativeMarkingSettings
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;