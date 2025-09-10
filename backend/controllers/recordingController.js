const Recording = require('../models/Recording');
const Attempt = require('../models/Attempt');
const fs = require('fs');
const path = require('path');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Start a new recording session
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.startRecording = async (req, res, next) => {
  try {
    const { attemptId, type } = req.body;
    
    if (!attemptId || !type) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_FIELDS',
        message: 'Please provide attemptId and type'
      });
    }
    
    // Validate recording type
    if (!['screen', 'camera', 'microphone'].includes(type)) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_TYPE',
        message: 'Recording type must be one of: "screen", "camera", or "microphone"'
      });
    }
    
    // Check if attempt exists and belongs to user
    const attempt = await Attempt.findOne({
      _id: attemptId,
      userId: req.user._id,
      status: 'in-progress'
    });
    
    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found or not in progress'
      });
    }
    
    // Create new recording
    const recording = await Recording.create({
      attemptId,
      userId: req.user._id,
      type,
      startTime: Date.now(),
      status: 'recording'
    });
    
    // Add recording to attempt
    if (!attempt.recordings) {
      attempt.recordings = [];
    }
    attempt.recordings.push(recording._id);
    await attempt.save();
    
    res.status(201).json({
      status: 'success',
      data: recording
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Stop a recording session
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.stopRecording = async (req, res, next) => {
  try {
    const { recordingId } = req.params;
    
    // Find recording
    const recording = await Recording.findOne({
      _id: recordingId,
      userId: req.user._id,
      status: 'recording'
    });
    
    if (!recording) {
      return res.status(404).json({
        status: 'error',
        code: 'RECORDING_NOT_FOUND',
        message: 'Recording not found or already stopped'
      });
    }
    
    // Update recording
    recording.endTime = Date.now();
    recording.status = 'processing'; // In a real app, this would trigger processing
    
    await recording.save();
    
    res.status(200).json({
      status: 'success',
      data: recording
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Upload recording file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.uploadRecording = async (req, res, next) => {
  try {
    const { recordingId } = req.params;
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        code: 'NO_FILE',
        message: 'No recording file uploaded'
      });
    }
    
    // Find recording
    const recording = await Recording.findOne({
      _id: recordingId,
      userId: req.user._id,
      status: 'processing'
    });
    
    if (!recording) {
      // Remove uploaded file if recording not found
      fs.unlinkSync(req.file.path);
      
      return res.status(404).json({
        status: 'error',
        code: 'RECORDING_NOT_FOUND',
        message: 'Recording not found or not in processing state'
      });
    }
    
    // Update recording with file info
    recording.fileUrl = `/uploads/${req.file.filename}`;
    recording.fileSize = req.file.size;
    recording.status = 'available';
    
    await recording.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        id: recording._id,
        fileUrl: recording.fileUrl,
        fileSize: recording.fileSize,
        status: recording.status
      }
    });
  } catch (err) {
    // Remove uploaded file if error occurs
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    next(err);
  }
};

