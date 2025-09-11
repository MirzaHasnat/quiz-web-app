const mongoose = require('mongoose');
const Attempt = require('../models/Attempt');
const Quiz = require('../models/Quiz');

// Helper function to calculate remaining time for an attempt
const calculateRemainingTime = (attempt, quiz) => {
  if (attempt.status !== 'in-progress') {
    return 0;
  }
  
  const timeElapsed = (Date.now() - new Date(attempt.startTime)) / 1000; // seconds
  const timingMode = attempt.timingMode || quiz.timingMode || 'total';
  
  if (timingMode === 'total') {
    const totalTime = quiz.duration * 60; // seconds
    return Math.max(0, totalTime - timeElapsed);
  } else if (timingMode === 'per-question') {
    const totalTime = quiz.calculateTotalQuestionTime ? 
      quiz.calculateTotalQuestionTime() : 
      quiz.questions.reduce((total, q) => total + (q.timeLimit || 60), 0);
    return Math.max(0, totalTime - timeElapsed);
  }
  
  return 0;
};

// Helper function to calculate remaining time for a specific question
const calculateQuestionRemainingTime = (attempt, questionId, questionTimeLimit) => {
  if (attempt.timingMode !== 'per-question') {
    return questionTimeLimit || 60;
  }
  
  const questionIdStr = questionId.toString();
  
  // Check if we have stored remaining time for this question
  if (attempt.questionTimeRemaining && attempt.questionTimeRemaining.has(questionIdStr)) {
    return Math.max(0, attempt.questionTimeRemaining.get(questionIdStr));
  }
  
  // If no stored time, check if question has been started
  if (attempt.questionStartTimes && attempt.questionStartTimes.has(questionIdStr)) {
    const startTime = attempt.questionStartTimes.get(questionIdStr);
    const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
    const remaining = Math.max(0, (questionTimeLimit || 60) - elapsed);
    return remaining;
  }
  
  // Question hasn't been started yet, return full time limit
  return questionTimeLimit || 60;
};

// Helper function to update question timing data
const updateQuestionTiming = async (attempt, questionId, timeRemaining) => {
  const questionIdStr = questionId.toString();
  
  if (!attempt.questionTimeRemaining) {
    attempt.questionTimeRemaining = new Map();
  }
  
  // Store the remaining time for this question
  attempt.questionTimeRemaining.set(questionIdStr, Math.max(0, timeRemaining));
  
  // If this is the first time tracking this question, set start time
  if (!attempt.questionStartTimes || !attempt.questionStartTimes.has(questionIdStr)) {
    if (!attempt.questionStartTimes) {
      attempt.questionStartTimes = new Map();
    }
    attempt.questionStartTimes.set(questionIdStr, new Date());
  }
  
  console.log(`[Backend] Updated question ${questionId} timing: ${timeRemaining}s remaining`);
  return attempt.save();
};

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
      .populate('quizId', 'title duration questions timingMode')
      .populate('userId', 'username')
      .populate('reviewedBy', 'username')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);
    
    // Calculate remaining time for each in-progress attempt
    const attemptsWithTiming = attempts.map(attempt => {
      const attemptObj = attempt.toObject();
      if (attempt.status === 'in-progress' && attempt.quizId) {
        attemptObj.remainingTime = calculateRemainingTime(attempt, attempt.quizId);
      }
      return attemptObj;
    });
    
    // Get total count for pagination
    const total = await Attempt.countDocuments(query);
    
    res.status(200).json({
      status: 'success',
      count: attemptsWithTiming.length,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      data: attemptsWithTiming
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

    // Calculate timing information using the helper function
    let timingInfo = {
      timingMode: attempt.timingMode || 'total',
      remainingTime: calculateRemainingTime(attempt, attempt.quizId),
      totalTime: 0
    };

    // Set total time based on timing mode
    if (attempt.timingMode === 'total') {
      timingInfo.totalTime = attempt.quizId.duration * 60; // seconds
    } else if (attempt.timingMode === 'per-question') {
      timingInfo.totalTime = attempt.quizId.calculateTotalQuestionTime ? 
        attempt.quizId.calculateTotalQuestionTime() : 
        attempt.quizId.questions.reduce((total, q) => total + (q.timeLimit || 60), 0);
      
      // Add question-specific timing info with remaining times
      timingInfo.questionTimeLimits = attempt.quizId.questions.map(q => ({
        questionId: q._id,
        timeLimit: q.timeLimit || 60,
        timeRemaining: calculateQuestionRemainingTime(attempt, q._id, q.timeLimit || 60)
      }));
      
      // Add question timing state maps for frontend use
      timingInfo.questionStartTimes = {};
      timingInfo.questionTimeRemaining = {};
      
      if (attempt.questionStartTimes) {
        for (const [questionId, startTime] of attempt.questionStartTimes) {
          timingInfo.questionStartTimes[questionId] = startTime;
        }
      }
      
      if (attempt.questionTimeRemaining) {
        for (const [questionId, timeRemaining] of attempt.questionTimeRemaining) {
          timingInfo.questionTimeRemaining[questionId] = timeRemaining;
        }
      }
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
      
      // Add result visibility info and always calculate remaining time for in-progress attempts
      attempt._doc.resultsVisible = resultsVisible;
      attempt._doc.requiresManualReview = hasManualGradingQuestions || !quiz.showResultsImmediately;
      
      // Always calculate and add remaining time for in-progress attempts using helper function
      if(attempt.status === 'in-progress') {
        const calculatedRemainingTime = calculateRemainingTime(attempt, attempt.quizId);
        attempt._doc.remainingTime = calculatedRemainingTime;
        // Also ensure timing info has the same value
        timingInfo.remainingTime = calculatedRemainingTime;
        console.log(`[Backend] Calculated remaining time for attempt ${attempt._id}: ${calculatedRemainingTime}s`);
      }
    }
    
    // Always calculate and add remaining time for in-progress attempts (for both admin and regular users)
    if(attempt.status === 'in-progress') {
      const calculatedRemainingTime = calculateRemainingTime(attempt, attempt.quizId);
      attempt._doc.remainingTime = calculatedRemainingTime;
      // Also ensure timing info has the same value
      timingInfo.remainingTime = calculatedRemainingTime;
      console.log(`[Backend] Calculated remaining time for attempt ${attempt._id}: ${calculatedRemainingTime}s`);
    }

    res.status(200).json({
      status: 'success',
      data: {
        attempt,
        timing: timingInfo
      }
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