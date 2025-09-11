const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const Attempt = require('../models/Attempt');
const QuizTimingValidator = require('../services/quizTimingValidator');
const AttemptService = require('../services/attemptService');

// Test database setup
beforeAll(async () => {
  const url = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/quiz-app-test';
  await mongoose.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

beforeEach(async () => {
  // Clean up test data before each test
  await Quiz.deleteMany({});
  await User.deleteMany({});
  await Attempt.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Quiz Timing Settings', () => {
  let adminUser, regularUser, authToken;

  beforeEach(async () => {
    // Create test users
    adminUser = await User.create({
      username: 'admin@test.com',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin'
    });

    regularUser = await User.create({
      username: 'user@test.com',
      email: 'user@test.com',
      password: 'password123',
      role: 'user'
    });

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123'
      });
    
    authToken = loginResponse.body.token;
  });

  describe('Quiz Timing Validator', () => {
    test('should validate total timing mode', () => {
      const quizData = {
        timingMode: 'total',
        duration: 30,
        questions: []
      };

      const result = QuizTimingValidator.validateQuizTiming(quizData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate per-question timing mode', () => {
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

    test('should fail validation for total mode without duration', () => {
      const quizData = {
        timingMode: 'total',
        questions: []
      };

      const result = QuizTimingValidator.validateQuizTiming(quizData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duration is required for total timing mode');
    });

    test('should fail validation for per-question mode without time limits', () => {
      const quizData = {
        timingMode: 'per-question',
        questions: [
          { timeLimit: 60 },
          { } // Missing timeLimit
        ]
      };

      const result = QuizTimingValidator.validateQuizTiming(quizData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Question 2: Time limit is required for per-question timing mode');
    });

    test('should validate timing mode change', () => {
      const questions = [
        { timeLimit: 60 },
        { timeLimit: 120 }
      ];

      const result = QuizTimingValidator.validateTimingModeChange('total', 'per-question', questions);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Switching to per-question timing will change how users experience the quiz');
    });
  });

  describe('Quiz API with Timing', () => {
    test('should create quiz with total timing mode', async () => {
      const quizData = {
        title: 'Total Timing Quiz',
        description: 'Test quiz with total timing',
        timingMode: 'total',
        duration: 30
      };

      const response = await request(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(quizData)
        .expect(201);

      expect(response.body.data.timingMode).toBe('total');
      expect(response.body.data.duration).toBe(30);
    });

    test('should create quiz with per-question timing mode', async () => {
      const quiz = await Quiz.create({
        title: 'Per-Question Quiz',
        description: 'Test quiz',
        timingMode: 'per-question',
        createdBy: adminUser._id
      });

      const questionData = {
        type: 'single-select',
        text: 'Test question',
        timeLimit: 60,
        points: 1,
        options: [
          { text: 'Option 1', isCorrect: true },
          { text: 'Option 2', isCorrect: false }
        ]
      };

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      expect(response.body.data.timeLimit).toBe(60);
    });

    test('should reject per-question mode question without time limit', async () => {
      const quiz = await Quiz.create({
        title: 'Per-Question Quiz',
        description: 'Test quiz',
        timingMode: 'per-question',
        createdBy: adminUser._id
      });

      const questionData = {
        type: 'single-select',
        text: 'Test question',
        points: 1,
        options: [
          { text: 'Option 1', isCorrect: true },
          { text: 'Option 2', isCorrect: false }
        ]
        // Missing timeLimit
      };

      const response = await request(app)
        .post(`/api/quizzes/${quiz._id}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(400);

      expect(response.body.code).toBe('INVALID_QUESTION_TIMING');
    });

    test('should get timing recommendations', async () => {
      const response = await request(app)
        .get('/api/quizzes/timing/recommendations?questionType=single-select')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.questionType).toBe('single-select');
      expect(response.body.data.recommendations).toBeInstanceOf(Array);
      expect(response.body.data.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Attempt Service', () => {
    let totalModeQuiz, perQuestionQuiz;

    beforeEach(async () => {
      // Create total mode quiz
      totalModeQuiz = await Quiz.create({
        title: 'Total Mode Quiz',
        description: 'Test quiz',
        timingMode: 'total',
        duration: 1, // 1 minute for testing
        createdBy: adminUser._id,
        questions: [
          {
            type: 'single-select',
            text: 'Question 1',
            points: 1,
            options: [
              { text: 'Option 1', isCorrect: true },
              { text: 'Option 2', isCorrect: false }
            ]
          }
        ]
      });

      // Create per-question mode quiz
      perQuestionQuiz = await Quiz.create({
        title: 'Per-Question Quiz',
        description: 'Test quiz',
        timingMode: 'per-question',
        createdBy: adminUser._id,
        questions: [
          {
            type: 'single-select',
            text: 'Question 1',
            timeLimit: 30,
            points: 1,
            options: [
              { text: 'Option 1', isCorrect: true },
              { text: 'Option 2', isCorrect: false }
            ]
          },
          {
            type: 'single-select',
            text: 'Question 2',
            timeLimit: 45,
            points: 1,
            options: [
              { text: 'Option A', isCorrect: false },
              { text: 'Option B', isCorrect: true }
            ]
          }
        ]
      });
    });

    test('should start attempt with total timing mode', async () => {
      const attempt = await AttemptService.startAttempt(totalModeQuiz._id, regularUser._id);
      
      expect(attempt.timingMode).toBe('total');
      expect(attempt.status).toBe('in-progress');
      expect(attempt.maxScore).toBe(1);
    });

    test('should start attempt with per-question timing mode', async () => {
      const attempt = await AttemptService.startAttempt(perQuestionQuiz._id, regularUser._id);
      
      expect(attempt.timingMode).toBe('per-question');
      expect(attempt.status).toBe('in-progress');
      expect(attempt.maxScore).toBe(2);
    });

    test('should calculate timing info for total mode', async () => {
      const attempt = await AttemptService.startAttempt(totalModeQuiz._id, regularUser._id);
      const timingInfo = AttemptService.calculateTimingInfo(attempt);
      
      expect(timingInfo.timingMode).toBe('total');
      expect(timingInfo.totalTime).toBe(60); // 1 minute in seconds
      expect(timingInfo.remainingTime).toBeLessThanOrEqual(60);
      expect(timingInfo.isExpired).toBe(false);
    });

    test('should calculate timing info for per-question mode', async () => {
      const attempt = await AttemptService.startAttempt(perQuestionQuiz._id, regularUser._id);
      const timingInfo = AttemptService.calculateTimingInfo(attempt);
      
      expect(timingInfo.timingMode).toBe('per-question');
      expect(timingInfo.totalTime).toBe(75); // 30 + 45 seconds
      expect(timingInfo.remainingTime).toBeLessThanOrEqual(75);
      expect(timingInfo.questionTimeLimits).toHaveLength(2);
    });

    test('should handle question timeout', async () => {
      const attempt = await AttemptService.startAttempt(perQuestionQuiz._id, regularUser._id);
      const questionId = perQuestionQuiz.questions[0]._id;
      
      const currentAnswer = {
        selectedOptions: [perQuestionQuiz.questions[0].options[0]._id.toString()]
      };
      
      const updatedAttempt = await AttemptService.handleQuestionTimeout(
        attempt._id,
        questionId,
        currentAnswer
      );
      
      expect(updatedAttempt.timedOutQuestions).toContain(questionId);
      expect(updatedAttempt.answers).toHaveLength(1);
      expect(updatedAttempt.activities.some(a => a.type === 'QUESTION_TIMEOUT')).toBe(true);
    });

    test('should submit attempt with timing validation', async () => {
      const attempt = await AttemptService.startAttempt(totalModeQuiz._id, regularUser._id);
      
      const answers = [{
        questionId: totalModeQuiz.questions[0]._id,
        selectedOptions: [totalModeQuiz.questions[0].options[0]._id.toString()],
        textAnswer: ''
      }];
      
      const result = await AttemptService.submitAttempt(attempt._id, answers);
      
      expect(result.attempt.status).toBe('submitted');
      expect(result.attempt.totalScore).toBe(1); // Correct answer
      expect(result.autoGraded).toBe(true);
      expect(result.requiresManualReview).toBe(false);
    });

    test('should detect expired attempt', async () => {
      const attempt = await AttemptService.startAttempt(totalModeQuiz._id, regularUser._id);
      
      // Simulate expired attempt by modifying start time
      attempt.startTime = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      await attempt.save();
      
      const isExpired = AttemptService.isAttemptExpired(attempt);
      expect(isExpired).toBe(true);
      
      const remainingTime = AttemptService.getRemainingTime(attempt);
      expect(remainingTime).toBe(0);
    });
  });

  describe('Attempt API Integration', () => {
    let quiz, userToken;

    beforeEach(async () => {
      // Login as regular user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@test.com',
          password: 'password123'
        });
      
      userToken = loginResponse.body.token;

      // Create a quiz and activate it for the user
      quiz = await Quiz.create({
        title: 'Test Quiz',
        description: 'Integration test quiz',
        timingMode: 'total',
        duration: 2, // 2 minutes
        isActive: true,
        activatedUsers: [regularUser._id],
        createdBy: adminUser._id,
        questions: [
          {
            type: 'single-select',
            text: 'Test question',
            points: 1,
            options: [
              { text: 'Correct', isCorrect: true },
              { text: 'Wrong', isCorrect: false }
            ]
          }
        ]
      });
    });

    test('should check quiz timing availability', async () => {
      const response = await request(app)
        .get(`/api/attempts/check/${quiz._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.canStart).toBe(true);
      expect(response.body.data.quiz.timingMode).toBe('total');
      expect(response.body.data.quiz.duration).toBe(2);
    });

    test('should start attempt with timing information', async () => {
      const response = await request(app)
        .post(`/api/attempts/start/${quiz._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect(response.body.data.timingMode).toBe('total');
      expect(response.body.data.status).toBe('in-progress');
    });

    test('should get attempt with timing details', async () => {
      // Start attempt first
      const startResponse = await request(app)
        .post(`/api/attempts/start/${quiz._id}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      const attemptId = startResponse.body.data._id;

      const response = await request(app)
        .get(`/api/attempts/${attemptId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.timing.timingMode).toBe('total');
      expect(response.body.data.timing.totalTime).toBe(120); // 2 minutes in seconds
      expect(response.body.data.timing.remainingTime).toBeLessThanOrEqual(120);
    });

    test('should get quiz timing settings', async () => {
      const response = await request(app)
        .get(`/api/quizzes/${quiz._id}/timing-settings`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.timingSettings.timingMode).toBe('total');
      expect(response.body.data.timingSettings.duration).toBe(2);
      expect(response.body.data.timingSettings.totalTime).toBe(120);
    });
  });
});