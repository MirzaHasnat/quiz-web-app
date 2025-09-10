const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Attempt = require('../models/Attempt');
const jwt = require('jsonwebtoken');

// Mock data
const testUser = {
  _id: new mongoose.Types.ObjectId(),
  username: 'testuser',
  password: 'password123',
  role: 'user',
  isBlocked: false
};

const testAdmin = {
  _id: new mongoose.Types.ObjectId(),
  username: 'testadmin',
  password: 'password123',
  role: 'admin',
  isBlocked: false
};

const testQuiz = {
  _id: new mongoose.Types.ObjectId(),
  title: 'Test Quiz',
  description: 'A test quiz',
  duration: 30,
  isActive: true,
  showResultsImmediately: true,
  questions: [
    {
      type: 'single-select',
      text: 'Test question',
      options: [
        { text: 'Option 1', isCorrect: true },
        { text: 'Option 2', isCorrect: false }
      ],
      points: 1
    }
  ],
  activatedUsers: [testUser._id],
  createdBy: testAdmin._id
};

const testAttempt = {
  _id: new mongoose.Types.ObjectId(),
  quizId: testQuiz._id,
  userId: testUser._id,
  status: 'submitted',
  answers: [],
  totalScore: 0,
  maxScore: 1,
  startTime: new Date(),
  endTime: new Date()
};

// Generate token for test user
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'quiz-web-app-secret',
    { expiresIn: '1h' }
  );
};

describe('Dashboard API', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/quiz-web-app-test');
    
    // Clear test data
    await User.deleteMany({});
    await Quiz.deleteMany({});
    await Attempt.deleteMany({});
    
    // Create test data
    await User.create(testUser);
    await User.create(testAdmin);
    await Quiz.create(testQuiz);
    await Attempt.create(testAttempt);
  });

  afterAll(async () => {
    // Disconnect from test database
    await mongoose.connection.close();
  });

  describe('GET /api/dashboard/quizzes', () => {
    it('should return all activated quizzes for the user', async () => {
      const token = generateToken(testUser);
      
      const res = await request(app)
        .get('/api/dashboard/quizzes')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toEqual('success');
      expect(res.body.data.length).toEqual(1);
      expect(res.body.data[0].title).toEqual('Test Quiz');
      expect(res.body.data[0].latestAttempt).not.toBeNull();
    });

    it('should return empty array when user has no activated quizzes', async () => {
      // Create a new user with no activated quizzes
      const noQuizUser = {
        _id: new mongoose.Types.ObjectId(),
        username: 'noquizuser',
        password: 'password123',
        role: 'user',
        isBlocked: false
      };
      
      await User.create(noQuizUser);
      const token = generateToken(noQuizUser);
      
      const res = await request(app)
        .get('/api/dashboard/quizzes')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toEqual('success');
      expect(res.body.data.length).toEqual(0);
      expect(res.body.message).toContain('No quizzes are currently available');
    });
  });

  describe('GET /api/dashboard/quizzes/:id', () => {
    it('should return quiz details if user has access', async () => {
      const token = generateToken(testUser);
      
      const res = await request(app)
        .get(`/api/dashboard/quizzes/${testQuiz._id}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toEqual('success');
      expect(res.body.data.title).toEqual('Test Quiz');
      expect(res.body.data.attempts.length).toEqual(1);
    });

    it('should return 403 if user does not have access to quiz', async () => {
      // Create a new user with no activated quizzes
      const noQuizUser = {
        _id: new mongoose.Types.ObjectId(),
        username: 'noquizuser2',
        password: 'password123',
        role: 'user',
        isBlocked: false
      };
      
      await User.create(noQuizUser);
      const token = generateToken(noQuizUser);
      
      const res = await request(app)
        .get(`/api/dashboard/quizzes/${testQuiz._id}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toEqual(403);
      expect(res.body.status).toEqual('error');
      expect(res.body.code).toEqual('QUIZ_ACCESS_DENIED');
    });
  });

  describe('GET /api/dashboard/attempts', () => {
    it('should return all attempts by the user', async () => {
      const token = generateToken(testUser);
      
      const res = await request(app)
        .get('/api/dashboard/attempts')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toEqual('success');
      expect(res.body.data.length).toEqual(1);
      expect(res.body.data[0].status).toEqual('submitted');
    });
  });

  describe('GET /api/dashboard/summary', () => {
    it('should return dashboard summary for the user', async () => {
      const token = generateToken(testUser);
      
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toEqual('success');
      expect(res.body.data.availableQuizzes).toEqual(1);
      expect(res.body.data.completedAttempts).toEqual(1);
      expect(res.body.data.inProgressAttempts).toEqual(0);
      expect(res.body.data.latestAttempt).not.toBeNull();
    });
  });
});