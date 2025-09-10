const User = require('../models/User');

/**
 * @desc    Get all users with filtering, sorting, and pagination
 * @route   GET /api/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res, next) => {
  try {
    // Build query
    const queryParams = {};
    
    // Search by username
    if (req.query.search) {
      queryParams.username = { $regex: req.query.search, $options: 'i' };
    }
    
    // Filter by role
    if (req.query.role) {
      queryParams.role = req.query.role;
    }
    
    // Filter by blocked status
    if (req.query.isBlocked !== undefined) {
      queryParams.isBlocked = req.query.isBlocked === 'true';
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    
    // Sorting
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder;
    
    // Execute query
    const total = await User.countDocuments(queryParams);
    const users = await User.find(queryParams)
      .select('-password')
      .sort(sortOptions)
      .skip(startIndex)
      .limit(limit);
    
    // Pagination result
    const pagination = {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
    
    res.status(200).json({
      status: 'success',
      count: users.length,
      pagination,
      data: users
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create a new user
 * @route   POST /api/users
 * @access  Private/Admin
 */
exports.createUser = async (req, res, next) => {
  try {
    const { username, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        code: 'USER_EXISTS',
        message: 'User with this username already exists'
      });
    }

    // Create user
    const user = await User.create({
      username,
      password,
      role: role || 'user'
    });

    res.status(201).json({
      status: 'success',
      data: {
        id: user._id,
        username: user.username,
        role: user.role,
        isBlocked: user.isBlocked,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get a single user
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: user
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update a user
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { username, password, role, isBlocked } = req.body;
    
    // Find user
    let user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    // Check if username is being changed and already exists
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          code: 'USERNAME_EXISTS',
          message: 'Username is already taken'
        });
      }
    }

    // Update fields
    if (username) user.username = username;
    if (password) user.password = password;
    if (role) user.role = role;
    if (isBlocked !== undefined) user.isBlocked = isBlocked;
    
    // Save user
    await user.save();

    res.status(200).json({
      status: 'success',
      data: {
        id: user._id,
        username: user.username,
        role: user.role,
        isBlocked: user.isBlocked,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete a user
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res, next) => {
  try {
    // Prevent admin from deleting themselves
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        status: 'error',
        code: 'CANNOT_DELETE_SELF',
        message: 'You cannot delete your own account'
      });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    await user.deleteOne();

    res.status(200).json({
      status: 'success',
      message: 'User successfully deleted',
      data: {}
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Block/unblock a user
 * @route   PUT /api/users/:id/block
 * @access  Private/Admin
 */
exports.toggleBlockUser = async (req, res, next) => {
  try {
    const { isBlocked } = req.body;
    
    // Prevent admin from blocking themselves
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        status: 'error',
        code: 'CANNOT_BLOCK_SELF',
        message: 'You cannot block your own account'
      });
    }
    
    // Find user
    let user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    // Update blocked status
    user.isBlocked = isBlocked;
    
    // Save user
    await user.save();

    // Prepare response message based on action
    const actionMessage = isBlocked ? 'blocked' : 'unblocked';

    res.status(200).json({
      status: 'success',
      message: `User successfully ${actionMessage}`,
      data: {
        id: user._id,
        username: user.username,
        isBlocked: user.isBlocked
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Reset user password
 * @route   PUT /api/users/:id/password
 * @access  Private/Admin
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    
    // Find user
    let user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    // Update password
    user.password = newPassword;
    
    // Save user
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password successfully reset',
      data: {
        id: user._id,
        username: user.username,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get user count statistics
 * @route   GET /api/users/count/stats
 * @access  Private/Admin
 */
exports.getUserStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const regularUsers = await User.countDocuments({ role: 'user' });
    const blockedUsers = await User.countDocuments({ isBlocked: true });
    
    res.status(200).json({
      status: 'success',
      data: {
        total: totalUsers,
        admins: adminUsers,
        users: regularUsers,
        blocked: blockedUsers
      }
    });
  } catch (err) {
    next(err);
  }
};