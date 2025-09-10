const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getActivationMatrix,
  toggleQuizActivation,
  bulkActivation,
  bulkQuizActivation,
  terminateUserSessions,
  getActiveSessions,
  terminateSession
} = require('../controllers/quizActivationController');

// All routes in this file require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/activation
// @desc    Get activation status for all users and quizzes
// @access  Private/Admin
router.get('/', getActivationMatrix);

// @route   PUT /api/activation/quiz/:quizId/user/:userId
// @desc    Activate or deactivate a quiz for a user
// @access  Private/Admin
router.put('/quiz/:quizId/user/:userId', [
  check('activate').isBoolean().withMessage('Activate must be a boolean value'),
  validate
], toggleQuizActivation);

// @route   POST /api/activation/bulk
// @desc    Bulk activate or deactivate quizzes for users
// @access  Private/Admin
router.post('/bulk', bulkActivation);

// @route   POST /api/activation/quiz/:quizId/bulk
// @desc    Bulk activate/deactivate a quiz for all users
// @access  Private/Admin
router.post('/quiz/:quizId/bulk', bulkQuizActivation);

// @route   GET /api/activation/sessions
// @desc    Get active quiz sessions
// @access  Private/Admin
router.get('/sessions', getActiveSessions);

// @route   POST /api/activation/terminate/:userId
// @desc    Terminate active quiz sessions for a user
// @access  Private/Admin
router.post('/terminate/:userId', terminateUserSessions);

// @route   POST /api/activation/terminate-session/:attemptId
// @desc    Terminate a specific quiz session
// @access  Private/Admin
router.post('/terminate-session/:attemptId', terminateSession);

module.exports = router;