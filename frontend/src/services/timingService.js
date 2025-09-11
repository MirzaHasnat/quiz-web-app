/**
 * Timing Service for Quiz Management
 * Handles timing-related API calls and utility functions
 */

import axios from '../utils/axiosConfig';

class TimingService {
  /**
   * Get timing recommendations for a question type
   * @param {string} questionType - Type of question
   * @returns {Promise} - API response with recommendations
   */
  static async getTimingRecommendations(questionType) {
    try {
      const response = await axios.get('/api/quizzes/timing/recommendations', {
        params: { questionType }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting timing recommendations:', error);
      // Return default recommendations if API fails
      return {
        status: 'success',
        data: {
          questionType,
          recommendations: this.getDefaultRecommendations(questionType)
        }
      };
    }
  }

  /**
   * Get default timing recommendations (offline fallback)
   * @param {string} questionType - Type of question
   * @returns {Array} - Array of recommended time limits
   */
  static getDefaultRecommendations(questionType) {
    const recommendations = {
      'single-select': [
        { seconds: 30, display: '0:30' },
        { seconds: 60, display: '1:00' },
        { seconds: 120, display: '2:00' }
      ],
      'multi-select': [
        { seconds: 60, display: '1:00' },
        { seconds: 120, display: '2:00' },
        { seconds: 180, display: '3:00' }
      ],
      'free-text': [
        { seconds: 120, display: '2:00' },
        { seconds: 300, display: '5:00' },
        { seconds: 600, display: '10:00' }
      ]
    };
    
    return recommendations[questionType] || recommendations['single-select'];
  }

  /**
   * Format time in seconds to MM:SS format
   * @param {number} seconds - Time in seconds
   * @returns {string} - Formatted time string
   */
  static formatTime(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Format time in seconds to HH:MM:SS format
   * @param {number} seconds - Time in seconds
   * @returns {string} - Formatted time string
   */
  static formatTimeWithHours(seconds) {
    if (!seconds || seconds < 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      remainingSeconds.toString().padStart(2, '0')
    ].join(':');
  }

  /**
   * Parse time string (MM:SS or HH:MM:SS) to seconds
   * @param {string} timeString - Time string to parse
   * @returns {number} - Time in seconds
   */
  static parseTimeToSeconds(timeString) {
    if (!timeString || typeof timeString !== 'string') return 0;
    
    const parts = timeString.split(':').map(part => parseInt(part, 10) || 0);
    
    if (parts.length === 2) {
      // MM:SS format
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS format
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    
    return 0;
  }

  /**
   * Validate time limit for a question type
   * @param {number} timeLimit - Time limit in seconds
   * @param {string} questionType - Type of question
   * @returns {Object} - Validation result
   */
  static validateTimeLimit(timeLimit, questionType) {
    const errors = [];
    
    if (!timeLimit || typeof timeLimit !== 'number') {
      errors.push('Time limit is required');
    } else {
      if (timeLimit < 10) {
        errors.push('Time limit must be at least 10 seconds');
      }
      if (timeLimit > 3600) {
        errors.push('Time limit cannot exceed 3600 seconds (1 hour)');
      }
      
      // Type-specific recommendations
      const recommendations = this.getDefaultRecommendations(questionType);
      const minRecommended = recommendations[0]?.seconds || 30;
      const maxRecommended = recommendations[recommendations.length - 1]?.seconds || 180;
      
      if (timeLimit < minRecommended) {
        errors.push(`Consider using at least ${minRecommended} seconds for ${questionType} questions`);
      }
      if (timeLimit > maxRecommended * 2) {
        errors.push(`${timeLimit} seconds might be too long for ${questionType} questions`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: errors.filter(e => e.includes('Consider') || e.includes('might'))
    };
  }

  /**
   * Calculate total quiz time for per-question mode
   * @param {Array} questions - Array of questions with time limits
   * @returns {number} - Total time in seconds
   */
  static calculateTotalQuestionTime(questions) {
    if (!Array.isArray(questions)) return 0;
    
    return questions.reduce((total, question) => {
      return total + (question.timeLimit || 60); // default 60 seconds if not set
    }, 0);
  }

  /**
   * Get timing mode display information
   * @param {string} timingMode - Timing mode ('total' or 'per-question')
   * @param {Object} quiz - Quiz object
   * @returns {Object} - Display information
   */
  static getTimingModeInfo(timingMode, quiz) {
    if (timingMode === 'total') {
      return {
        mode: 'total',
        displayName: 'Total Quiz Duration',
        description: 'Single timer for the entire quiz',
        totalTime: quiz.duration * 60, // convert minutes to seconds
        icon: '⏱️'
      };
    } else {
      const totalTime = this.calculateTotalQuestionTime(quiz.questions || []);
      return {
        mode: 'per-question',
        displayName: 'Per Question Duration',
        description: 'Individual timers for each question',
        totalTime,
        questionCount: (quiz.questions || []).length,
        icon: '⏲️'
      };
    }
  }
}

export default TimingService;