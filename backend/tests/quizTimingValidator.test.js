const QuizTimingValidator = require('../services/quizTimingValidator');

describe('QuizTimingValidator', () => {
  describe('validateQuizTiming', () => {
    test('validates total timing mode correctly', () => {
      const quizData = {
        timingMode: 'total',
        duration: 30,
        questions: []
      };

      const result = QuizTimingValidator.validateQuizTiming(quizData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates per-question timing mode correctly', () => {
      const quizData = {
        timingMode: 'per-question',
        questions: [
          { timeLimit: 60 },
          { timeLimit: 120 }
        ]
      };

      const result = QuizTimingValidator.validateQuizTiming(quizData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects invalid timing mode', () => {
      const quizData = {
        timingMode: 'invalid',
        duration: 30
      };

      const result = QuizTimingValidator.validateQuizTiming(quizData);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid timing mode');
    });

    test('rejects total mode without duration', () => {
      const quizData = {
        timingMode: 'total',
        questions: []
      };

      const result = QuizTimingValidator.validateQuizTiming(quizData);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Duration is required');
    });

    test('rejects per-question mode with invalid time limits', () => {
      const quizData = {
        timingMode: 'per-question',
        questions: [
          { timeLimit: 5 }, // Too short
          { timeLimit: 60 }
        ]
      };

      const result = QuizTimingValidator.validateQuizTiming(quizData);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('at least 10 seconds');
    });
  });

  describe('getRecommendedTimeLimits', () => {
    test('returns recommendations for single-select questions', () => {
      const recommendations = QuizTimingValidator.getRecommendedTimeLimits('single-select');
      expect(recommendations).toEqual([30, 60, 120]);
    });

    test('returns recommendations for multi-select questions', () => {
      const recommendations = QuizTimingValidator.getRecommendedTimeLimits('multi-select');
      expect(recommendations).toEqual([60, 120, 180]);
    });

    test('returns recommendations for free-text questions', () => {
      const recommendations = QuizTimingValidator.getRecommendedTimeLimits('free-text');
      expect(recommendations).toEqual([120, 300, 600]);
    });

    test('returns default recommendations for unknown question type', () => {
      const recommendations = QuizTimingValidator.getRecommendedTimeLimits('unknown');
      expect(recommendations).toEqual([60, 120, 180]);
    });
  });

  describe('validateTimingModeChange', () => {
    test('allows valid timing mode change', () => {
      const questions = [
        { timeLimit: 60 },
        { timeLimit: 120 }
      ];

      const result = QuizTimingValidator.validateTimingModeChange('total', 'per-question', questions);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Switching to per-question timing will change how users experience the quiz');
    });

    test('rejects change to per-question without time limits', () => {
      const questions = [
        { timeLimit: 60 },
        { } // Missing timeLimit
      ];

      const result = QuizTimingValidator.validateTimingModeChange('total', 'per-question', questions);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('All questions must have time limits');
    });

    test('allows same timing mode', () => {
      const result = QuizTimingValidator.validateTimingModeChange('total', 'total', []);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('calculateTotalTime', () => {
    test('calculates total time for total mode', () => {
      const quiz = {
        timingMode: 'total',
        duration: 30 // 30 minutes
      };

      const totalTime = QuizTimingValidator.calculateTotalTime(quiz);
      expect(totalTime).toBe(1800); // 30 * 60 = 1800 seconds
    });

    test('calculates total time for per-question mode', () => {
      const quiz = {
        timingMode: 'per-question',
        questions: [
          { timeLimit: 60 },
          { timeLimit: 120 },
          { timeLimit: 90 }
        ]
      };

      const totalTime = QuizTimingValidator.calculateTotalTime(quiz);
      expect(totalTime).toBe(270); // 60 + 120 + 90 = 270 seconds
    });

    test('returns 0 for invalid quiz', () => {
      const totalTime = QuizTimingValidator.calculateTotalTime({});
      expect(totalTime).toBe(0);
    });
  });
});