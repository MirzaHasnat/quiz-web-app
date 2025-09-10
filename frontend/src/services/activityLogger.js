/**
 * Activity Logger Service
 * Logs user activities during quiz attempts for monitoring and integrity purposes
 */
import axios from '../utils/axiosConfig';

class ActivityLogger {
  constructor(attemptId) {
    this.attemptId = attemptId;
    this.activities = [];
    this.isLogging = false;
    this.logBuffer = [];
    this.uploadInterval = null;
  }

  /**
   * Start logging user activities
   */
  startLogging() {
    if (this.isLogging) return;
    
    this.isLogging = true;
    this.logActivity('QUIZ_STARTED', 'Quiz attempt started');
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Start periodic upload of logs
    this.startPeriodicUpload();
  }

  /**
   * Stop logging user activities
   */
  stopLogging() {
    if (!this.isLogging) return;
    
    this.isLogging = false;
    this.logActivity('QUIZ_ENDED', 'Quiz attempt ended');
    
    // Remove event listeners
    this.removeEventListeners();
    
    // Stop periodic upload
    if (this.uploadInterval) {
      clearInterval(this.uploadInterval);
      this.uploadInterval = null;
    }
    
    // Upload remaining logs
    this.uploadLogs();
  }

  /**
   * Log an activity
   */
  logActivity(type, description, metadata = {}) {
    const activity = {
      timestamp: new Date().toISOString(),
      type,
      description,
      metadata: {
        ...metadata,
        userAgent: navigator.userAgent,
        url: window.location.href,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        windowSize: `${window.innerWidth}x${window.innerHeight}`
      }
    };

    this.logBuffer.push(activity);
    console.log('Activity logged:', activity);
  }

  /**
   * Set up event listeners for various user activities
   */
  setupEventListeners() {
    // Tab visibility changes
    this.handleVisibilityChange = () => {
      if (document.hidden) {
        this.logActivity('TAB_HIDDEN', 'User switched away from quiz tab');
      } else {
        this.logActivity('TAB_VISIBLE', 'User returned to quiz tab');
      }
    };
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Window focus/blur
    this.handleWindowBlur = () => {
      this.logActivity('WINDOW_BLUR', 'Quiz window lost focus');
    };
    this.handleWindowFocus = () => {
      this.logActivity('WINDOW_FOCUS', 'Quiz window gained focus');
    };
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);

    // Right-click attempts
    this.handleContextMenu = (e) => {
      this.logActivity('RIGHT_CLICK', 'User attempted right-click', {
        element: e.target.tagName,
        x: e.clientX,
        y: e.clientY
      });
      e.preventDefault(); // Prevent context menu
    };
    document.addEventListener('contextmenu', this.handleContextMenu);

    // Key combinations (F12, Ctrl+Shift+I, etc.)
    this.handleKeyDown = (e) => {
      const suspiciousKeys = [
        { key: 'F12', description: 'F12 pressed (Developer Tools)' },
        { key: 'F5', description: 'F5 pressed (Refresh)' },
        { key: 'F11', description: 'F11 pressed (Fullscreen toggle)' }
      ];

      const suspiciousCombinations = [
        { keys: ['Control', 'Shift', 'KeyI'], description: 'Ctrl+Shift+I (Developer Tools)' },
        { keys: ['Control', 'Shift', 'KeyJ'], description: 'Ctrl+Shift+J (Console)' },
        { keys: ['Control', 'Shift', 'KeyC'], description: 'Ctrl+Shift+C (Element Inspector)' },
        { keys: ['Control', 'KeyU'], description: 'Ctrl+U (View Source)' },
        { keys: ['Control', 'KeyR'], description: 'Ctrl+R (Refresh)' },
        { keys: ['Control', 'KeyS'], description: 'Ctrl+S (Save)' },
        { keys: ['Control', 'KeyP'], description: 'Ctrl+P (Print)' },
        { keys: ['Alt', 'Tab'], description: 'Alt+Tab (Switch Application)' },
        { keys: ['Control', 'Tab'], description: 'Ctrl+Tab (Switch Tab)' },
        { keys: ['Control', 'Shift', 'Tab'], description: 'Ctrl+Shift+Tab (Switch Tab Reverse)' }
      ];

      // Check single keys
      suspiciousKeys.forEach(({ key, description }) => {
        if (e.code === key || e.key === key) {
          this.logActivity('SUSPICIOUS_KEY', description, { key: e.key, code: e.code });
          e.preventDefault();
        }
      });

      // Check key combinations
      suspiciousCombinations.forEach(({ keys, description }) => {
        const isMatch = keys.every(key => {
          if (key === 'Control') return e.ctrlKey;
          if (key === 'Shift') return e.shiftKey;
          if (key === 'Alt') return e.altKey;
          return e.code === key || e.key === key;
        });

        if (isMatch) {
          this.logActivity('SUSPICIOUS_COMBINATION', description, {
            keys: keys.join('+'),
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey
          });
          e.preventDefault();
        }
      });
    };
    document.addEventListener('keydown', this.handleKeyDown);

