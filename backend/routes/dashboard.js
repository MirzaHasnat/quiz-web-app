const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validateQuizAccess, hasActivatedQuizzes } = require('../middleware/quizAccess');
const Quiz = require('../models/Quiz');
const Attempt = require('../models/Attempt');

// All routes in this file require authentication
router.use(protect);

/**
 * @route   GET /api/dashboard/quizzes
 * @desc    Get all activated quizzes for the current user
 * @access  Private
 */
router.get('/quizzes', hasActivatedQuizzes, async (req, res, next) => {
  try {
    // Find all quizzes that are activated for the current user and are active
    const quizzes = await Quiz.find({
      activatedUsers: req.user._id,
      isActive: true
    }).select('title description duration showResultsImmediately createdAt');
    
    // Get attempt information for each quiz
    const quizzesWithAttempts = await Promise.all(quizzes.map(async (quiz) => {
      // Find the most recent attempt for this quiz by this user
      const latestAttempt = await Attempt.findOne({
        quizId: quiz._id,
        userId: req.user._id
      }).sort({ createdAt: -1 }).select('status createdAt endTime totalScore maxScore');
      
      // Return quiz with attempt info
      return {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        duration: quiz.duration,
        showResultsImmediately: quiz.showResultsImmediately,
        createdAt: quiz.createdAt,
        latestAttempt: latestAttempt || null
      };
    }));
    
    res.status(200).json({
      status: 'success',
      count: quizzesWithAttempts.length,
      data: quizzesWithAttempts
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/dashboard/quizzes/:id
 * @desc    Get details of a specific quiz for the current user
 * @access  Private
 */
router.get('/quizzes/:id', validateQuizAccess, async (req, res, next) => {
  try {
    // Quiz is already validated and available in req.quiz
    const quiz = req.quiz || await Quiz.findById(req.params.id);

    // Find all attempts for this quiz by this user
    const attempts = await Attempt.find({
      quizId: quiz._id,
      userId: req.user._id
    }).sort({ createdAt: -1 }).select('status createdAt endTime totalScore maxScore');

    // Prepare response data
    const quizData = {
      id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      duration: quiz.duration,
      showResultsImmediately: quiz.showResultsImmediately,
      createdAt: quiz.createdAt,
      attempts: attempts
    };
    
    res.status(200).json({
      status: 'success',
      data: quizData
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/dashboard/attempts
 * @desc    Get all attempts by the current user
 * @access  Private
 */
router.get('/attempts', async (req, res, next) => {
  try {
    // Find all attempts by this user
    const attempts = await Attempt.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('quizId', 'title description')
      .select('status createdAt endTime totalScore maxScore');
    
    res.status(200).json({
      status: 'success',
      count: attempts.length,
      data: attempts
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/dashboard/quizzes/:id/results
 * @desc    Get quiz results for the current user
 * @access  Private
 */
router.get('/quizzes/:id/results', validateQuizAccess, async (req, res, next) => {
  try {
    const quiz = req.quiz || await Quiz.findById(req.params.id);
    
    // Find the user's completed attempt for this quiz
    const attempt = await Attempt.findOne({
      quizId: quiz._id,
      userId: req.user._id,
      status: { $in: ['submitted', 'reviewed'] }
    }).sort({ createdAt: -1 });
    
    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'NO_COMPLETED_ATTEMPT',
        message: 'No completed attempt found for this quiz'
      });
    }
    
    // Check if results should be visible
    const hasFreeTextQuestions = quiz.questions.some(q => q.type === 'free-text');
    const resultsVisible = 
      (quiz.showResultsImmediately && !hasFreeTextQuestions) || 
      attempt.status === 'reviewed';
    
    if (!resultsVisible) {
      return res.status(403).json({
        status: 'error',
        code: 'RESULTS_NOT_AVAILABLE',
        message: 'Results are not yet available. Please check back after review.'
      });
    }
    
    // Determine what details to show based on quiz settings
    const showDetails = quiz.resultVisibilitySettings?.showQuestionDetails !== false;
    
    // Prepare response data
    const responseData = {
      quiz: {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        questions: showDetails ? quiz.questions : [],
        resultVisibilitySettings: quiz.resultVisibilitySettings || {
          showQuestionDetails: true,
          showCorrectAnswers: true,
          showUserAnswers: true,
          showFeedback: true
        }
      },
      attempt: {
        id: attempt._id,
        status: attempt.status,
        totalScore: attempt.totalScore,
        maxScore: attempt.maxScore,
        startTime: attempt.startTime,
        endTime: attempt.endTime,
        reviewedAt: attempt.reviewedAt,
        negativeMarkingApplied: attempt.negativeMarkingApplied,
        ...(attempt.negativeMarkingApplied ? attempt.getScoreBreakdown() : {}),
        answers: showDetails ? attempt.answers : []
      },
      showDetails,
      resultsVisible: true
    };
    
    res.status(200).json({
      status: 'success',
      data: responseData
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get a summary of the user's dashboard
 * @access  Private
 */
router.get('/summary', async (req, res, next) => {
  try {
    // Count available quizzes
    const availableQuizzes = await Quiz.countDocuments({
      activatedUsers: req.user._id,
      isActive: true
    });
    
    // Count completed attempts
    const completedAttempts = await Attempt.countDocuments({
      userId: req.user._id,
      status: { $in: ['submitted', 'reviewed'] }
    });
    
    // Count in-progress attempts
    const inProgressAttempts = await Attempt.countDocuments({
      userId: req.user._id,
      status: 'in-progress'
    });
    
    // Get latest attempt
    const latestAttempt = await Attempt.findOne({
      userId: req.user._id
    })
    .sort({ createdAt: -1 })
    .populate('quizId', 'title')
    .select('status createdAt endTime totalScore maxScore');
    
    res.status(200).json({
      status: 'success',
      data: {
        availableQuizzes,
        completedAttempts,
        inProgressAttempts,
        latestAttempt: latestAttempt || null
      }
    });
  } catch (err) {
    next(err);
  }
});
module.exports = router;