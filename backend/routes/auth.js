const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

/**
 * @route   GET /api/auth/test
 * @desc    Test route to verify API is working
 * @access  Public
 */
router.get('/test', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Auth API is working',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get token
 * @access  Public
 */
router.post('/login', [
  // Validate input using express-validator
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;

    // Check if there are any users in the database
    const userCount = await User.countDocuments();
    
    // If no users exist, create the first user as admin
    if (userCount === 0) {
      try {
        const adminUser = await User.create({
          username,
          password,
          role: 'admin'
        });

        // Create token for the new admin user
        const token = adminUser.getSignedJwtToken();

        // Set token in cookie for enhanced security (httpOnly)
        const cookieOptions = {
          expires: new Date(
            Date.now() + (process.env.JWT_COOKIE_EXPIRE || 24) * 60 * 60 * 1000
          ),
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production'
        };

        return res
          .status(201)
          .cookie('token', token, cookieOptions)
          .json({
            status: 'success',
            message: 'Admin user created successfully',
            token,
            user: {
              id: adminUser._id,
              username: adminUser.username,
              role: adminUser.role
            },
            isFirstUser: true
          });
      } catch (createError) {
        return res.status(400).json({
          status: 'error',
          code: 'USER_CREATION_FAILED',
          message: 'Failed to create admin user: ' + createError.message
        });
      }
    }

    // Check for existing user
    const user = await User.findOne({ username }).select('+password');
    if (!user) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials'
      });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({
        status: 'error',
        code: 'USER_BLOCKED',
        message: 'Your account has been blocked'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials'
      });
    }

    // Create token
    const token = user.getSignedJwtToken();

    // Set token in cookie for enhanced security (httpOnly)
    const cookieOptions = {
      expires: new Date(
        Date.now() + (process.env.JWT_COOKIE_EXPIRE || 24) * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    };

    res
      .status(200)
      .cookie('token', token, cookieOptions)
      .json({
        status: 'success',
        token,
        user: {
          id: user._id,
          username: user.username,
          role: user.role
        }
      });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/auth/verify
 * @desc    Verify token and get user data
 * @access  Private
 */
router.get('/verify', protect, async (req, res) => {
  res.status(200).json({
    status: 'success',
    user: {
      id: req.user._id,
      username: req.user.username,
      role: req.user.role
    }
  });
});

/**
 * @route   POST /api/auth/logout
 * @desc    Clear auth cookie and log user out
 * @access  Public
 */
router.post('/logout', (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    status: 'success',
    message: 'Successfully logged out'
  });
});

module.exports = router;