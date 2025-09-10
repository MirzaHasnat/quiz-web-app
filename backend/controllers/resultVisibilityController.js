const Quiz = require('../models/Quiz');
const Attempt = require('../models/Attempt');

/**
 * @desc    Update result visibility settings for a quiz
 * @route   PUT /api/quizzes/:id/result-visibility
 * @access  Private/Admin
 */
exports.updateResultVisibility = async (req, res, next) => {
  try {
    const { showResultsImmediately } = req.body;
    
    if (showResultsImmediately === undefined) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_FIELDS',
        message: 'Please provide showResultsImmediately field (true/false)'
      });
    }
    
    // Find quiz
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }
    
    // Update visibility setting
    quiz.showResultsImmediately = showResultsImmediately;
    await quiz.save();
    
    res.status(200).json({
      status: 'success',
      message: `Result visibility updated successfully`,
      data: {
        quizId: quiz._id,
        showResultsImmediately: quiz.showResultsImmediately
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get result visibility status for a quiz
 * @route   GET /api/quizzes/:id/result-visibility
 * @access  Private/Admin
 */
exports.getResultVisibility = async (req, res, next) => {
  try {
    // Find quiz
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }
    
    // Check if quiz has free text questions that require manual review
    const hasFreeTextQuestions = quiz.questions.some(q => q.type === 'free-text');
    
    res.status(200).json({
      status: 'success',
      data: {
        quizId: quiz._id,
        showResultsImmediately: quiz.showResultsImmediately,
        hasFreeTextQuestions,
        requiresManualReview: hasFreeTextQuestions || !quiz.showResultsImmediately
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Complete manual review for an attempt
 * @route   PUT /api/attempts/:id/complete-review
 * @access  Private/Admin
 */
exports.completeReview = async (req, res, next) => {
  try {
    // Find attempt
    const attempt = await Attempt.findById(req.params.id);
    
    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found'
      });
    }
    
    // Check if attempt is already reviewed
    if (attempt.status === 'reviewed') {
      return res.status(400).json({
        status: 'error',
        code: 'ALREADY_REVIEWED',
        message: 'This attempt has already been reviewed'
      });
    }
    
    // Update attempt status
    attempt.status = 'reviewed';
    attempt.reviewedBy = req.user._id;
    attempt.reviewedAt = Date.now();
    
    // Save attempt
    await attempt.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Review completed successfully',
      data: {
        attemptId: attempt._id,
        status: attempt.status,
        reviewedBy: attempt.reviewedBy,
        reviewedAt: attempt.reviewedAt
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Unreview an attempt (mark as submitted)
 * @route   PUT /api/attempts/:id/unreview
 * @access  Private/Admin
 */
exports.unreviewAttempt = async (req, res, next) => {
  try {
    // Find attempt
    const attempt = await Attempt.findById(req.params.id);
    
    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found'
      });
    }
    
    // Check if attempt is reviewed
    if (attempt.status !== 'reviewed') {
      return res.status(400).json({
        status: 'error',
        code: 'NOT_REVIEWED',
        message: 'This attempt is not currently reviewed'
      });
    }
    
    // Update attempt status back to submitted
    attempt.status = 'submitted';
    attempt.reviewedBy = undefined;
    attempt.reviewedAt = undefined;
    
    // Save attempt
    await attempt.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Attempt unreviewed successfully',
      data: {
        attemptId: attempt._id,
        status: attempt.status
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Check if results are visible for a specific attempt
 * @route   GET /api/attempts/:id/result-visibility
 * @access  Private
 */
exports.checkResultVisibility = async (req, res, next) => {
  try {
    // Find attempt with quiz data
    const attempt = await Attempt.findById(req.params.id)
      .populate('quizId', 'showResultsImmediately questions');
    
    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found'
      });
    }
    
    // Check if user has access to this attempt
    if (req.user.role !== 'admin' && attempt.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        code: 'ACCESS_DENIED',
        message: 'You do not have access to this attempt'
      });
    }
    
    // Determine if results should be visible
    const quiz = attempt.quizId;
    const hasFreeTextQuestions = quiz.questions.some(q => q.type === 'free-text');
    
    // Results are visible if:
    // 1. Immediate results are enabled AND there are no free text questions, OR
    // 2. The attempt has been manually reviewed
    const resultsVisible = 
      (quiz.showResultsImmediately && !hasFreeTextQuestions) || 
      attempt.status === 'reviewed';
    
    res.status(200).json({
      status: 'success',
      data: {
        attemptId: attempt._id,
        resultsVisible,
        status: attempt.status,
        showResultsImmediately: quiz.showResultsImmediately,
        hasFreeTextQuestions,
        requiresManualReview: hasFreeTextQuestions || !quiz.showResultsImmediately
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get attempts requiring review
 * @route   GET /api/attempts/pending-review
 * @access  Private/Admin
 */
exports.getPendingReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Find submitted attempts that need review
    const pendingAttempts = await Attempt.find({
      status: 'submitted'
    })
    .populate('quizId', 'title showResultsImmediately questions')
    .populate('userId', 'username')
    .sort('-endTime')
    .skip(skip)
    .limit(limitNum);
    
    // Filter attempts that actually need review
    const attemptsNeedingReview = pendingAttempts.filter(attempt => {
      const quiz = attempt.quizId;
      const hasFreeTextQuestions = quiz.questions.some(q => q.type === 'free-text');
      
      // Needs review if:
      // 1. Has free text questions, OR
      // 2. Immediate results are disabled
      return hasFreeTextQuestions || !quiz.showResultsImmediately;
    });
    
    // Get total count for pagination
    const total = await Attempt.countDocuments({ status: 'submitted' });
    
    res.status(200).json({
      status: 'success',
      count: attemptsNeedingReview.length,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      data: attemptsNeedingReview
    });
  } catch (err) {
    next(err);
  }
};