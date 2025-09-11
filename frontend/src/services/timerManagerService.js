/**
 * Timer Manager Service
 * Handles timer logic, state management, and callbacks for quiz timing
 */

class TimerManagerService {
  constructor(timingMode, quiz, attempt, callbacks = {}) {
    // Enhanced validation for constructor parameters
    if (!timingMode || !['total', 'per-question'].includes(timingMode)) {
      throw new Error(`Invalid timing mode: ${timingMode}. Must be 'total' or 'per-question'`);
    }
    
    if (!quiz || typeof quiz !== 'object') {
      throw new Error('Quiz object is required and must be a valid object');
    }
    
    if (timingMode === 'per-question' && (!quiz.questions || !Array.isArray(quiz.questions))) {
      throw new Error('Per-question mode requires quiz to have a questions array');
    }
    
    if (timingMode === 'total' && (!quiz.duration || typeof quiz.duration !== 'number' || quiz.duration <= 0)) {
      throw new Error('Total mode requires quiz to have a valid duration (positive number)');
    }
    
    this.timingMode = timingMode;
    this.quiz = quiz;
    this.attempt = attempt || {};
    this.callbacks = {
      onTimeUpdate: callbacks.onTimeUpdate || (() => {}),
      onTimeExpired: callbacks.onTimeExpired || (() => {}),
      onQuestionTimeout: callbacks.onQuestionTimeout || (() => {}),
      onWarning: callbacks.onWarning || (() => {}),
      onCritical: callbacks.onCritical || (() => {}),
      onError: callbacks.onError || ((error) => console.error('[TimerManager] Error:', error))
    };
    
    // Timer references
    this.timers = new Map();
    this.intervals = new Map();
    
    // State tracking
    this.isRunning = false;
    this.isPaused = false;
    this.startTime = null;
    this.pausedTime = 0;
    
    // Warning thresholds (percentages)
    this.warningThreshold = 25; // Show warning at 25% time remaining
    this.criticalThreshold = 10; // Show critical alert at 10% time remaining
    
    // Warning state tracking
    this.warningStates = {
      total: { warning: false, critical: false },
      question: { warning: false, critical: false }
    };
    
    console.log(`[TimerManager] Initialized successfully for ${timingMode} mode`);
  }

  /**
   * Start the timer system
   * @param {number} remainingTime - Remaining time in seconds
   * @param {number} currentQuestionIndex - Current question index (for per-question mode)
   * @param {number} questionTimeRemaining - Remaining time for current question (for per-question mode)
   */
  start(remainingTime, currentQuestionIndex = 0, questionTimeRemaining = null) {
    if (this.isRunning) {
      console.log('[TimerManager] Timer already running, skipping start');
      return;
    }
    
    // Enhanced validation
    try {
      if (this.timingMode === 'total') {
        if (typeof remainingTime !== 'number' || isNaN(remainingTime) || remainingTime < 0) {
          throw new Error(`Invalid remainingTime for total mode: ${remainingTime}`);
        }
        this.startTotalTimer(remainingTime);
      } else if (this.timingMode === 'per-question') {
        if (typeof currentQuestionIndex !== 'number' || currentQuestionIndex < 0) {
          throw new Error(`Invalid currentQuestionIndex: ${currentQuestionIndex}`);
        }
        if (!this.quiz?.questions || currentQuestionIndex >= this.quiz.questions.length) {
          throw new Error(`Invalid question index ${currentQuestionIndex} for quiz with ${this.quiz?.questions?.length || 0} questions`);
        }
        // Use the provided questionTimeRemaining for resuming
        this.startQuestionTimer(currentQuestionIndex, questionTimeRemaining);
      } else {
        throw new Error(`Invalid timing mode: ${this.timingMode}`);
      }
      
      this.isRunning = true;
      this.startTime = Date.now() - this.pausedTime;
      
      console.log(`[TimerManager] Started ${this.timingMode} timer successfully`);
    } catch (error) {
      console.error('[TimerManager] Error starting timer:', error);
      // Call error callback if available
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      throw error;
    }
  }

