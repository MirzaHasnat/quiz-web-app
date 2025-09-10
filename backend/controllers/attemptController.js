const mongoose = require('mongoose');
const Attempt = require('../models/Attempt');
const Quiz = require('../models/Quiz');

// @desc    Get all attempts with filtering and pagination
// @route   GET /api/attempts
// @access  Private/Admin
exports.getAttempts = async (req, res, next) => {
  try {
    const { 
      quizId, 
      userId, 
      status, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 10,
      sort = '-startTime'
    } = req.query;
    
    // Build query
    const query = {};
    
    // Filter by quiz
    if (quizId) {
      query.quizId = quizId;
    }
    
    // Filter by user
    if (userId) {
      query.userId = userId;
    } else if (req.user.role !== 'admin') {
      // Regular users can only see their own attempts
      query.userId = req.user._id;
    }
    
    // Filter by status
    if (status && ['in-progress', 'submitted', 'reviewed'].includes(status)) {
      query.status = status;
    }
    
    // Filter by date range
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) {
        query.startTime.$gte = new Date(startDate);
      }
      if (endDate) {
        query.startTime.$lte = new Date(endDate);
      }
    }
    
    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Execute query
    const attempts = await Attempt.find(query)
      .populate('quizId', 'title')
      .populate('userId', 'username')
      .populate('reviewedBy', 'username')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);
    
    // Get total count for pagination
    const total = await Attempt.countDocuments(query);
    
    res.status(200).json({
      status: 'success',
      count: attempts.length,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      data: attempts
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get attempt details with full quiz data
// @route   GET /api/attempts/:id
// @access  Private
exports.getAttemptDetails = async (req, res, next) => {
  try {
    const attempt = await Attempt.findById(req.params.id)
      .populate({
        path: 'quizId',
        select: 'title description questions showResultsImmediately duration'
      })
      .populate('userId', 'username')
      .populate('reviewedBy', 'username')
      .populate('recordings');

    console.log(attempt);
    
    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found'
      });
    }

    // Check if user has access to this attempt
    if (req.user.role !== 'admin' && attempt.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        code: 'ACCESS_DENIED',
        message: 'You do not have access to this attempt'
      });
    }

    // For regular users, check if they can see their score
    if (req.user.role !== 'admin') {
      const quiz = attempt.quizId;
      const hasManualGradingQuestions = quiz.questions.some(q => q.type === 'free-text');
      
      // Results are visible if:
      // 1. Immediate results are enabled AND there are no free text questions, OR
      // 2. The attempt has been manually reviewed
      const resultsVisible = 
        (quiz.showResultsImmediately && !hasManualGradingQuestions) || 
        attempt.status === 'reviewed';
      
      // Hide score and feedback if results shouldn't be visible
      if (!resultsVisible) {
        attempt.totalScore = undefined;
        
        // Also hide individual answer scores and feedback
        if (attempt.answers && attempt.answers.length > 0) {
          attempt.answers.forEach(answer => {
            answer.score = undefined;
            answer.isCorrect = undefined;
            answer.feedback = undefined;
          });
        }
      }
      
      // Add result visibility info to the response
      attempt._doc.resultsVisible = resultsVisible;
      attempt._doc.requiresManualReview = hasManualGradingQuestions || !quiz.showResultsImmediately;
      // if in progress then show the timeRemaining
      if(attempt.status === 'in-progress') {
        const timeElapsed = (Date.now() - attempt.startTime) / (1000 * 60); // minutes
        attempt._doc.remainingTime = Math.max(0, quiz.duration - timeElapsed) * 60;
      }
    }

    res.status(200).json({
      status: 'success',
      data: attempt
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Review and update attempt scores and feedback
// @route   PUT /api/attempts/:id/review
// @access  Private/Admin
exports.reviewAttempt = async (req, res, next) => {
  try {
    const { answers, totalScore, feedback } = req.body;
    
    // Find attempt
    const attempt = await Attempt.findById(req.params.id);
    
    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found'
      });
    }

    // Update answers if provided
    if (answers && Array.isArray(answers)) {
      answers.forEach(updatedAnswer => {
        const answerIndex = attempt.answers.findIndex(
          a => a._id.toString() === updatedAnswer._id || 
               a.questionId.toString() === updatedAnswer.questionId
        );
        
        if (answerIndex !== -1) {
          // Update score
          if (updatedAnswer.score !== undefined) {
            attempt.answers[answerIndex].score = updatedAnswer.score;
          }
          
          // Update negative score
          if (updatedAnswer.negativeScore !== undefined) {
            attempt.answers[answerIndex].negativeScore = updatedAnswer.negativeScore;
          }
          
          // Update correctness
          if (updatedAnswer.isCorrect !== undefined) {
            attempt.answers[answerIndex].isCorrect = updatedAnswer.isCorrect;
          }
          
          // Update feedback
          if (updatedAnswer.feedback !== undefined) {
            attempt.answers[answerIndex].feedback = updatedAnswer.feedback;
          }
        }
      });
    }

    // Update total score if provided, otherwise recalculate
    if (totalScore !== undefined) {
      attempt.totalScore = totalScore;
    } else {
      attempt.calculateScore();
    }

    // Update review information
    attempt.status = 'reviewed';
    attempt.reviewedBy = req.user._id;
    attempt.reviewedAt = Date.now();
    
    // Save attempt
    await attempt.save();

    res.status(200).json({
      status: 'success',
      data: attempt
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get quiz attempts statistics
// @route   GET /api/attempts/stats
// @access  Private/Admin
exports.getAttemptStats = async (req, res, next) => {
  try {
    const { quizId } = req.query;
    
    // Build match stage
    const matchStage = {};
    if (quizId) {
      matchStage.quizId = mongoose.Types.ObjectId(quizId);
    }
    
    // Aggregate statistics
    const stats = await Attempt.aggregate([
      { $match: matchStage },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgScore: { $avg: '$totalScore' },
        minScore: { $min: '$totalScore' },
        maxScore: { $max: '$totalScore' }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    // Get question-level statistics if quizId is provided
    let questionStats = [];
    if (quizId) {
      questionStats = await Attempt.aggregate([
        { $match: { 
          quizId: mongoose.Types.ObjectId(quizId),
          status: { $in: ['submitted', 'reviewed'] }
        }},
        { $unwind: '$answers' },
        { $group: {
          _id: '$answers.questionId',
          totalAttempts: { $sum: 1 },
          correctCount: { $sum: { $cond: ['$answers.isCorrect', 1, 0] }},
          avgScore: { $avg: '$answers.score' }
        }},
        { $project: {
          questionId: '$_id',
          totalAttempts: 1,
          correctCount: 1,
          avgScore: 1,
          correctPercentage: { 
            $multiply: [
              { $divide: ['$correctCount', '$totalAttempts'] }, 
              100
            ]
          }
        }}
      ]);
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        statusStats: stats,
        questionStats
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update feedback for a specific answer
// @route   PUT /api/attempts/:id/answers/:answerId/feedback
// @access  Private/Admin
exports.updateAnswerFeedback = async (req, res, next) => {
  try {
    const { feedback, score, negativeScore, isCorrect } = req.body;
    
    // Find attempt
    const attempt = await Attempt.findById(req.params.id);
    
    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found'
      });
    }

    // Find answer
    const answer = attempt.answers.id(req.params.answerId);
    
    if (!answer) {
      return res.status(404).json({
        status: 'error',
        code: 'ANSWER_NOT_FOUND',
        message: 'Answer not found'
      });
    }

    // Update answer
    if (feedback !== undefined) {
      answer.feedback = feedback;
    }
    
    if (score !== undefined) {
      answer.score = score;
    }
    
    if (negativeScore !== undefined) {
      answer.negativeScore = negativeScore;
    }
    
    if (isCorrect !== undefined) {
      answer.isCorrect = isCorrect;
    }
    
    // Recalculate total score
    attempt.calculateScore();
    
    // Save attempt
    await attempt.save();

    res.status(200).json({
      status: 'success',
      data: answer
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Batch update multiple attempts (e.g., mark as reviewed)
// @route   PUT /api/attempts/batch
// @access  Private/Admin
exports.batchUpdateAttempts = async (req, res, next) => {
  try {
    const { attemptIds, action } = req.body;
    
    if (!attemptIds || !Array.isArray(attemptIds) || attemptIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_REQUEST',
        message: 'Please provide attempt IDs'
      });
    }
    
    if (!action) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_REQUEST',
        message: 'Please provide an action'
      });
    }
    
    let updateData = {};
    
    // Handle different actions
    switch (action) {
      case 'mark-reviewed':
        updateData = {
          status: 'reviewed',
          reviewedBy: req.user._id,
          reviewedAt: Date.now()
        };
        break;
      case 'unreview':
        updateData = {
          status: 'submitted',
          $unset: { reviewedBy: 1, reviewedAt: 1 }
        };
        break;
      default:
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_ACTION',
          message: 'Invalid action'
        });
    }
    
    // Update attempts
    const result = await Attempt.updateMany(
      { _id: { $in: attemptIds } },
      { $set: updateData }
    );
    
    res.status(200).json({
      status: 'success',
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Recalculate scores for all attempts of a quiz with negative marking
// @route   PUT /api/attempts/recalculate-scores/:quizId
// @access  Private/Admin
exports.recalculateScoresForQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    
    // Get the quiz to check negative marking settings
    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        code: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found'
      });
    }
    
    // Get all attempts for this quiz that are submitted or reviewed
    const attempts = await Attempt.find({
      quizId: quizId,
      status: { $in: ['submitted', 'reviewed'] }
    }).populate('quizId');
    
    if (attempts.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No attempts found to recalculate',
        data: {
          processed: 0,
          updated: 0
        }
      });
    }
    
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
          // Free-text questions typically don't get negative marking unless manually set
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
    
    res.status(200).json({
      status: 'success',
      message: `Successfully recalculated scores for ${updatedCount} attempts`,
      data: {
        processed: attempts.length,
        updated: updatedCount,
        negativeMarkingEnabled: quiz.negativeMarking.enabled,
        penaltyValue: quiz.negativeMarking.penaltyValue
      }
    });
  } catch (err) {
    next(err);
  }
};