const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes - require authentication
 * This middleware checks for a valid JWT token in the Authorization header or cookies
 * and attaches the user to the request object if authenticated
 */
exports.protect = async (req, res, next) => {
  let token;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
  } 
  // Check for token in cookies
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Check if token exists
  if (!token) {
    return res.status(401).json({
      status: 'error',
      code: 'AUTH_REQUIRED',
      message: 'Authentication required to access this resource'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'quiz-web-app-secret');

    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'User no longer exists'
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

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    let errorCode = 'INVALID_TOKEN';
    let errorMessage = 'Invalid authentication token';
    
    if (error.name === 'TokenExpiredError') {
      errorCode = 'TOKEN_EXPIRED';
      errorMessage = 'Your session has expired. Please log in again';
    }
    
    return res.status(401).json({
      status: 'error',
      code: errorCode,
      message: errorMessage
    });
  }
};

/**
 * Grant access to specific roles
 * This middleware checks if the authenticated user has the required role
 * @param {...string} roles - The roles that are allowed to access the route
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        code: 'AUTH_REQUIRED',
        message: 'Authentication required to access this resource'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        code: 'UNAUTHORIZED_ROLE',
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};

/**
 * Check if user is active
 * This middleware checks if the authenticated user is not blocked
 */
exports.checkActive = async (req, res, next) => {
  if (req.user && req.user.isBlocked) {
    return res.status(403).json({
      status: 'error',
      code: 'USER_BLOCKED',
      message: 'Your account has been blocked'
    });
  }
  next();
};