  /**
   * Start total quiz timer
   * @param {number} remainingTime - Remaining time in seconds
   */
  startTotalTimer(remainingTime) {
    this.clearTimer('total');
    
    // Validate input
    if (typeof remainingTime !== 'number' || isNaN(remainingTime) || remainingTime < 0) {
      console.error(`[TimerManager] Invalid remainingTime: ${remainingTime}`);
      return;
    }
    
    let timeLeft = Math.floor(remainingTime); // Ensure integer
    
    const timer = setInterval(() => {
      if (this.isPaused) return;
      
      timeLeft--;
      
      // Check warning states
      this.checkWarningStates('total', timeLeft, remainingTime);
      
      // Callback with updated time
      this.callbacks.onTimeUpdate('total', timeLeft);
      
      if (timeLeft <= 0) {
        this.clearTimer('total');
        this.callbacks.onTimeExpired('total');
        this.stop();
      }
    }, 1000);
    
    this.timers.set('total', timer);
    console.log(`[TimerManager] Total timer started with ${timeLeft} seconds`);
  }

  /**
   * Start question timer for per-question mode
   * @param {number} questionIndex - Current question index
   * @param {number} customTimeRemaining - Optional custom remaining time for resuming
   */
  startQuestionTimer(questionIndex, customTimeRemaining = null) {
    this.clearTimer('question');
    
    // Validate input
    if (!this.quiz?.questions || questionIndex < 0 || questionIndex >= this.quiz.questions.length) {
      console.error(`[TimerManager] Invalid question index: ${questionIndex}`);
      return;
    }
    
    const question = this.quiz.questions[questionIndex];
    if (!question) {
      console.error(`[TimerManager] Question not found at index: ${questionIndex}`);
      return;
    }
    
    const timeLimit = question.timeLimit || 60; // Default to 60 seconds
    let timeLeft = customTimeRemaining !== null ? Math.floor(customTimeRemaining) : Math.floor(timeLimit);
    const initialTime = timeLimit; // Use original time limit for percentage calculations
    
    console.log(`[TimerManager] Starting question ${questionIndex} timer with ${timeLeft} seconds remaining (limit: ${timeLimit}s)`);
    
    const timer = setInterval(() => {
      if (this.isPaused) return;
      
      timeLeft--;
      
      // Check warning states for question
      this.checkWarningStates('question', timeLeft, initialTime);
      
      // Callback with updated time
      this.callbacks.onTimeUpdate('question', timeLeft, questionIndex);
      
      if (timeLeft <= 0) {
        this.clearTimer('question');
        this.callbacks.onQuestionTimeout(questionIndex);
        
        // Auto-advance to next question or finish quiz
        const nextQuestionIndex = questionIndex + 1;
        if (nextQuestionIndex < this.quiz.questions.length) {
          this.startQuestionTimer(nextQuestionIndex);
        } else {
          this.callbacks.onTimeExpired('per-question');
          this.stop();
        }
      }
    }, 1000);
    
    this.timers.set('question', timer);
  }

  /**
   * Switch to next question (per-question mode)
   * @param {number} nextQuestionIndex - Next question index
   * @param {number} customTimeRemaining - Optional custom remaining time for resuming
   */
  switchToQuestion(nextQuestionIndex, customTimeRemaining = null) {
    if (this.timingMode !== 'per-question') return;
    
    this.startQuestionTimer(nextQuestionIndex, customTimeRemaining);
  }

  /**
   * Pause all timers
   */
  pause() {
    if (!this.isRunning || this.isPaused) return;
    
    this.isPaused = true;
    this.pausedTime = Date.now() - this.startTime;
    
    console.log('[TimerManager] Paused');
  }

  /**
   * Resume all timers
   */
  resume() {
    if (!this.isRunning || !this.isPaused) return;
    
    this.isPaused = false;
    this.startTime = Date.now() - this.pausedTime;
    
    console.log('[TimerManager] Resumed');
  }

  /**
   * Stop all timers
   */
  stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.clearAllTimers();
    
