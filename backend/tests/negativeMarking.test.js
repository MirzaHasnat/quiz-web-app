const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Quiz = require('../models/Quiz');
const Attempt = require('../models/Attempt');
const User = require('../models/User');

describe('Negative Marking Automatic Recalculation', () => {
  let adminToken;
  let userToken;
  let adminUser;
  let regularUser;
  let quiz;
  let attempt;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/quiz-test');
    
    // Clean up existing data
    await User.deleteMany({});
    await Quiz.deleteMany({});
    await Attempt.deleteMany({});
  });

  beforeEach(async () => {
    // Create admin user
    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'admin',
        password: 'password123',
        role: 'admin'
      });
    
    adminUser = adminResponse.body.data.user;
    adminToken = adminResponse.body.data.token;

    // Create regular user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        password: 'password123',
        role: 'user'
      });
    
    regularUser = userResponse.body.data.user;
    userToken = userResponse.body.data.token;

    // Create a quiz without negative marking
    const quizResponse = await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Quiz',
        description: 'Test Description',
        duration: 30,
        questions: [
          {
            type: 'single-select',
            text: 'What is 2+2?',
            points: 1,
            options: [
              { text: '3', isCorrect: false },
              { text: '4', isCorrect: true },
              { text: '5', isCorrect: false }
            ]
          },
          {
            type: 'single-select',
            text: 'What is 3+3?',
            points: 1,
            options: [
              { text: '5', isCorrect: false },
              { text: '6', isCorrect: true },
              { text: '7', isCorrect: false }
            ]
          }
        ],
        negativeMarking: {
          enabled: false,
          penaltyValue: 0
        }
      });

    quiz = quizResponse.body.data;

    // Activate quiz for user
    await request(app)
      .put(`/api/quizzes/${quiz._id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: regularUser._id,
        activate: true
      });

    // Start attempt
    const attemptResponse = await request(app)
      .post(`/api/attempts/start/${quiz._id}`)
      .set('Authorization', `Bearer ${userToken}`);

    attempt = attemptResponse.body.data;

    // Submit attempt with one correct and one incorrect answer
    await request(app)
      .put(`/api/attempts/submit/${quiz._id}/${attempt._id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        answers: [
          {
            questionId: quiz.questions[0]._id,
            selectedOptions: [quiz.questions[0].options[1]._id] // Correct answer
          },
          {
            questionId: quiz.questions[1]._id,
            selectedOptions: [quiz.questions[1].options[0]._id] // Incorrect answer
          }
        ]
      });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Quiz.deleteMany({});
    await Attempt.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('should automatically recalculate scores when negative marking is enabled', async () => {
    // First, verify initial score (should be 1 point for correct answer, 0 penalty)
    let attemptDetails = await request(app)
      .get(`/api/attempts/${attempt._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(attemptDetails.body.data.totalScore).toBe(1);
    expect(attemptDetails.body.data.negativeMarkingApplied).toBe(false);

    // Enable negative marking with 0.5 penalty
    const updateResponse = await request(app)
      .put(`/api/quizzes/${quiz._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        negativeMarking: {
          enabled: true,
          penaltyValue: 0.5
        }
      });

    // Check that scores were recalculated
    expect(updateResponse.body.data.scoresRecalculated).toBeDefined();
    expect(updateResponse.body.data.scoresRecalculated.attemptsProcessed).toBe(1);
    expect(updateResponse.body.data.scoresRecalculated.attemptsUpdated).toBe(1);

    // Verify the attempt score was updated
    attemptDetails = await request(app)
      .get(`/api/attempts/${attempt._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(attemptDetails.body.data.totalScore).toBe(0.5); // 1 correct - 0.5 penalty
    expect(attemptDetails.body.data.negativeMarkingApplied).toBe(true);

    // Check individual answer scores
    const correctAnswer = attemptDetails.body.data.answers.find(a => a.questionId === quiz.questions[0]._id);
    const incorrectAnswer = attemptDetails.body.data.answers.find(a => a.questionId === quiz.questions[1]._id);

    expect(correctAnswer.score).toBe(1);
    expect(correctAnswer.negativeScore).toBe(0);
    expect(incorrectAnswer.score).toBe(0);
    expect(incorrectAnswer.negativeScore).toBe(0.5);
  });

  test('should automatically recalculate scores when negative marking is disabled', async () => {
    // First enable negative marking
    await request(app)
      .put(`/api/quizzes/${quiz._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        negativeMarking: {
          enabled: true,
          penaltyValue: 0.5
        }
      });

    // Verify negative marking is applied
    let attemptDetails = await request(app)
      .get(`/api/attempts/${attempt._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(attemptDetails.body.data.totalScore).toBe(0.5);
    expect(attemptDetails.body.data.negativeMarkingApplied).toBe(true);

    // Now disable negative marking
    const updateResponse = await request(app)
      .put(`/api/quizzes/${quiz._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        negativeMarking: {
          enabled: false,
          penaltyValue: 0
        }
      });

    // Check that scores were recalculated
    expect(updateResponse.body.data.scoresRecalculated).toBeDefined();
    expect(updateResponse.body.data.scoresRecalculated.attemptsProcessed).toBe(1);
    expect(updateResponse.body.data.scoresRecalculated.attemptsUpdated).toBe(1);

    // Verify the attempt score was updated back to original
    attemptDetails = await request(app)
      .get(`/api/attempts/${attempt._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(attemptDetails.body.data.totalScore).toBe(1); // Back to 1 point, no penalty
    expect(attemptDetails.body.data.negativeMarkingApplied).toBe(false);

    // Check individual answer scores
    const incorrectAnswer = attemptDetails.body.data.answers.find(a => a.questionId === quiz.questions[1]._id);
    expect(incorrectAnswer.negativeScore).toBe(0);
  });

  test('should handle penalty value changes correctly', async () => {
    // Enable negative marking with 0.25 penalty
    await request(app)
      .put(`/api/quizzes/${quiz._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        negativeMarking: {
          enabled: true,
          penaltyValue: 0.25
        }
      });

    // Verify initial penalty
    let attemptDetails = await request(app)
      .get(`/api/attempts/${attempt._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(attemptDetails.body.data.totalScore).toBe(0.75); // 1 - 0.25

    // Change penalty value to 1.0
    const updateResponse = await request(app)
      .put(`/api/quizzes/${quiz._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        negativeMarking: {
          enabled: true,
          penaltyValue: 1.0
        }
      });

    // Check that scores were recalculated
    expect(updateResponse.body.data.scoresRecalculated).toBeDefined();
    expect(updateResponse.body.data.scoresRecalculated.attemptsUpdated).toBe(1);

    // Verify the new penalty is applied
    attemptDetails = await request(app)
      .get(`/api/attempts/${attempt._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(attemptDetails.body.data.totalScore).toBe(0); // 1 - 1.0
    
    const incorrectAnswer = attemptDetails.body.data.answers.find(a => a.questionId === quiz.questions[1]._id);
    expect(incorrectAnswer.negativeScore).toBe(1.0);
  });

  test('should work with manual recalculation endpoint', async () => {
    // Enable negative marking
    await request(app)
      .put(`/api/quizzes/${quiz._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        negativeMarking: {
          enabled: true,
          penaltyValue: 0.5
        }
      });

    // Use manual recalculation endpoint
    const recalcResponse = await request(app)
      .put(`/api/attempts/recalculate-scores/${quiz._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(recalcResponse.body.status).toBe('success');
    expect(recalcResponse.body.data.processed).toBe(1);
    expect(recalcResponse.body.data.updated).toBe(0); // Already updated by quiz update
    expect(recalcResponse.body.data.negativeMarkingEnabled).toBe(true);
    expect(recalcResponse.body.data.penaltyValue).toBe(0.5);
  });
});