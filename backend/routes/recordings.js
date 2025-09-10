const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const recordingController = require('../controllers/recordingController');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    // Generate a unique filename with original extension
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `recording-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  },
  fileFilter: function (req, file, cb) {
    // Accept video files for screen and camera recordings, audio files for microphone recordings
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video and audio files are allowed'));
    }
  }
});

// All routes in this file require authentication
router.use(protect);

// @route   GET /api/recordings/test-connection
// @desc    Test backend connection for recording validation
// @access  Private
router.get('/test-connection', (req, res) => {
  res.json({
    success: true,
    message: 'Recording backend connection successful',
    timestamp: new Date().toISOString()
  });
});

// @route   GET /api/recordings/attempt/:attemptId
// @desc    Get recordings for an attempt
// @access  Private/Admin
router.get('/attempt/:attemptId', authorize('admin'), recordingController.getAttemptRecordings);

// @route   POST /api/recordings
// @desc    Start recording session
// @access  Private
router.post('/', recordingController.startRecording);

// @route   PUT /api/recordings/:recordingId/stop
// @desc    Stop recording session
// @access  Private
router.put('/:recordingId/stop', recordingController.stopRecording);

// @route   POST /api/recordings/:recordingId/upload
// @desc    Upload recording file
// @access  Private
router.post('/:recordingId/upload', upload.single('recording'), recordingController.uploadRecording);

// @route   GET /api/recordings/:recordingId/details
// @desc    Get recording details with metadata
// @access  Private/Admin
router.get('/:recordingId/details', authorize('admin'), recordingController.getRecordingDetails);

// @route   GET /api/recordings/:recordingId/stream
// @desc    Stream recording file
// @access  Private/Admin
router.get('/:recordingId/stream', authorize('admin'), recordingController.streamRecording);

// @route   GET /api/recordings/:recordingId/logs
// @desc    Get activity logs for a recording
// @access  Private/Admin
router.get('/:recordingId/logs', authorize('admin'), recordingController.getRecordingActivityLogs);

// @route   GET /api/recordings/:recordingId/download
// @desc    Download recording
// @access  Private/Admin
router.get('/:recordingId/download', authorize('admin'), recordingController.downloadRecording);

// @route   GET /api/recordings/:recordingId
// @desc    Get recording status
// @access  Private
router.get('/:recordingId', recordingController.getRecordingStatus);

// @route   POST /api/recordings/validate-permissions
// @desc    Validate recording permissions
// @access  Private
router.post('/validate-permissions', recordingController.validatePermissions);

module.exports = router;