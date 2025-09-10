const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const attemptController = require('../controllers/attemptController');
const resultVisibilityController = require('../controllers/resultVisibilityController');
const Attempt = require('../models/Attempt');
const Quiz = require('../models/Quiz');

// All routes in this file require authentication
router.use(protect);

// @route   GET /api/attempts
// @desc    Get all attempts with filtering and pagination
// @access  Private
router.get('/', attemptController.getAttempts);

// @route   GET /api/attempts/check/:quizId
// @desc    Check for existing attempt for a quiz
// @access  Private
router.get('/check/:quizId', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);

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

    // Check for existing attempts
    const existingAttempt = await Attempt.findOne({
      userId: req.user._id,
      quizId: quiz._id
    }).sort({ createdAt: -1 }); // Get the most recent attempt

    let canStart = true;
    let canResume = false;
    let attemptStatus = null;
    let attemptId = null;

    if (existingAttempt) {
      attemptId = existingAttempt._id;
      attemptStatus = existingAttempt.status;
      
      if (existingAttempt.status === 'in-progress') {
        // Check if time has expired
        const timeElapsed = (Date.now() - existingAttempt.startTime) / (1000 * 60); // minutes
        if (timeElapsed >= quiz.duration) {
          // Time expired, mark as expired but don't allow new attempt
          existingAttempt.status = 'expired';
          existingAttempt.endTime = new Date(existingAttempt.startTime.getTime() + (quiz.duration * 60 * 1000));
          await existingAttempt.save();
          canStart = false;
          canResume = false;
          attemptStatus = 'expired';
        } else {
          // Can resume
          canStart = false;
          canResume = true;
        }
      } else if (existingAttempt.status === 'submitted' || existingAttempt.status === 'reviewed' || existingAttempt.status === 'time_up') {
        // Already completed
        canStart = false;
        canResume = false;
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        canStart,
        canResume,
        attemptStatus,
        attemptId,
        remainingTime: canResume ? Math.max(0, quiz.duration - Math.floor((Date.now() - existingAttempt.startTime) / (1000 * 60))) : null,
        quiz: {
          id: quiz._id,
          title: quiz.title,
          duration: quiz.duration,

        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/attempts/start/:quizId
// @desc    Start quiz attempt
// @access  Private
router.post('/start/:quizId', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);

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

    // Check if user already has an in-progress attempt
    const existingAttempt = await Attempt.findOne({
      userId: req.user._id,
      quizId: quiz._id,
      status: 'in-progress'
    });

    if (existingAttempt) {
      return res.status(400).json({
        status: 'error',
        code: 'ATTEMPT_IN_PROGRESS',
        message: 'You already have an in-progress attempt for this quiz'
      });
    }

    // Create new attempt
    const attempt = await Attempt.create({
      quizId: quiz._id,
      userId: req.user._id,
      maxScore: quiz.calculateMaxScore()
    });

    res.status(201).json({
      status: 'success',
      data: attempt
    });
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/attempts/resume/:attemptId
// @desc    Resume quiz attempt
// @access  Private
router.get('/resume/:attemptId', async (req, res, next) => {
  try {
    const attempt = await Attempt.findOne({
      _id: req.params.attemptId,
      userId: req.user._id,
      status: 'in-progress'
    }).populate('quizId');

    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found or already completed'
      });
    }

    // Check if time has expired
    const timeElapsed = (Date.now() - attempt.startTime) / (1000 * 60); // minutes
    if (timeElapsed >= attempt.quizId.duration) {
      // Time expired, mark as expired
      attempt.status = 'expired';
      attempt.endTime = new Date(attempt.startTime.getTime() + (attempt.quizId.duration * 60 * 1000));
      await attempt.save();
      
      return res.status(400).json({
        status: 'error',
        code: 'ATTEMPT_EXPIRED',
        message: 'Quiz time has expired'
      });
    }

    // Calculate remaining time
    const remainingTime = (attempt.quizId.duration * 60) - (timeElapsed * 60); // seconds

    res.status(200).json({
      status: 'success',
      data: {
        attempt,
        remainingTime: Math.max(0, Math.floor(remainingTime))
      }
    });
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/attempts/save/:attemptId
// @desc    Save answers during quiz (auto-save)
// @access  Private
router.put('/save/:attemptId', async (req, res, next) => {
  try {
    const { answers } = req.body;

    if (!answers) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_FIELDS',
        message: 'Please provide answers'
      });
    }

    // Find attempt
    const attempt = await Attempt.findOne({
      _id: req.params.attemptId,
      userId: req.user._id,
      status: 'in-progress'
    });

    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found or already submitted'
      });
    }

    // Update answers (don't grade yet, just save)
    attempt.answers = answers.map(answer => ({
      questionId: answer.questionId,
      selectedOptions: answer.selectedOptions || [],
      textAnswer: answer.textAnswer || '',
      isCorrect: null, // Don't grade during auto-save
      score: 0, // Don't calculate score during auto-save
      feedback: ''
    }));

    // Update the updatedAt timestamp
    attempt.updatedAt = Date.now();
    
    await attempt.save();

    res.status(200).json({
      status: 'success',
      message: 'Answers saved successfully'
    });
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/attempts/submit/:quizId/:attemptId
// @desc    Submit quiz attempt
// @access  Private
router.put('/submit/:quizId/:attemptId', async (req, res, next) => {
  try {
    const { answers, timeExpired } = req.body;

    if (!answers) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_FIELDS',
        message: 'Please provide answers'
      });
    }

    // Find attempt
    const attempt = await Attempt.findOne({
      _id: req.params.attemptId,
      quizId: req.params.quizId,
      userId: req.user._id,
      status: 'in-progress'
    }).populate('recordings');

    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found or already submitted'
      });
    }

    // Get quiz for answer validation
    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    // Process answers
    attempt.answers = answers.map(answer => {
      const question = quiz.questions.id(answer.questionId);

      if (!question) {
        return answer;
      }

      // Auto-grade if possible
      if (question.type !== 'free-text') {
        if (question.type === 'single-select') {
          // For single-select, check if the selected option is correct
          const selectedOption = question.options.find(
            opt => opt._id.toString() === answer.selectedOptions[0]
          );

          answer.isCorrect = selectedOption && selectedOption.isCorrect;
          answer.score = answer.isCorrect ? question.points : 0;
          
          // Apply negative marking if enabled and answer is incorrect
          if (!answer.isCorrect && quiz.negativeMarking?.enabled) {
            answer.negativeScore = quiz.negativeMarking.penaltyValue;
          } else {
            answer.negativeScore = 0;
          }
        } else if (question.type === 'multi-select') {
          // For multi-select, check if all correct options are selected and no incorrect ones
          const correctOptionIds = question.options
            .filter(opt => opt.isCorrect)
            .map(opt => opt._id.toString());

          const selectedCorrect = answer.selectedOptions.every(
            id => correctOptionIds.includes(id)
          );

          const allCorrectSelected = correctOptionIds.every(
            id => answer.selectedOptions.includes(id)
          );

          answer.isCorrect = selectedCorrect && allCorrectSelected;
          answer.score = answer.isCorrect ? question.points : 0;
          
          // Apply negative marking if enabled and answer is incorrect
          if (!answer.isCorrect && quiz.negativeMarking?.enabled) {
            answer.negativeScore = quiz.negativeMarking.penaltyValue;
          } else {
            answer.negativeScore = 0;
          }
        }
      } else {
        // For free-text questions, initialize negativeScore to 0
        answer.negativeScore = 0;
      }

      return answer;
    });

    // Update attempt status based on whether time expired
    attempt.status = timeExpired ? 'time_up' : 'submitted';
    attempt.endTime = Date.now();
    
    // Store whether negative marking was applied
    attempt.negativeMarkingApplied = quiz.negativeMarking?.enabled || false;

    // Calculate score for auto-graded questions
    attempt.calculateScore();

    // Stop all active recordings
    const Recording = require('../models/Recording');

    // Find all active recordings for this attempt
    if (attempt.recordings && attempt.recordings.length > 0) {
      const recordingPromises = attempt.recordings
        .filter(recording => recording.status === 'recording')
        .map(recording => {
          recording.endTime = Date.now();
          recording.status = 'processing';
          return recording.save();
        });

      // Wait for all recordings to be updated
      if (recordingPromises.length > 0) {
        await Promise.all(recordingPromises);
      }
    }

    // Save attempt
    await attempt.save();

    // Determine what to return based on quiz settings
    let responseData = {
      id: attempt._id,
      status: attempt.status,
      endTime: attempt.endTime
    };

    // Add score if results should be shown immediately and all questions are auto-graded
    const hasManualGradingQuestions = quiz.questions.some(q => q.type === 'free-text');

    if (quiz.showResultsImmediately && !hasManualGradingQuestions) {
      responseData.totalScore = attempt.totalScore;
      responseData.maxScore = attempt.maxScore;
      responseData.negativeMarkingApplied = attempt.negativeMarkingApplied;
      
      // Add score breakdown if negative marking was applied
      if (attempt.negativeMarkingApplied) {
        const scoreBreakdown = attempt.getScoreBreakdown();
        responseData.positiveScore = scoreBreakdown.positiveScore;
        responseData.negativeScore = scoreBreakdown.negativeScore;
      }
    }

    res.status(200).json({
      status: 'success',
      data: responseData
    });
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/attempts/stats
// @desc    Get quiz attempts statistics
// @access  Private/Admin
router.get('/stats', authorize('admin'), attemptController.getAttemptStats);

