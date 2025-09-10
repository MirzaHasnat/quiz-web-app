const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const userController = require('../controllers/userController');

// All routes in this file require authentication
router.use(protect);

// All routes in this file require admin role
router.use(authorize('admin'));

/**
 * Validate request body
 * @param {string} method - HTTP method (POST, PUT)
 * @returns {Array} - Array of validation middleware
 */
const validateUserData = (method) => {
  const validations = [
    body('username')
      .if((value, { req }) => method === 'POST')
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters'),
    
    body('username')
      .if((value, { req }) => method === 'PUT')
      .optional()
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters'),
    
    body('password')
      .if((value, { req }) => method === 'POST')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    
    body('password')
      .if((value, { req }) => method === 'PUT')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    
    body('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage('Role must be either user or admin'),
    
    body('isBlocked')
      .optional()
      .isBoolean()
      .withMessage('isBlocked must be a boolean value')
  ];
  
  return validations;
};

// Get user statistics
router.get('/count/stats', userController.getUserStats);

// Get all users with filtering, sorting, and pagination
router.get('/', [
  query('search').optional().isString().withMessage('Search must be a string'),
  query('role').optional().isIn(['user', 'admin']).withMessage('Role must be either user or admin'),
  query('isBlocked').optional().isBoolean().withMessage('isBlocked must be a boolean value'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isString().withMessage('sortBy must be a string'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder must be asc or desc'),
  validate
], userController.getUsers);

// Create a new user
router.post('/', validateUserData('POST'), validate, userController.createUser);

// Get a single user
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid user ID format'),
  validate
], userController.getUser);

// Update a user
router.put('/:id', [
  param('id').isMongoId().withMessage('Invalid user ID format'),
  ...validateUserData('PUT'),
  validate
], userController.updateUser);

// Delete a user
router.delete('/:id', [
  param('id').isMongoId().withMessage('Invalid user ID format'),
  validate
], userController.deleteUser);

// Block/unblock a user
router.put('/:id/block', [
  param('id').isMongoId().withMessage('Invalid user ID format'),
  body('isBlocked').isBoolean().withMessage('isBlocked must be a boolean value'),
  validate
], userController.toggleBlockUser);

// Reset user password
router.put('/:id/password', [
  param('id').isMongoId().withMessage('Invalid user ID format'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate
], userController.resetPassword);

module.exports = router;