    // Mouse leave/enter window
    this.handleMouseLeave = () => {
      this.logActivity('MOUSE_LEAVE', 'Mouse left the window area');
    };
    this.handleMouseEnter = () => {
      this.logActivity('MOUSE_ENTER', 'Mouse entered the window area');
    };
    document.addEventListener('mouseleave', this.handleMouseLeave);
    document.addEventListener('mouseenter', this.handleMouseEnter);

    // Copy/Paste attempts
    this.handleCopy = (e) => {
      this.logActivity('COPY_ATTEMPT', 'User attempted to copy content');
      e.preventDefault();
    };
    this.handlePaste = (e) => {
      this.logActivity('PASTE_ATTEMPT', 'User attempted to paste content');
      e.preventDefault();
    };
    document.addEventListener('copy', this.handleCopy);
    document.addEventListener('paste', this.handlePaste);

    // Print attempts
    this.handleBeforePrint = () => {
      this.logActivity('PRINT_ATTEMPT', 'User attempted to print page');
    };
    window.addEventListener('beforeprint', this.handleBeforePrint);

    // Fullscreen changes
    this.handleFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement !== null;
      this.logActivity('FULLSCREEN_CHANGE', `Fullscreen ${isFullscreen ? 'entered' : 'exited'}`);
    };
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);

    // Resize events (might indicate dev tools opening)
    this.handleResize = () => {
      this.logActivity('WINDOW_RESIZE', 'Window was resized', {
        newSize: `${window.innerWidth}x${window.innerHeight}`,
        outerSize: `${window.outerWidth}x${window.outerHeight}`
      });
    };
    window.addEventListener('resize', this.handleResize);

    // DevTools detection (basic)
    this.detectDevTools();
  }

  /**
   * Remove all event listeners
   */
  removeEventListeners() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    document.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('mouseleave', this.handleMouseLeave);
    document.removeEventListener('mouseenter', this.handleMouseEnter);
    document.removeEventListener('copy', this.handleCopy);
    document.removeEventListener('paste', this.handlePaste);
    window.removeEventListener('beforeprint', this.handleBeforePrint);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    window.removeEventListener('resize', this.handleResize);
  }

  /**
   * Basic DevTools detection
   */
  detectDevTools() {
    const devToolsChecker = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        this.logActivity('DEVTOOLS_DETECTED', 'Developer tools may be open', {
          outerWidth: window.outerWidth,
          innerWidth: window.innerWidth,
          outerHeight: window.outerHeight,
          innerHeight: window.innerHeight
        });
      }
    };

    // Check periodically
    this.devToolsInterval = setInterval(devToolsChecker, 5000);
  }

  /**
   * Start periodic upload of logs
   */
  startPeriodicUpload() {
    this.uploadInterval = setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.uploadLogs();
      }
    }, 10000); // Upload every 10 seconds
  }

  /**
   * Upload logs to server
   */
  async uploadLogs() {
    if (this.logBuffer.length === 0) return;

    try {
      const logsToUpload = [...this.logBuffer];
      this.logBuffer = []; // Clear buffer

      await axios.post(`/api/attempts/${this.attemptId}/activities`, {
        activities: logsToUpload
      });

      console.log(`Uploaded ${logsToUpload.length} activity logs`);
    } catch (error) {
      console.error('Failed to upload activity logs:', error);
      // Put logs back in buffer for retry
      this.logBuffer.unshift(...this.logBuffer);
    }
  }

  /**
   * Log question interaction
   */
  logQuestionInteraction(questionId, action, metadata = {}) {
    this.logActivity('QUESTION_INTERACTION', `Question ${action}`, {
      questionId,
      action,
      ...metadata
    });
  }

  /**
   * Log answer change
   */
  logAnswerChange(questionId, previousAnswer, newAnswer) {
    this.logActivity('ANSWER_CHANGE', 'User changed answer', {
      questionId,
      previousAnswer,
      newAnswer,
      changeTime: new Date().toISOString()
    });
  }

  /**
   * Log navigation between questions
   */
  logNavigation(from, to, method) {
    this.logActivity('NAVIGATION', `Navigated from question ${from} to ${to}`, {
      fromQuestion: from,
      toQuestion: to,
      method // 'next', 'previous', 'stepper'
    });
  }
}

export default ActivityLogger;