// @route   GET /api/attempts/pending-review
// @desc    Get attempts requiring review
// @access  Private/Admin
router.get('/pending-review', authorize('admin'), resultVisibilityController.getPendingReviews);

// @route   GET /api/attempts/:id
// @desc    Get attempt details with full quiz data
// @access  Private
router.get('/:id', attemptController.getAttemptDetails);

// @route   POST /api/attempts/validate/:quizId/:attemptId
// @desc    Validate quiz answers before submission
// @access  Private
router.post('/validate/:quizId/:attemptId', async (req, res, next) => {
  try {
    const { answers } = req.body;

    if (!answers) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_FIELDS',
        message: 'Please provide answers'
      });
    }

    // Find attempt
    const attempt = await Attempt.findOne({
      _id: req.params.attemptId,
      quizId: req.params.quizId,
      userId: req.user._id,
      status: 'in-progress'
    });

    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found or already submitted'
      });
    }

    // Get quiz for answer validation
    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    // Validate answers
    const validationResults = answers.map(answer => {
      const question = quiz.questions.id(answer.questionId);

      if (!question) {
        return {
          questionId: answer.questionId,
          valid: false,
          error: 'Question not found'
        };
      }

      // Validate based on question type
      if (question.type === 'single-select') {
        // Single-select should have exactly one option selected
        if (!answer.selectedOptions || answer.selectedOptions.length !== 1) {
          return {
            questionId: answer.questionId,
            valid: false,
            error: 'Single-select questions require exactly one selected option'
          };
        }

        // Check if selected option exists in question
        const optionExists = question.options.some(
          opt => opt._id.toString() === answer.selectedOptions[0]
        );

        if (!optionExists) {
          return {
            questionId: answer.questionId,
            valid: false,
            error: 'Selected option does not exist'
          };
        }
      } else if (question.type === 'multi-select') {
        // Multi-select should have at least one option selected
        if (!answer.selectedOptions || answer.selectedOptions.length === 0) {
          return {
            questionId: answer.questionId,
            valid: false,
            error: 'Multi-select questions require at least one selected option'
          };
        }

        // Check if all selected options exist in question
        const allOptionsExist = answer.selectedOptions.every(optionId =>
          question.options.some(opt => opt._id.toString() === optionId)
        );

        if (!allOptionsExist) {
          return {
            questionId: answer.questionId,
            valid: false,
            error: 'One or more selected options do not exist'
          };
        }
      } else if (question.type === 'free-text') {
        // Free-text should have a non-empty text answer
        if (!answer.textAnswer || answer.textAnswer.trim() === '') {
          return {
            questionId: answer.questionId,
            valid: false,
            error: 'Free-text questions require a non-empty answer'
          };
        }
      }

      return {
        questionId: answer.questionId,
        valid: true
      };
    });

    // Check if all questions are answered
    const allQuestionsAnswered = quiz.questions.every(question =>
      answers.some(answer => answer.questionId.toString() === question._id.toString())
    );

    res.status(200).json({
      status: 'success',
      data: {
        validationResults,
        allQuestionsAnswered,
        isValid: validationResults.every(result => result.valid) && allQuestionsAnswered
      }
    });
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/attempts/:id/review
// @desc    Review and update attempt scores and feedback
// @access  Private/Admin
router.put('/:id/review', authorize('admin'), attemptController.reviewAttempt);

