const Quiz = require('../models/Quiz');

/**
 * Validate quiz access permissions
 * This middleware checks if the authenticated user has access to the requested quiz
 * It requires the quiz ID to be in req.params.id
 */
exports.validateQuizAccess = async (req, res, next) => {
  try {
    // Skip validation for admins
    if (req.user.role === 'admin') {
      return next();
    }

    const quizId = req.params.id;
    
    if (!quizId) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_QUIZ_ID',
        message: 'Quiz ID is required'
      });
    }

    // Find the quiz
    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }

    // Check if quiz is active
    if (!quiz.isActive) {
      return res.status(403).json({
        status: 'error',
        code: 'QUIZ_INACTIVE',
        message: 'This quiz is currently inactive'
      });
    }

    // Check if user has access to this quiz
    if (!quiz.activatedUsers.includes(req.user._id)) {
      return res.status(403).json({
        status: 'error',
        code: 'QUIZ_ACCESS_DENIED',
        message: 'You do not have access to this quiz'
      });
    }

    // Add quiz to request object for potential future use
    req.quiz = quiz;
    next();
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Server error while validating quiz access'
    });
  }
};

/**
 * Check if user has any activated quizzes
 * This middleware checks if the authenticated user has any activated quizzes
 * and provides appropriate feedback if none are available
 */
exports.hasActivatedQuizzes = async (req, res, next) => {
  try {
    // Skip validation for admins
    if (req.user.role === 'admin') {
      return next();
    }

    // Count quizzes activated for this user
    const count = await Quiz.countDocuments({
      activatedUsers: req.user._id,
      isActive: true
    });

    // Add result to request object
    req.hasQuizzes = count > 0;
    
    // If no quizzes are available and the endpoint is specifically for listing quizzes,
    // we can return a custom response with a 200 status but empty data
    if (!req.hasQuizzes && req.path === '/quizzes' && req.method === 'GET') {
      return res.status(200).json({
        status: 'success',
        count: 0,
        data: [],
        message: 'No quizzes are currently available for you'
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Server error while checking activated quizzes'
    });
  }
};