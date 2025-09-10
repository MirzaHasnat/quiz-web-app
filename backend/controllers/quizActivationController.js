const Quiz = require('../models/Quiz');
const User = require('../models/User');
const Attempt = require('../models/Attempt');

/**
 * @desc    Get activation status for all users and quizzes
 * @route   GET /api/activation
 * @access  Private/Admin
 */
exports.getActivationMatrix = async (req, res, next) => {
  try {
    // Get all users (excluding password field)
    const users = await User.find({ role: 'user' }).select('-password');
    
    // Get all quizzes
    const quizzes = await Quiz.find().select('title description isActive activatedUsers');
    
    // Create activation matrix
    const activationMatrix = users.map(user => {
      const userActivations = quizzes.map(quiz => {
        return {
          quizId: quiz._id,
          title: quiz.title,
          isActive: quiz.isActive,
          isActivatedForUser: quiz.activatedUsers.includes(user._id)
        };
      });
      
      return {
        userId: user._id,
        username: user.username,
        isBlocked: user.isBlocked,
        activations: userActivations
      };
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        users: users.length,
        quizzes: quizzes.length,
        activationMatrix
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Activate or deactivate a quiz for a user
 * @route   PUT /api/activation/quiz/:quizId/user/:userId
 * @access  Private/Admin
 */
exports.toggleQuizActivation = async (req, res, next) => {
  try {
    const { quizId, userId } = req.params;
    const { activate } = req.body;
    
    // Validate input
    if (activate === undefined) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_FIELDS',
        message: 'Please provide activate field (true/false)'
      });
    }
    
    // Find quiz
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }
    
    // Check if user is an admin (cannot activate quizzes for admins)
    if (user.role === 'admin') {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_USER_ROLE',
        message: 'Cannot activate quizzes for admin users'
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
      data: {
        quizId: quiz._id,
        userId: user._id,
        activated: activate
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Bulk activate or deactivate quizzes for users
 * @route   POST /api/activation/bulk
 * @access  Private/Admin
 */
exports.bulkActivation = async (req, res, next) => {
  try {
    const { activations } = req.body;
    
    if (!activations || !Array.isArray(activations) || activations.length === 0) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_INPUT',
        message: 'Please provide an array of activations'
      });
    }
    
    const results = [];
    
    // Process each activation request
    for (const activation of activations) {
      const { quizId, userId, activate } = activation;
      
      if (!quizId || !userId || activate === undefined) {
        results.push({
          status: 'error',
          quizId,
          userId,
          message: 'Invalid activation data'
        });
        continue;
      }
      
      try {
        // Find quiz
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
          results.push({
            status: 'error',
            quizId,
            userId,
            message: 'Quiz not found'
          });
          continue;
        }
        
        // Find user
        const user = await User.findById(userId);
        if (!user) {
          results.push({
            status: 'error',
            quizId,
            userId,
            message: 'User not found'
          });
          continue;
        }
        
        // Check if user is an admin
        if (user.role === 'admin') {
          results.push({
            status: 'error',
            quizId,
            userId,
            message: 'Cannot activate quizzes for admin users'
          });
          continue;
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
        
        results.push({
          status: 'success',
          quizId,
          userId,
          activated: activate
        });
      } catch (err) {
        results.push({
          status: 'error',
          quizId,
          userId,
          message: err.message
        });
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        total: activations.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
        results
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Bulk activate/deactivate a quiz for all users
 * @route   POST /api/activation/quiz/:quizId/bulk
 * @access  Private/Admin
 */
exports.bulkQuizActivation = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const { activate } = req.body;
    
    // Validate input
    if (activate === undefined) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_FIELDS',
        message: 'Please provide activate field (true/false)'
      });
    }
    
    // Find quiz
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }
    
    // Get all active users (non-admin, non-blocked)
    const activeUsers = await User.find({ 
      role: 'user', 
      isBlocked: false 
    }).select('_id');
    
    if (activate) {
      // Add all active users to the quiz's activated users list
      const userIds = activeUsers.map(user => user._id);
      
      // Use $addToSet to avoid duplicates
      await Quiz.findByIdAndUpdate(quizId, {
        $addToSet: { activatedUsers: { $each: userIds } }
      });
    } else {
      // Remove all users from the quiz's activated users list
      await Quiz.findByIdAndUpdate(quizId, {
        $set: { activatedUsers: [] }
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: `Quiz ${activate ? 'activated' : 'deactivated'} for all users successfully`,
      data: {
        quizId: quiz._id,
        quizTitle: quiz.title,
        activated: activate,
        affectedUsers: activeUsers.length
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Terminate active quiz sessions for a user
 * @route   POST /api/activation/terminate/:userId
 * @access  Private/Admin
 */
exports.terminateUserSessions = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }
    
    // Find all in-progress attempts for this user
    const activeAttempts = await Attempt.find({
      userId,
      status: 'in-progress'
    }).populate('recordings');
    
    if (activeAttempts.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No active sessions found for this user',
        data: {
          terminatedSessions: 0
        }
      });
    }
    
    // Terminate each attempt
    const terminationResults = [];
    
    for (const attempt of activeAttempts) {
      // Mark attempt as submitted with current timestamp
      attempt.status = 'submitted';
      attempt.endTime = Date.now();
      
      // Stop all active recordings
      if (attempt.recordings && attempt.recordings.length > 0) {
        const Recording = require('../models/Recording');
        
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
      
      // Save the attempt
      await attempt.save();
      
      terminationResults.push({
        attemptId: attempt._id,
        quizId: attempt.quizId,
        startTime: attempt.startTime,
        endTime: attempt.endTime
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: `Terminated ${activeAttempts.length} active session(s) for user`,
      data: {
        terminatedSessions: activeAttempts.length,
        sessions: terminationResults
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get active quiz sessions
 * @route   GET /api/activation/sessions
 * @access  Private/Admin
 */
exports.getActiveSessions = async (req, res, next) => {
  try {
    // Find all in-progress attempts
    const activeSessions = await Attempt.find({
      status: 'in-progress'
    })
    .populate('userId', 'username')
    .populate('quizId', 'title')
    .select('userId quizId startTime');
    
    res.status(200).json({
      status: 'success',
      count: activeSessions.length,
      data: activeSessions
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Bulk activate/deactivate a quiz for all users
 * @route   POST /api/activation/quiz/:quizId/bulk
 * @access  Private/Admin
 */
exports.bulkQuizActivation = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const { activate } = req.body;
    
    // Validate input
    if (activate === undefined) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_FIELDS',
        message: 'Please provide activate field (true/false)'
      });
    }
    
    // Find quiz
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }
    
    // Get all active users (non-admin, non-blocked)
    const activeUsers = await User.find({ 
      role: 'user', 
      isBlocked: false 
    }).select('_id');
    
    if (activate) {
      // Add all active users to the quiz's activated users list
      const userIds = activeUsers.map(user => user._id);
      
      // Use $addToSet to avoid duplicates
      await Quiz.findByIdAndUpdate(quizId, {
        $addToSet: { activatedUsers: { $each: userIds } }
      });
    } else {
      // Remove all users from the quiz's activated users list
      await Quiz.findByIdAndUpdate(quizId, {
        $set: { activatedUsers: [] }
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: `Quiz ${activate ? 'activated' : 'deactivated'} for all users successfully`,
      data: {
        quizId: quiz._id,
        quizTitle: quiz.title,
        activated: activate,
        affectedUsers: activeUsers.length
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Terminate a specific quiz session
 * @route   POST /api/activation/terminate-session/:attemptId
 * @access  Private/Admin
 */
exports.terminateSession = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    
    // Find the attempt
    const attempt = await Attempt.findOne({
      _id: attemptId,
      status: 'in-progress'
    }).populate('recordings');
    
    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'SESSION_NOT_FOUND',
        message: 'Active session not found'
      });
    }
    
    // Mark attempt as submitted with current timestamp
    attempt.status = 'submitted';
    attempt.endTime = Date.now();
    
    // Stop all active recordings
    if (attempt.recordings && attempt.recordings.length > 0) {
      const Recording = require('../models/Recording');
      
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
    
    // Save the attempt
    await attempt.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Session terminated successfully',
      data: {
        attemptId: attempt._id,
        quizId: attempt.quizId,
        userId: attempt.userId,
        startTime: attempt.startTime,
        endTime: attempt.endTime
      }
    });
  } catch (err) {
    next(err);
  }
};