    console.log('[TimerManager] Stopped');
  }

  /**
   * Clear specific timer
   * @param {string} timerType - Type of timer ('total', 'question')
   */
  clearTimer(timerType) {
    const timer = this.timers.get(timerType);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(timerType);
    }
  }

  /**
   * Clear all timers
   */
  clearAllTimers() {
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.clear();
  }

  /**
   * Check and trigger warning states
   * @param {string} type - Timer type ('total', 'question')
   * @param {number} remaining - Remaining time
   * @param {number} total - Total time
   */
  checkWarningStates(type, remaining, total) {
    const percentRemaining = (remaining / total) * 100;
    const currentState = this.warningStates[type];
    
    // Critical state (10% or less)
    if (percentRemaining <= this.criticalThreshold && !currentState.critical) {
      currentState.critical = true;
      this.callbacks.onCritical(type, remaining);
      console.log(`[TimerManager] Critical warning for ${type} timer: ${remaining}s remaining`);
    }
    // Warning state (25% or less, but more than critical)
    else if (percentRemaining <= this.warningThreshold && percentRemaining > this.criticalThreshold && !currentState.warning) {
      currentState.warning = true;
      this.callbacks.onWarning(type, remaining);
      console.log(`[TimerManager] Warning for ${type} timer: ${remaining}s remaining`);
    }
  }

  /**
   * Get current timing state with enhanced error handling
   * @returns {Object} Current state information
   */
  getState() {
    try {
      return {
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        timingMode: this.timingMode,
        activeTimers: Array.from(this.timers.keys()),
        warningStates: JSON.parse(JSON.stringify(this.warningStates)), // Deep copy
        hasValidQuiz: !!(this.quiz && typeof this.quiz === 'object'),
        questionsCount: this.quiz?.questions?.length || 0
      };
    } catch (error) {
      console.error('[TimerManager] Error getting state:', error);
      return {
        isRunning: false,
        isPaused: false,
        timingMode: this.timingMode || 'unknown',
        activeTimers: [],
        warningStates: { total: { warning: false, critical: false }, question: { warning: false, critical: false } },
        hasValidQuiz: false,
        questionsCount: 0,
        error: error.message
      };
    }
  }

  /**
   * Calculate remaining time for total mode
   * @param {number} startTime - Quiz start time (timestamp)
   * @param {number} duration - Quiz duration in minutes
   * @returns {number} Remaining time in seconds
   */
  static calculateRemainingTime(startTime, duration) {
    const elapsedMs = Date.now() - startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const totalSeconds = duration * 60;
    
    return Math.max(0, totalSeconds - elapsedSeconds);
  }

  /**
   * Calculate remaining time for a specific question
   * @param {number} questionStartTime - Question start time (timestamp)
   * @param {number} timeLimit - Question time limit in seconds
   * @returns {number} Remaining time in seconds
   */
  static calculateQuestionRemainingTime(questionStartTime, timeLimit) {
    const elapsedMs = Date.now() - questionStartTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    
    return Math.max(0, timeLimit - elapsedSeconds);
  }

  /**
   * Format time for display
   * @param {number} seconds - Time in seconds
   * @param {boolean} showHours - Whether to show hours
   * @returns {string} Formatted time string
   */
  static formatTime(seconds, showHours = false) {
    if (!seconds || seconds < 0) return showHours ? '00:00:00' : '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (showHours || hours > 0) {
      return [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        remainingSeconds.toString().padStart(2, '0')
      ].join(':');
    }
    
    return [
      minutes.toString().padStart(2, '0'),
      remainingSeconds.toString().padStart(2, '0')
    ].join(':');
  }

  /**
   * Destroy timer manager and cleanup with enhanced safety
   */
  destroy() {
    try {
      this.stop();
      
      // Clear all timers safely
      this.timers.forEach((timer, key) => {
        try {
          clearInterval(timer);
        } catch (error) {
          console.warn(`[TimerManager] Error clearing timer ${key}:`, error);
        }
      });
      this.timers.clear();
      
      // Clear intervals
      this.intervals.forEach((interval, key) => {
        try {
          clearInterval(interval);
        } catch (error) {
          console.warn(`[TimerManager] Error clearing interval ${key}:`, error);
        }
      });
      this.intervals.clear();
      
      // Reset state
      this.callbacks = {};
      this.quiz = null;
      this.attempt = null;
      this.warningStates = {
        total: { warning: false, critical: false },
        question: { warning: false, critical: false }
      };
      
      console.log('[TimerManager] Destroyed successfully');
    } catch (error) {
      console.error('[TimerManager] Error during destruction:', error);
    }
  }
}

export default TimerManagerService;