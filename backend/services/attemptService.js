/**
 * Attempt Service
 * Handles business logic for quiz attempts including timing mode management
 */

const Attempt = require('../models/Attempt');
const Quiz = require('../models/Quiz');
const QuizTimingValidator = require('./quizTimingValidator');

class AttemptService {
  /**
   * Start a new quiz attempt
   * @param {string} quizId - Quiz ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Created attempt
   */
  static async startAttempt(quizId, userId) {
    try {
      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        throw new Error('Quiz not found');
      }

      // Check if user already has an in-progress attempt
      const existingAttempt = await Attempt.findOne({
        quizId,
        userId,
        status: 'in-progress'
      });

      if (existingAttempt) {
        throw new Error('User already has an in-progress attempt for this quiz');
      }

      // Create new attempt with timing mode
      const attempt = new Attempt({
        quizId,
        userId,
        maxScore: quiz.calculateMaxScore(),
        timingMode: quiz.timingMode || 'total'
      });

      // Initialize timing-specific fields
      if (quiz.timingMode === 'per-question') {
        attempt.questionStartTimes = new Map();
        attempt.questionTimeRemaining = new Map();
        
        // Start timer for first question
        if (quiz.questions.length > 0) {
          const firstQuestion = quiz.questions[0];
          attempt.startQuestionTimer(firstQuestion._id);
        }
      }

      await attempt.save();
      
      return attempt;
    } catch (error) {
      console.error('Error starting attempt:', error);
      throw error;
    }
  }

  /**
   * Get attempt with timing information
   * @param {string} attemptId - Attempt ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Attempt with timing info
   */
  static async getAttemptWithTiming(attemptId, userId) {
    try {
      const attempt = await Attempt.findOne({
        _id: attemptId,
        userId
      }).populate('quizId');

      if (!attempt) {
        throw new Error('Attempt not found');
      }

      const timingInfo = this.calculateTimingInfo(attempt);
      
      return {
        attempt,
        timing: timingInfo
      };
    } catch (error) {
      console.error('Error getting attempt with timing:', error);
      throw error;
    }
  }

  /**
   * Calculate timing information for an attempt
   * @param {Object} attempt - Attempt object
   * @returns {Object} - Timing information
   */
  static calculateTimingInfo(attempt) {
    const timingInfo = {
      timingMode: attempt.timingMode || 'total',
      remainingTime: 0,
      totalTime: 0,
      isExpired: false
    };

    if (attempt.status !== 'in-progress') {
      return timingInfo;
    }

    const now = Date.now();
    const startTime = attempt.startTime.getTime();
    const elapsedSeconds = Math.floor((now - startTime) / 1000);

    if (attempt.timingMode === 'total') {
      const totalSeconds = attempt.quizId.duration * 60;
      timingInfo.totalTime = totalSeconds;
      timingInfo.remainingTime = Math.max(0, totalSeconds - elapsedSeconds);
      timingInfo.isExpired = elapsedSeconds >= totalSeconds;
    } else if (attempt.timingMode === 'per-question') {
      const totalQuestionTime = attempt.quizId.calculateTotalQuestionTime();
      timingInfo.totalTime = totalQuestionTime;
      timingInfo.remainingTime = Math.max(0, totalQuestionTime - elapsedSeconds);
      timingInfo.isExpired = elapsedSeconds >= totalQuestionTime;
      
      // Add question-specific timing info
      timingInfo.questionTimeLimits = attempt.quizId.questions.map(q => ({
        questionId: q._id,
        timeLimit: q.timeLimit || 60
      }));
    }

    return timingInfo;
  }

  /**
   * Handle question timeout in per-question mode
   * @param {string} attemptId - Attempt ID
   * @param {string} questionId - Question ID
   * @param {Object} currentAnswer - Current answer (if any)
   * @returns {Promise<Object>} - Updated attempt
   */
  static async handleQuestionTimeout(attemptId, questionId, currentAnswer = null) {
    try {
      const attempt = await Attempt.findById(attemptId).populate('quizId');
      
      if (!attempt) {
        throw new Error('Attempt not found');
      }

      if (attempt.timingMode !== 'per-question') {
        throw new Error('Question timeout only applies to per-question timing mode');
      }

      // Auto-save current answer if provided
      if (currentAnswer) {
        await this.saveAnswer(attempt, questionId, currentAnswer);
      }

      // Mark question as timed out
      attempt.markQuestionTimedOut(questionId);

      // Log timeout event
      const timeoutActivity = {
        timestamp: new Date().toISOString(),
        type: 'QUESTION_TIMEOUT',
        description: `Question ${questionId} timed out`,
        metadata: {
          questionId,
          hadAnswer: !!currentAnswer
        }
      };
      
      attempt.activities.push(timeoutActivity);
      
      await attempt.save();
      
      return attempt;
    } catch (error) {
      console.error('Error handling question timeout:', error);
      throw error;
    }
  }

  /**
   * Save answer for a question
   * @param {Object} attempt - Attempt object
   * @param {string} questionId - Question ID
   * @param {Object} answer - Answer data
   * @returns {Promise<void>}
   */
  static async saveAnswer(attempt, questionId, answer) {
    try {
      // Find existing answer or create new one
      let existingAnswer = attempt.answers.find(a => a.questionId.toString() === questionId);
      
      if (!existingAnswer) {
        existingAnswer = {
          questionId,
          selectedOptions: [],
          textAnswer: '',
          isCorrect: null,
          score: 0,
          negativeScore: 0,
          feedback: ''
        };
        attempt.answers.push(existingAnswer);
      }

      // Update answer based on type
      if (answer.selectedOptions) {
        existingAnswer.selectedOptions = answer.selectedOptions;
      }
      if (answer.textAnswer) {
        existingAnswer.textAnswer = answer.textAnswer;
      }

      await attempt.save();
    } catch (error) {
      console.error('Error saving answer:', error);
      throw error;
    }
  }

  /**
   * Submit quiz attempt
   * @param {string} attemptId - Attempt ID
   * @param {Array} answers - All answers
   * @param {Object} options - Submission options
   * @returns {Promise<Object>} - Submission result
   */
  static async submitAttempt(attemptId, answers, options = {}) {
    try {
      const attempt = await Attempt.findById(attemptId).populate('quizId');
      
      if (!attempt) {
        throw new Error('Attempt not found');
      }

      if (attempt.status !== 'in-progress') {
        throw new Error('Attempt is not in progress');
      }

      // Validate timing if not expired
      if (!options.timeExpired && !options.forcedRefresh) {
        const timingValidation = QuizTimingValidator.validateAttemptTiming(attempt, attempt.quizId);
        if (!timingValidation.isValid) {
          console.warn('Timing validation failed:', timingValidation.errors);
        }
      }

      // Process and grade answers
      attempt.answers = this.processAnswers(answers, attempt.quizId);
      
      // Set submission status
      if (options.timeExpired) {
        attempt.status = 'time_up';
      } else {
        attempt.status = 'submitted';
      }
      
      attempt.endTime = new Date();
      attempt.negativeMarkingApplied = attempt.quizId.negativeMarking?.enabled || false;
      
      // Calculate score
      attempt.calculateScore();
      
      // Log submission event
      const submissionActivity = {
        timestamp: new Date().toISOString(),
        type: 'QUIZ_SUBMITTED',
        description: options.timeExpired ? 'Quiz auto-submitted due to time expiration' : 'Quiz manually submitted',
        metadata: {
          timeExpired: !!options.timeExpired,
          forcedRefresh: !!options.forcedRefresh,
          totalScore: attempt.totalScore,
          maxScore: attempt.maxScore
        }
      };
      
      attempt.activities.push(submissionActivity);
      
      await attempt.save();
      
      return {
        attempt,
        autoGraded: this.isFullyAutoGraded(attempt.quizId),
        requiresManualReview: this.requiresManualReview(attempt.quizId)
      };
    } catch (error) {
      console.error('Error submitting attempt:', error);
      throw error;
    }
  }

  /**
   * Process and grade answers
   * @param {Array} answers - Raw answers from frontend
   * @param {Object} quiz - Quiz object
   * @returns {Array} - Processed answers
   */
  static processAnswers(answers, quiz) {
    return answers.map(answer => {
      const question = quiz.questions.id(answer.questionId);
      
      if (!question) {
        return answer;
      }

      // Auto-grade non-free-text questions
      if (question.type !== 'free-text') {
        if (question.type === 'single-select') {
          const selectedOption = question.options.find(
            opt => opt._id.toString() === answer.selectedOptions[0]
          );
          
          answer.isCorrect = selectedOption && selectedOption.isCorrect;
          answer.score = answer.isCorrect ? question.points : 0;
          
          // Apply negative marking
          if (!answer.isCorrect && quiz.negativeMarking?.enabled) {
            answer.negativeScore = quiz.negativeMarking.penaltyValue;
          } else {
            answer.negativeScore = 0;
          }
        } else if (question.type === 'multi-select') {
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
          
          // Apply negative marking
          if (!answer.isCorrect && quiz.negativeMarking?.enabled) {
            answer.negativeScore = quiz.negativeMarking.penaltyValue;
          } else {
            answer.negativeScore = 0;
          }
        }
      } else {
        // Free-text questions - initialize for manual grading
        answer.negativeScore = 0;
        answer.isCorrect = null;
        answer.score = 0;
      }

      return answer;
    });
  }

  /**
   * Check if quiz is fully auto-graded
   * @param {Object} quiz - Quiz object
   * @returns {boolean}
   */
  static isFullyAutoGraded(quiz) {
    return !quiz.questions.some(q => q.type === 'free-text');
  }

  /**
   * Check if quiz requires manual review
   * @param {Object} quiz - Quiz object
   * @returns {boolean}
   */
  static requiresManualReview(quiz) {
    return quiz.questions.some(q => q.type === 'free-text');
  }

  /**
   * Check if attempt time has expired
   * @param {Object} attempt - Attempt object
   * @returns {boolean}
   */
  static isAttemptExpired(attempt) {
    const timingInfo = this.calculateTimingInfo(attempt);
    return timingInfo.isExpired;
  }

  /**
   * Get remaining time for an attempt
   * @param {Object} attempt - Attempt object
   * @returns {number} - Remaining time in seconds
   */
  static getRemainingTime(attempt) {
    const timingInfo = this.calculateTimingInfo(attempt);
    return timingInfo.remainingTime;
  }
}

module.exports = AttemptService;