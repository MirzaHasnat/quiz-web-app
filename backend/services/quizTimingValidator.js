/**
 * Quiz Timing Validator Service
 * Handles validation logic for both total and per-question timing modes
 */

class QuizTimingValidator {
  /**
   * Validate quiz timing configuration
   * @param {Object} quizData - Quiz data to validate
   * @returns {Object} - Validation result
   */
  static validateQuizTiming(quizData) {
    const { timingMode, duration, questions } = quizData;
    
    // Validate timing mode
    if (!timingMode || !['total', 'per-question'].includes(timingMode)) {
      return {
        isValid: false,
        errors: ['Invalid timing mode. Must be either "total" or "per-question"']
      };
    }
    
    try {
      if (timingMode === 'total') {
        return this.validateTotalMode(duration);
      } else if (timingMode === 'per-question') {
        return this.validatePerQuestionMode(questions);
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [error.message]
      };
    }
    
    return {
      isValid: true,
      errors: []
    };
  }
  
  /**
   * Validate total timing mode
   * @param {Number} duration - Quiz duration in minutes
   * @returns {Object} - Validation result
   */
  static validateTotalMode(duration) {
    const errors = [];
    
    if (!duration || typeof duration !== 'number') {
      errors.push('Duration is required for total timing mode');
    } else {
      if (duration < 1) {
        errors.push('Duration must be at least 1 minute');
      }
      if (duration > 300) {
        errors.push('Duration cannot exceed 300 minutes (5 hours)');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate per-question timing mode
   * @param {Array} questions - Array of questions
   * @returns {Object} - Validation result
   */
  static validatePerQuestionMode(questions) {
    const errors = [];
    
    if (questions || Array.isArray(questions)) {
    
      questions.forEach((question, index) => {
        const questionNumber = index + 1;
        
        if (!question.timeLimit) {
          errors.push(`Question ${questionNumber}: Time limit is required for per-question timing mode`);
        } else {
          if (typeof question.timeLimit !== 'number') {
            errors.push(`Question ${questionNumber}: Time limit must be a number`);
          } else {
            if (question.timeLimit < 10) {
              errors.push(`Question ${questionNumber}: Time limit must be at least 10 seconds`);
            }
            if (question.timeLimit > 3600) {
              errors.push(`Question ${questionNumber}: Time limit cannot exceed 3600 seconds (1 hour)`);
            }
          }
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate question timing data
   * @param {Object} questionData - Question data to validate
   * @param {String} timingMode - Quiz timing mode
   * @returns {Object} - Validation result
   */
  static validateQuestionTiming(questionData, timingMode) {
    const errors = [];
    
    if (timingMode === 'per-question') {
      if (!questionData.timeLimit) {
        errors.push('Time limit is required for per-question timing mode');
      } else {
        if (typeof questionData.timeLimit !== 'number') {
          errors.push('Time limit must be a number');
        } else {
          if (questionData.timeLimit < 10) {
            errors.push('Time limit must be at least 10 seconds');
          }
          if (questionData.timeLimit > 3600) {
            errors.push('Time limit cannot exceed 3600 seconds (1 hour)');
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Calculate total quiz time
   * @param {Object} quiz - Quiz object
   * @returns {Number} - Total time in seconds
   */
  static calculateTotalTime(quiz) {
    if (quiz.timingMode === 'total') {
      return quiz.duration * 60; // Convert minutes to seconds
    } else if (quiz.timingMode === 'per-question') {
      return quiz.questions.reduce((total, question) => {
        return total + (question.timeLimit || 0);
      }, 0);
    }
    return 0;
  }
  
  /**
   * Get recommended time limits for different question types
   * @param {String} questionType - Type of question
   * @returns {Array} - Array of recommended time limits in seconds
   */
  static getRecommendedTimeLimits(questionType) {
    const recommendations = {
      'single-select': [30, 60, 120],
      'multi-select': [60, 120, 180],
      'free-text': [120, 300, 600]
    };
    
    return recommendations[questionType] || [60, 120, 180];
  }
  
  /**
   * Validate timing mode change
   * @param {String} oldTimingMode - Current timing mode
   * @param {String} newTimingMode - New timing mode
   * @param {Array} questions - Array of questions
   * @returns {Object} - Validation result
   */
  static validateTimingModeChange(oldTimingMode, newTimingMode, questions) {
    const errors = [];
    const warnings = [];
    
    if (oldTimingMode === newTimingMode) {
      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    }
    
    // Changing from total to per-question
    if (oldTimingMode === 'total' && newTimingMode === 'per-question') {
      // Check if questions have time limits
      const questionsWithoutTimeLimit = questions.filter(q => !q.timeLimit);
      if (questionsWithoutTimeLimit.length > 0) {
        errors.push('All questions must have time limits when switching to per-question timing mode');
      }
      
      warnings.push('Switching to per-question timing will change how users experience the quiz');
    }
    
    // Changing from per-question to total
    if (oldTimingMode === 'per-question' && newTimingMode === 'total') {
      warnings.push('Question time limits will be ignored when switching to total timing mode');
      warnings.push('You may want to adjust the total quiz duration accordingly');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate attempt timing consistency
   * @param {Object} attempt - Attempt object
   * @param {Object} quiz - Quiz object
   * @returns {Object} - Validation result
   */
  static validateAttemptTiming(attempt, quiz) {
    const errors = [];
    
    // Check if timing modes match
    if (attempt.timingMode !== quiz.timingMode) {
      errors.push('Attempt timing mode does not match quiz timing mode');
    }
    
    // Validate elapsed time
    const serverElapsed = Math.floor((Date.now() - attempt.startTime.getTime()) / 1000);
    const tolerance = 30; // 30 seconds tolerance
    
    if (quiz.timingMode === 'total') {
      const maxAllowedTime = quiz.duration * 60 + tolerance;
      if (serverElapsed > maxAllowedTime) {
        errors.push('Attempt has exceeded maximum allowed time');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = QuizTimingValidator;