/**
 * Get recording status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getRecordingStatus = async (req, res, next) => {
  try {
    const { recordingId } = req.params;
    
    // Find recording
    const recording = await Recording.findOne({
      _id: recordingId,
      userId: req.user._id
    });
    
    if (!recording) {
      return res.status(404).json({
        status: 'error',
        code: 'RECORDING_NOT_FOUND',
        message: 'Recording not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        id: recording._id,
        type: recording.type,
        status: recording.status,
        startTime: recording.startTime,
        endTime: recording.endTime,
        duration: recording.duration,
        fileUrl: recording.fileUrl,
        fileSize: recording.fileSize
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Download recording file (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.downloadRecording = async (req, res, next) => {
  try {
    const { recordingId } = req.params;
    
    // Find recording (admin can access any recording)
    const recording = await Recording.findById(recordingId);
    
    if (!recording) {
      return res.status(404).json({
        status: 'error',
        code: 'RECORDING_NOT_FOUND',
        message: 'Recording not found'
      });
    }
    
    // Check if file exists
    if (!recording.fileUrl) {
      return res.status(404).json({
        status: 'error',
        code: 'FILE_NOT_FOUND',
        message: 'Recording file not found'
      });
    }
    
    // Get file path
    const filePath = path.join(__dirname, '..', recording.fileUrl);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'error',
        code: 'FILE_NOT_FOUND',
        message: 'Recording file not found on server'
      });
    }
    
    // Send file
    res.download(filePath);
  } catch (err) {
    next(err);
  }
};

/**
 * Validate recording permissions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.validatePermissions = (req, res) => {
  // This is a simple endpoint to validate that the client has the necessary permissions
  // The actual permission checking happens on the client side
  res.status(200).json({
    status: 'success',
    message: 'Permissions validated',
    data: {
      validated: true
    }
  });
};

/**
 * Get recordings for an attempt (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getAttemptRecordings = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    
    // Find attempt with populated recordings
    const attempt = await Attempt.findById(attemptId)
      .populate('recordings')
      .populate('userId', 'username');
    
    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found'
      });
    }
    
    // Return recordings with additional metadata
    res.status(200).json({
      status: 'success',
      data: {
        attempt: {
          id: attempt._id,
          user: attempt.userId,
          startTime: attempt.startTime,
          endTime: attempt.endTime,
          status: attempt.status
        },
        recordings: attempt.recordings.map(recording => ({
          id: recording._id,
          type: recording.type,
          startTime: recording.startTime,
          endTime: recording.endTime,
          duration: recording.duration,
          status: recording.status,
          fileSize: recording.fileSize,
          available: recording.status === 'available'
        }))
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get recording details with metadata (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getRecordingDetails = async (req, res, next) => {
  try {
    const { recordingId } = req.params;
    
    // Find recording with populated attempt
    const recording = await Recording.findById(recordingId)
      .populate({
        path: 'attemptId',
        select: 'userId quizId startTime endTime status',
        populate: [
          { path: 'userId', select: 'username' },
          { path: 'quizId', select: 'title' }
        ]
      });
    
    if (!recording) {
      return res.status(404).json({
        status: 'error',
        code: 'RECORDING_NOT_FOUND',
        message: 'Recording not found'
      });
    }
    
    // Return recording with detailed metadata
    res.status(200).json({
      status: 'success',
      data: {
        id: recording._id,
        type: recording.type,
        startTime: recording.startTime,
        endTime: recording.endTime,
        duration: recording.duration,
        status: recording.status,
        fileSize: recording.fileSize,
        fileUrl: recording.fileUrl,
        attempt: recording.attemptId,
        available: recording.status === 'available'
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Stream recording file (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.streamRecording = async (req, res, next) => {
  try {
    const { recordingId } = req.params;
    
    // Find recording
    const recording = await Recording.findById(recordingId);
    
    if (!recording) {
      return res.status(404).json({
        status: 'error',
        code: 'RECORDING_NOT_FOUND',
        message: 'Recording not found'
      });
    }
    
    // Check if file exists
    if (!recording.fileUrl) {
      return res.status(404).json({
        status: 'error',
        code: 'FILE_NOT_FOUND',
        message: 'Recording file not found'
      });
    }
    
    // Get file path
    const filePath = path.join(__dirname, '..', recording.fileUrl);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'error',
        code: 'FILE_NOT_FOUND',
        message: 'Recording file not found on server'
      });
    }
    
    // Log access for activity tracking
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: req.user._id,
      action: 'stream_recording',
      recordingId: recording._id,
      attemptId: recording.attemptId,
      userAgent: req.headers['user-agent']
    };
    
    // Write to activity log file
    const logFilePath = path.join(logsDir, 'recording_activity.log');
    fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
    
    // Get file stats
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      
      // Set headers for streaming
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/webm'
      });
      
      // Stream the file
      file.pipe(res);
    } else {
      // Set headers for full file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/webm'
      });
      
      // Stream the file
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Get activity logs for a recording (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getRecordingActivityLogs = async (req, res, next) => {
  try {
    const { recordingId } = req.params;
    
    // Check if recording exists
    const recording = await Recording.findById(recordingId);
    
    if (!recording) {
      return res.status(404).json({
        status: 'error',
        code: 'RECORDING_NOT_FOUND',
        message: 'Recording not found'
      });
    }
    
    // Get log file path
    const logFilePath = path.join(logsDir, 'recording_activity.log');
    
    // Check if log file exists
    if (!fs.existsSync(logFilePath)) {
      return res.status(200).json({
        status: 'success',
        data: {
          logs: []
        }
      });
    }
    
    // Read log file
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const logLines = logContent.trim().split('\n');
    
    // Filter logs for this recording
    const recordingLogs = logLines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (err) {
          return null;
        }
      })
      .filter(log => log && log.recordingId === recordingId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.status(200).json({
      status: 'success',
      data: {
        logs: recordingLogs
      }
    });
  } catch (err) {
    next(err);
  }
};