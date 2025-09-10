const { validationResult } = require('express-validator');

/**
 * Middleware to check validation results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

module.exports = validate;