import TimerManagerService from '../timerManagerService';

// Mock timers
jest.useFakeTimers();

describe('TimerManagerService', () => {
  let timerManager;
  let mockCallbacks;
  let mockQuiz;
  let mockAttempt;

  beforeEach(() => {
    mockCallbacks = {
      onTimeUpdate: jest.fn(),
      onTimeExpired: jest.fn(),
      onQuestionTimeout: jest.fn(),
      onWarning: jest.fn(),
      onCritical: jest.fn()
    };

    mockQuiz = {
      questions: [
        { timeLimit: 60 },
        { timeLimit: 90 },
        { timeLimit: 120 }
      ]
    };

    mockAttempt = {
      startTime: new Date()
    };

    timerManager = new TimerManagerService(
      'total',
      mockQuiz,
      mockAttempt,
      mockCallbacks
    );
  });

  afterEach(() => {
    if (timerManager) {
      timerManager.destroy();
    }
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Total Timer Mode', () => {
    test('should start total timer correctly', () => {
      timerManager.start(300); // 5 minutes

      expect(timerManager.isRunning).toBe(true);
      expect(timerManager.getState().activeTimers).toContain('total');
    });

    test('should count down total timer', () => {
      timerManager.start(10); // 10 seconds

      // Fast-forward 5 seconds
      jest.advanceTimersByTime(5000);

      expect(mockCallbacks.onTimeUpdate).toHaveBeenCalledWith('total', 5);
    });

    test('should trigger time expired when total timer reaches zero', () => {
      timerManager.start(3); // 3 seconds

      // Fast-forward to expiration
      jest.advanceTimersByTime(3000);

      expect(mockCallbacks.onTimeExpired).toHaveBeenCalledWith('total');
      expect(timerManager.isRunning).toBe(false);
    });

    test('should trigger warning at 25% time remaining', () => {
      timerManager.start(100); // 100 seconds

      // Fast-forward to 76 seconds (24% remaining)
      jest.advanceTimersByTime(76000);

      expect(mockCallbacks.onWarning).toHaveBeenCalledWith('total', 24);
    });

    test('should trigger critical at 10% time remaining', () => {
      timerManager.start(100); // 100 seconds

      // Fast-forward to 91 seconds (9% remaining)
      jest.advanceTimersByTime(91000);

      expect(mockCallbacks.onCritical).toHaveBeenCalledWith('total', 9);
    });
  });

  describe('Per-Question Timer Mode', () => {
    beforeEach(() => {
      timerManager = new TimerManagerService(
        'per-question',
        mockQuiz,
        mockAttempt,
        mockCallbacks
      );
    });

    test('should start question timer correctly', () => {
      timerManager.start(0, 0); // Start with first question

      expect(timerManager.isRunning).toBe(true);
      expect(timerManager.getState().activeTimers).toContain('question');
    });

    test('should count down question timer', () => {
      timerManager.start(0, 0); // First question (60 seconds)

      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);

      expect(mockCallbacks.onTimeUpdate).toHaveBeenCalledWith('question', 30, 0);
    });

    test('should auto-advance to next question on timeout', () => {
      timerManager.start(0, 0); // First question (60 seconds)

      // Fast-forward to question timeout
      jest.advanceTimersByTime(60000);

      expect(mockCallbacks.onQuestionTimeout).toHaveBeenCalledWith(0);
      // Should start timer for next question
      expect(mockCallbacks.onTimeUpdate).toHaveBeenCalledWith('question', 89, 1);
    });

    test('should finish quiz when last question times out', () => {
      timerManager.start(0, 2); // Last question (120 seconds)

      // Fast-forward to question timeout
      jest.advanceTimersByTime(120000);

      expect(mockCallbacks.onQuestionTimeout).toHaveBeenCalledWith(2);
      expect(mockCallbacks.onTimeExpired).toHaveBeenCalledWith('per-question');
      expect(timerManager.isRunning).toBe(false);
    });

    test('should switch to specific question', () => {
      timerManager.start(0, 0);

      // Switch to question 1 (90 seconds)
      timerManager.switchToQuestion(1);

      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);

      expect(mockCallbacks.onTimeUpdate).toHaveBeenCalledWith('question', 60, 1);
    });

    test('should trigger question-level warnings', () => {
      timerManager.start(0, 0); // First question (60 seconds)

      // Fast-forward to warning threshold (25% = 15 seconds remaining)
      jest.advanceTimersByTime(46000); // 60 - 14 = 46 seconds elapsed

      expect(mockCallbacks.onWarning).toHaveBeenCalledWith('question', 14);
    });
  });

  describe('Timer Control', () => {
    test('should pause and resume timer', () => {
      timerManager.start(60);

      // Run for 10 seconds
      jest.advanceTimersByTime(10000);
      expect(mockCallbacks.onTimeUpdate).toHaveBeenCalledWith('total', 50);

      // Pause
      timerManager.pause();
      expect(timerManager.isPaused).toBe(true);

      // Time should not advance while paused
      jest.advanceTimersByTime(5000);
      expect(mockCallbacks.onTimeUpdate).not.toHaveBeenCalledWith('total', 45);

      // Resume
      timerManager.resume();
      expect(timerManager.isPaused).toBe(false);

      // Time should continue from where it left off
      jest.advanceTimersByTime(10000);
      expect(mockCallbacks.onTimeUpdate).toHaveBeenCalledWith('total', 40);
    });

    test('should stop all timers', () => {
      timerManager.start(60);
      expect(timerManager.isRunning).toBe(true);

      timerManager.stop();
      expect(timerManager.isRunning).toBe(false);
      expect(timerManager.getState().activeTimers).toHaveLength(0);
    });

    test('should clear specific timer type', () => {
      timerManager.start(60);
      expect(timerManager.getState().activeTimers).toContain('total');

      timerManager.clearTimer('total');
      expect(timerManager.getState().activeTimers).not.toContain('total');
    });
  });

  describe('Static Utility Methods', () => {
    test('should calculate remaining time correctly', () => {
      const startTime = Date.now() - 30000; // 30 seconds ago
      const duration = 2; // 2 minutes

      const remaining = TimerManagerService.calculateRemainingTime(startTime, duration);
      expect(remaining).toBe(90); // 120 - 30 = 90 seconds
    });

    test('should calculate question remaining time correctly', () => {
      const questionStartTime = Date.now() - 15000; // 15 seconds ago
      const timeLimit = 60; // 60 seconds

      const remaining = TimerManagerService.calculateQuestionRemainingTime(questionStartTime, timeLimit);
      expect(remaining).toBe(45); // 60 - 15 = 45 seconds
    });

    test('should format time correctly', () => {
      expect(TimerManagerService.formatTime(125)).toBe('02:05');
      expect(TimerManagerService.formatTime(3665, true)).toBe('01:01:05');
      expect(TimerManagerService.formatTime(0)).toBe('00:00');
      expect(TimerManagerService.formatTime(-5)).toBe('00:00');
    });

    test('should handle edge cases in time calculations', () => {
      // Future start time
      const futureStart = Date.now() + 10000;
      const remaining = TimerManagerService.calculateRemainingTime(futureStart, 5);
      expect(remaining).toBeGreaterThan(300); // Should be more than 5 minutes

      // Zero duration
      const zeroRemaining = TimerManagerService.calculateRemainingTime(Date.now(), 0);
      expect(zeroRemaining).toBe(0);
    });
  });

  describe('Warning State Management', () => {
    test('should track warning states correctly', () => {
      timerManager.start(100);

      // Initially no warnings
      expect(timerManager.getState().warningStates.total.warning).toBe(false);
      expect(timerManager.getState().warningStates.total.critical).toBe(false);

      // Trigger warning
      jest.advanceTimersByTime(76000); // 24% remaining
      expect(timerManager.getState().warningStates.total.warning).toBe(true);

      // Trigger critical
      jest.advanceTimersByTime(15000); // 9% remaining
      expect(timerManager.getState().warningStates.total.critical).toBe(true);
    });

    test('should not trigger duplicate warnings', () => {
      timerManager.start(100);

      // Trigger warning
      jest.advanceTimersByTime(80000); // 20% remaining
      expect(mockCallbacks.onWarning).toHaveBeenCalledTimes(1);

      // Continue in warning range
      jest.advanceTimersByTime(5000); // 15% remaining
      expect(mockCallbacks.onWarning).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('Error Handling', () => {
    test('should handle missing question gracefully', () => {
      const emptyQuiz = { questions: [] };
      const emptyTimerManager = new TimerManagerService(
        'per-question',
        emptyQuiz,
        mockAttempt,
        mockCallbacks
      );

      // Should not crash when starting with no questions
      expect(() => emptyTimerManager.start(0, 0)).not.toThrow();

      emptyTimerManager.destroy();
    });

    test('should handle invalid question index', () => {
      timerManager = new TimerManagerService(
        'per-question',
        mockQuiz,
        mockAttempt,
        mockCallbacks
      );

      // Should not crash with invalid index
      expect(() => timerManager.start(0, 999)).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    test('should clean up properly on destroy', () => {
      timerManager.start(60);
      expect(timerManager.isRunning).toBe(true);

      timerManager.destroy();
      expect(timerManager.isRunning).toBe(false);
      expect(timerManager.callbacks).toEqual({});
      expect(timerManager.quiz).toBeNull();
      expect(timerManager.attempt).toBeNull();
    });

    test('should prevent multiple timer instances', () => {
      timerManager.start(60);
      const firstTimerCount = timerManager.getState().activeTimers.length;

      // Starting again should clean up previous timer
      timerManager.start(120);
      const secondTimerCount = timerManager.getState().activeTimers.length;

      expect(firstTimerCount).toBe(secondTimerCount);
    });
  });
});