// @route   PUT /api/attempts/:id/answers/:answerId/feedback
// @desc    Update feedback for a specific answer
// @access  Private/Admin
router.put('/:id/answers/:answerId/feedback', authorize('admin'), attemptController.updateAnswerFeedback);

// @route   PUT /api/attempts/batch
// @desc    Batch update multiple attempts
// @access  Private/Admin
router.put('/batch', authorize('admin'), attemptController.batchUpdateAttempts);

// @route   PUT /api/attempts/recalculate-scores/:quizId
// @desc    Recalculate scores for all attempts of a quiz with negative marking
// @access  Private/Admin
router.put('/recalculate-scores/:quizId', authorize('admin'), attemptController.recalculateScoresForQuiz);

// @route   PUT /api/attempts/:id/complete-review
// @desc    Complete manual review for an attempt
// @access  Private/Admin
router.put('/:id/complete-review', authorize('admin'), resultVisibilityController.completeReview);

// @route   PUT /api/attempts/:id/unreview
// @desc    Unreview an attempt (mark as submitted)
// @access  Private/Admin
router.put('/:id/unreview', authorize('admin'), resultVisibilityController.unreviewAttempt);

// @route   GET /api/attempts/:id/result-visibility
// @desc    Check if results are visible for a specific attempt
// @access  Private
router.get('/:id/result-visibility', resultVisibilityController.checkResultVisibility);

// @route   POST /api/attempts/:id/activities
// @desc    Log user activities during quiz attempt
// @access  Private
router.post('/:id/activities', async (req, res, next) => {
  try {
    const { activities } = req.body;
    const attemptId = req.params.id;

    if (!activities || !Array.isArray(activities)) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_DATA',
        message: 'Activities must be an array'
      });
    }

    // Find the attempt and verify ownership
    const attempt = await Attempt.findOne({
      _id: attemptId,
      userId: req.user._id
    });

    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found'
      });
    }

    // Initialize activities array if it doesn't exist
    if (!attempt.activities) {
      attempt.activities = [];
    }

    // Add new activities
    attempt.activities.push(...activities);

    // Save the attempt
    await attempt.save();

    res.status(200).json({
      status: 'success',
      message: `Logged ${activities.length} activities`,
      data: {
        totalActivities: attempt.activities.length
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;