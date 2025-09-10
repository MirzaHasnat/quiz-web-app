/**
 * Recording Service
 * Handles recording functionality for screen, camera, and microphone
 * Manages recording storage and retrieval
 */
import axios from '../utils/axiosConfig';

// MediaRecorder instances
let screenRecorder = null;
let cameraRecorder = null;
let microphoneRecorder = null;

// Recorded chunks
let screenChunks = [];
let cameraChunks = [];
let microphoneChunks = [];

// Recording metadata
let recordingMetadata = {
  screen: null,
  camera: null,
  microphone: null,
  cameraAudio: null // For backward compatibility
};

// Flag to track if recording is already started
let recordingStarted = false;

/**
 * Update cameraAudio metadata for backward compatibility
 * This ensures the validation service can find camera/audio recording info
 * Prioritizes camera if available, otherwise microphone.
 */
const updateCameraAudioMetadata = () => {
  // For backward compatibility, set cameraAudio to camera or microphone metadata
  if (recordingMetadata.camera && !recordingMetadata.camera._id?.includes('disabled')) {
    recordingMetadata.cameraAudio = recordingMetadata.camera;
  } else if (recordingMetadata.microphone && !recordingMetadata.microphone._id?.includes('disabled')) {
    recordingMetadata.cameraAudio = recordingMetadata.microphone;
  } else if (recordingMetadata.camera || recordingMetadata.microphone) {
    // If both exist but are disabled, or only one exists, use the available one
    recordingMetadata.cameraAudio = recordingMetadata.camera || recordingMetadata.microphone;
  } else {
    recordingMetadata.cameraAudio = null;
  }
};

// Flag to track if uploads are in progress or completed
let uploadInProgress = false;
let uploadCompleted = false;

// Store active media streams to prevent them from being garbage collected
let activeStreams = {
  screen: null,
  camera: null,
  microphone: null
};

/**
 * Start screen recording
 * @param {MediaStream} stream - The screen media stream
 * @param {string} attemptId - The quiz attempt ID
 * @returns {Promise<Object>} Recording metadata
 */
export const startScreenRecording = async (stream, attemptId) => {
  try {
    // Check if MediaRecorder is supported
    if (!window.MediaRecorder) {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    // Determine supported MIME type with better Chrome compatibility
    let mimeType = undefined;
    const supportedTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        console.log(`Screen recording using MIME type: ${mimeType}`);
        break;
      }
    }

    // Create recorder with appropriate options for Chrome compatibility
    const options = {
      videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
      audioBitsPerSecond: 128000   // 128 kbps for audio
    };
    if (mimeType) {
      options.mimeType = mimeType;
    }

    screenRecorder = new MediaRecorder(stream, options);

    // Clear previous chunks
    screenChunks = [];

    // Set up event handlers
    screenRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        screenChunks.push(event.data);
      }
    };
    screenRecorder.onerror = (event) => {
      console.error('Screen recorder error:', event.error);
    };

    // Start recording with a shorter interval for better data collection
    screenRecorder.start(1000); // Collect data every 1 second

    // Store the stream reference to prevent garbage collection
    activeStreams.screen = stream;

    // Create recording entry in backend
    const response = await axios.post('/api/recordings', {
      attemptId,
      type: 'screen'
    });

    // Store metadata
    recordingMetadata.screen = response.data.data;
    return recordingMetadata.screen;
  } catch (error) {
    console.error('Error starting screen recording:', error);
    throw new Error('Failed to start screen recording');
  }
};

/**
 * Start camera recording
 * @param {MediaStream} cameraStream - The camera media stream
 * @param {string} attemptId - The quiz attempt ID
 * @returns {Promise<Object>} Recording metadata
 */
export const startCameraRecording = async (cameraStream, attemptId) => {
  try {
    // Check if MediaRecorder is supported
    if (!window.MediaRecorder) {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    // Determine supported MIME type with better Chrome compatibility
    let mimeType = undefined;
    const supportedTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        console.log(`Camera recording using MIME type: ${mimeType}`);
        break;
      }
    }

    // Create recorder with appropriate options for Chrome compatibility
    const options = {
      videoBitsPerSecond: 1500000 // 1.5 Mbps for camera video
    };
    if (mimeType) {
      options.mimeType = mimeType;
    }

    cameraRecorder = new MediaRecorder(cameraStream, options);

    // Clear previous chunks
    cameraChunks = [];

    // Set up event handlers
    cameraRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        cameraChunks.push(event.data);
      }
    };
    cameraRecorder.onerror = (event) => {
      console.error('Camera recorder error:', event.error);
    };

    // Start recording with a shorter interval for better data collection
    cameraRecorder.start(1000); // Collect data every 1 second

    // Store the stream reference to prevent garbage collection
    activeStreams.camera = cameraStream;

    // Create recording entry in backend
    const response = await axios.post('/api/recordings', {
      attemptId,
      type: 'camera'
    });

    // Store metadata
    recordingMetadata.camera = response.data.data;
    updateCameraAudioMetadata(); // Update backward compatibility metadata
    return recordingMetadata.camera;
  } catch (error) {
    console.error('Error starting camera recording:', error);
    throw new Error('Failed to start camera recording');
  }
};

/**
 * Start microphone recording
 * @param {MediaStream} audioStream - The microphone media stream
 * @param {string} attemptId - The quiz attempt ID
 * @returns {Promise<Object>} Recording metadata
 */
export const startMicrophoneRecording = async (audioStream, attemptId) => {
  try {
    // Check if MediaRecorder is supported
    if (!window.MediaRecorder) {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    // Determine supported MIME type for audio
    let mimeType = undefined;
    const supportedTypes = [
      'audio/webm;codecs=opus',
      'audio/webm'
    ];
    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        console.log(`Microphone recording using MIME type: ${mimeType}`);
        break;
      }
    }

    // Create recorder with appropriate options for Chrome compatibility
    const options = {
      audioBitsPerSecond: 128000 // 128 kbps for audio
    };
    if (mimeType) {
      options.mimeType = mimeType;
    }

    microphoneRecorder = new MediaRecorder(audioStream, options);

    // Clear previous chunks
    microphoneChunks = [];

    // Set up event handlers
    microphoneRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        microphoneChunks.push(event.data);
      }
    };
    microphoneRecorder.onerror = (event) => {
      console.error('Microphone recorder error:', event.error);
    };

    // Start recording with a shorter interval for better data collection
    microphoneRecorder.start(1000); // Collect data every 1 second

    // Store the stream reference to prevent garbage collection
    activeStreams.microphone = audioStream;

    // Create recording entry in backend
    const response = await axios.post('/api/recordings', {
      attemptId,
      type: 'microphone'
    });

    // Store metadata
    recordingMetadata.microphone = response.data.data;
    updateCameraAudioMetadata(); // Update backward compatibility metadata
    return recordingMetadata.microphone;
  } catch (error) {
    console.error('Error starting microphone recording:', error);
    throw new Error('Failed to start microphone recording');
  }
};

/**
 * Stop screen recording
 * @returns {Promise<Blob>} The recorded video blob
 */
export const stopScreenRecording = async () => {
  return new Promise((resolve, reject) => {
    try {
      if (!screenRecorder || screenRecorder.state === 'inactive') {
        reject(new Error('Screen recorder not active'));
        return;
      }
      screenRecorder.onstop = async () => {
        try {
          // Create blob from chunks with proper MIME type
          const mimeType = screenRecorder.mimeType || 'video/webm';
          const blob = new Blob(screenChunks, { type: mimeType });
          // Update recording status in backend
          if (recordingMetadata.screen && recordingMetadata.screen._id) {
            await axios.put(`/api/recordings/${recordingMetadata.screen._id}/stop`);
          }
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      };
      // Stop recording
      screenRecorder.stop();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Stop camera recording
 * @returns {Promise<Blob>} The recorded video blob
 */
export const stopCameraRecording = async () => {
  return new Promise((resolve, reject) => {
    try {
      if (!cameraRecorder || cameraRecorder.state === 'inactive') {
        reject(new Error('Camera recorder not active'));
        return;
      }
      cameraRecorder.onstop = async () => {
        try {
          // Create blob from chunks with proper MIME type
          const mimeType = cameraRecorder.mimeType || 'video/webm';
          const blob = new Blob(cameraChunks, { type: mimeType });
          // Update recording status in backend
          if (recordingMetadata.camera && recordingMetadata.camera._id) {
            await axios.put(`/api/recordings/${recordingMetadata.camera._id}/stop`);
          }
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      };
      // Stop recording
      cameraRecorder.stop();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Stop microphone recording
 * @returns {Promise<Blob>} The recorded audio blob
 */
export const stopMicrophoneRecording = async () => {
  return new Promise((resolve, reject) => {
    try {
      if (!microphoneRecorder || microphoneRecorder.state === 'inactive') {
        reject(new Error('Microphone recorder not active'));
        return;
      }
      microphoneRecorder.onstop = async () => {
        try {
          // Create blob from chunks with proper MIME type
          const mimeType = microphoneRecorder.mimeType || 'audio/webm';
          const blob = new Blob(microphoneChunks, { type: mimeType });
          // Update recording status in backend
          if (recordingMetadata.microphone && recordingMetadata.microphone._id) {
            await axios.put(`/api/recordings/${recordingMetadata.microphone._id}/stop`);
          }
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      };
      // Stop recording
      microphoneRecorder.stop();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Upload recording to server
 * @param {Blob} blob - The recording blob
 * @param {string} recordingId - The recording ID
 * @returns {Promise<Object>} Upload result
 */
export const uploadRecording = async (blob, recordingId) => {
  try {
    // Create form data
    const formData = new FormData();
    formData.append('recording', blob, `recording-${recordingId}.webm`);

    // Upload to server
    const response = await axios.post(`/api/recordings/${recordingId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`Upload progress: ${percentCompleted}%`);
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading recording:', error);
    throw new Error('Failed to upload recording');
  }
};

/**
 * Get recording status
 * @param {string} recordingId - The recording ID
 * @returns {Promise<Object>} Recording status
 */
export const getRecordingStatus = async (recordingId) => {
  try {
    const response = await axios.get(`/api/recordings/${recordingId}`);
    return response.data.data;
  } catch (error) {
    console.error('Error getting recording status:', error);
    throw new Error('Failed to get recording status');
  }
};

/**
 * Get recordings for an attempt
 * @param {string} attemptId - The attempt ID
 * @returns {Promise<Object>} Recordings data
 */
export const getAttemptRecordings = async (attemptId) => {
  try {
    const response = await axios.get(`/api/recordings/attempt/${attemptId}`);
    return response.data.data;
  } catch (error) {
    console.error('Error getting attempt recordings:', error);
    throw new Error('Failed to get attempt recordings');
  }
};

/**
 * Get recording details
 * @param {string} recordingId - The recording ID
 * @returns {Promise<Object>} Recording details
 */
export const getRecordingDetails = async (recordingId) => {
  try {
    const response = await axios.get(`/api/recordings/${recordingId}/details`);
    return response.data.data;
  } catch (error) {
    console.error('Error getting recording details:', error);
    throw new Error('Failed to get recording details');
  }
};

/**
 * Get recording activity logs
 * @param {string} recordingId - The recording ID
 * @returns {Promise<Array>} Recording activity logs
 */
export const getRecordingActivityLogs = async (recordingId) => {
  try {
    const response = await axios.get(`/api/recordings/${recordingId}/logs`);
    return response.data.data.logs;
  } catch (error) {
    console.error('Error getting recording activity logs:', error);
    throw new Error('Failed to get recording activity logs');
  }
};

/**
 * Start screen recording locally (without backend entry)
 * @param {MediaStream} stream - The screen media stream
 * @returns {Promise<Object>} Recording metadata
 */
const startScreenRecordingLocal = async (stream) => {
  try {
    // Check if MediaRecorder is supported
    if (!window.MediaRecorder) {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    // Determine supported MIME type with better Chrome compatibility
    let mimeType = undefined;
    const supportedTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        console.log(`Screen recording using MIME type: ${mimeType}`);
        break;
      }
    }

    // Create recorder with appropriate options for Chrome compatibility
    const options = {
      videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
      audioBitsPerSecond: 128000   // 128 kbps for audio
    };
    if (mimeType) {
      options.mimeType = mimeType;
    }

    screenRecorder = new MediaRecorder(stream, options);

    // Clear previous chunks
    screenChunks = [];

    // Set up event handlers
    screenRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        screenChunks.push(event.data);
      }
    };
    screenRecorder.onerror = (event) => {
      console.error('Screen recorder error:', event.error);
    };

    // Start recording with a shorter interval for better data collection
    screenRecorder.start(1000); // Collect data every 1 second

    // Store the stream reference to prevent garbage collection
    activeStreams.screen = stream;

    // Create local metadata (will be replaced with backend entry later)
    const localMetadata = {
      _id: `local-screen-${Date.now()}`,
      type: 'screen',
      startTime: new Date(),
      status: 'recording'
    };

    // Store metadata
    recordingMetadata.screen = localMetadata;
    return localMetadata;
  } catch (error) {
    console.error('Error starting local screen recording:', error);
    throw new Error('Failed to start screen recording');
  }
};

/**
 * Start camera recording locally (without backend entry)
 * @param {MediaStream} stream - The camera media stream
 * @returns {Promise<Object>} Recording metadata
 */
const startCameraRecordingLocal = async (stream) => {
  try {
    // Check if MediaRecorder is supported
    if (!window.MediaRecorder) {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    // Determine supported MIME type with better Chrome compatibility
    let mimeType = undefined;
    const supportedTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        console.log(`Camera recording using MIME type: ${mimeType}`);
        break;
      }
    }

    // Create recorder with appropriate options for Chrome compatibility
    const options = {
      videoBitsPerSecond: 1500000 // 1.5 Mbps for camera video
    };
    if (mimeType) {
      options.mimeType = mimeType;
    }

    cameraRecorder = new MediaRecorder(stream, options);

    // Clear previous chunks
    cameraChunks = [];

    // Set up event handlers
    cameraRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        cameraChunks.push(event.data);
      }
    };
    cameraRecorder.onerror = (event) => {
      console.error('Camera recorder error:', event.error);
    };

    // Start recording with a shorter interval for better data collection
    cameraRecorder.start(1000); // Collect data every 1 second

    // Store the stream reference to prevent garbage collection
    activeStreams.camera = stream;

    // Create local metadata (will be replaced with backend entry later)
    const localMetadata = {
      _id: `local-camera-${Date.now()}`,
      type: 'camera',
      startTime: new Date(),
      status: 'recording'
    };

    // Store metadata
    recordingMetadata.camera = localMetadata;
    updateCameraAudioMetadata(); // Update backward compatibility metadata
    return localMetadata;
  } catch (error) {
    console.error('Error starting local camera recording:', error);
    throw new Error('Failed to start camera recording');
  }
};

/**
 * Start microphone recording locally (without backend entry)
 * @param {MediaStream} stream - The microphone media stream
 * @returns {Promise<Object>} Recording metadata
 */
const startMicrophoneRecordingLocal = async (stream) => {
  try {
    // Check if MediaRecorder is supported
    if (!window.MediaRecorder) {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    // Determine supported MIME type for audio
    let mimeType = undefined;
    const supportedTypes = [
      'audio/webm;codecs=opus',
      'audio/webm'
    ];
    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        console.log(`Microphone recording using MIME type: ${mimeType}`);
        break;
      }
    }

    // Create recorder with appropriate options for Chrome compatibility
    const options = {
      audioBitsPerSecond: 128000 // 128 kbps for audio
    };
    if (mimeType) {
      options.mimeType = mimeType;
    }

    microphoneRecorder = new MediaRecorder(stream, options);

    // Clear previous chunks
    microphoneChunks = [];

    // Set up event handlers
    microphoneRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        microphoneChunks.push(event.data);
      }
    };
    microphoneRecorder.onerror = (event) => {
      console.error('Microphone recorder error:', event.error);
    };

    // Start recording with a shorter interval for better data collection
    microphoneRecorder.start(1000); // Collect data every 1 second

    // Store the stream reference to prevent garbage collection
    activeStreams.microphone = stream;

    // Create local metadata (will be replaced with backend entry later)
    const localMetadata = {
      _id: `local-microphone-${Date.now()}`,
      type: 'microphone',
      startTime: new Date(),
      status: 'recording'
    };

    // Store metadata
    recordingMetadata.microphone = localMetadata;
    updateCameraAudioMetadata(); // Update backward compatibility metadata
    return localMetadata;
  } catch (error) {
    console.error('Error starting local microphone recording:', error);
    throw new Error('Failed to start microphone recording');
  }
};

/**
 * Start recording immediately when permissions are granted (before quiz starts)
 * @param {Object} streams - Object containing media streams (screen, camera, microphone)
 * @param {Object} recordingRequirements - Object specifying which recording types are enabled
 * @returns {Promise<Object>} Recording metadata
 */
export const startImmediateRecording = async (streams, recordingRequirements = null) => {
  try {
    console.log('startImmediateRecording called with streams:', streams);
    // Check if recording is already started
    if (recordingStarted) {
      console.log('Recording already started, returning existing metadata');
      return recordingMetadata;
    }

    // Check if we're in development mode and recording is disabled
    const isDevelopment = process.env.NODE_ENV === 'development';
    const skipRecording = isDevelopment && process.env.REACT_APP_SKIP_RECORDING === 'true';
    console.log('Development mode:', isDevelopment, 'Skip recording:', skipRecording);

    if (skipRecording) {
      console.warn('Recording skipped in development mode');
      recordingStarted = true;
      return {
        screen: { _id: 'mock-screen-recording', type: 'screen' },
        cameraAudio: { _id: 'mock-camera-audio-recording', type: 'camera-audio' },
        camera: { _id: 'mock-camera-recording', type: 'camera' },
        microphone: { _id: 'mock-microphone-recording', type: 'microphone' }
      };
    }

    // Use default requirements if not provided (backward compatibility)
    const requirements = recordingRequirements || {
      enableScreen: true,
      enableCamera: true,
      enableMicrophone: true
    };
    console.log('Recording requirements:', requirements);

    // Validate that we have the required streams based on requirements
    const requiredStreams = [];
    if (requirements.enableScreen) requiredStreams.push('screen');
    if (requirements.enableCamera) requiredStreams.push('camera');
    if (requirements.enableMicrophone) requiredStreams.push('microphone');

    console.log('Required streams:', requiredStreams);
    console.log('Available streams - screen:', !!streams?.screen, 'camera:', !!streams?.camera, 'microphone:', !!streams?.microphone);

    // Check if we have all required streams (only check for streams that are actually required)
    const missingStreams = requiredStreams.filter(streamType => !streams?.[streamType]);
    if (missingStreams.length > 0 && requiredStreams.length > 0) {
      console.error('Missing required streams:', missingStreams);
      throw new Error(`Missing required media streams: ${missingStreams.join(', ')}. Please ensure all required permissions are granted.`);
    }

    let screenMeta = null;
    let cameraAudioMeta = null; // For backward compatibility
    let errors = [];

    // Try to start screen recording if enabled
    if (requirements.enableScreen) {
      try {
        screenMeta = await startScreenRecordingLocal(streams.screen);
        console.log('Screen recording started immediately after permissions');
        // Ensure we have a valid object
        if (!screenMeta || !screenMeta._id) {
          throw new Error('Screen recording returned invalid metadata');
        }
      } catch (error) {
        console.error('Screen recording failed:', error);
        errors.push('Screen recording failed: ' + error.message);
        screenMeta = { _id: 'failed-screen-recording', type: 'screen', error: error.message };
      }
    } else {
      console.log('Screen recording disabled for this quiz');
      screenMeta = { _id: 'disabled-screen-recording', type: 'screen', disabled: true };
    }

    let cameraMeta = null;
    let microphoneMeta = null;

    // Try to start camera recording if enabled
    if (requirements.enableCamera) {
      try {
        cameraMeta = await startCameraRecordingLocal(streams.camera);
        console.log('Camera recording started immediately after permissions');
        // Ensure we have a valid object
        if (!cameraMeta || !cameraMeta._id) {
          throw new Error('Camera recording returned invalid metadata');
        }
      } catch (error) {
        console.error('Camera recording failed:', error);
        errors.push('Camera recording failed: ' + error.message);
        cameraMeta = { _id: 'failed-camera-recording', type: 'camera', error: error.message };
      }
    } else {
      console.log('Camera recording disabled for this quiz');
      cameraMeta = { _id: 'disabled-camera-recording', type: 'camera', disabled: true };
    }

    // Try to start microphone recording if enabled
    if (requirements.enableMicrophone) {
      try {
        microphoneMeta = await startMicrophoneRecordingLocal(streams.microphone);
        console.log('Microphone recording started immediately after permissions');
        // Ensure we have a valid object
        if (!microphoneMeta || !microphoneMeta._id) {
          throw new Error('Microphone recording returned invalid metadata');
        }
      } catch (error) {
        console.error('Microphone recording failed:', error);
        errors.push('Microphone recording failed: ' + error.message);
        microphoneMeta = { _id: 'failed-microphone-recording', type: 'microphone', error: error.message };
      }
    } else {
      console.log('Microphone recording disabled for this quiz');
      microphoneMeta = { _id: 'disabled-microphone-recording', type: 'microphone', disabled: true };
    }

    // If all recordings failed, throw an error
    if (errors.length === 3) {
      throw new Error('All recordings failed: ' + errors.join(', '));
    }
    // If some recordings failed, log a warning but continue
    if (errors.length > 0) {
      console.warn('Partial recording failure:', errors.join(', '));
    }

    recordingStarted = true;

    // Update global recording metadata
    recordingMetadata.screen = screenMeta;
    recordingMetadata.camera = cameraMeta;
    recordingMetadata.microphone = microphoneMeta;
    // Ensure backward compatibility metadata is updated
    updateCameraAudioMetadata();

    console.log('Immediate recording setup completed:', { screen: screenMeta, camera: cameraMeta, microphone: microphoneMeta });

    // For backward compatibility, derive cameraAudioMeta from the updated metadata
    cameraAudioMeta = recordingMetadata.cameraAudio;

    return {
      screen: screenMeta,
      cameraAudio: cameraAudioMeta, // Backward compatibility
      // Also include individual recordings for new system
      camera: cameraMeta,
      microphone: microphoneMeta
    };
  } catch (error) {
    console.error('Error starting immediate recordings:', error);
    // In development, allow quiz to continue without recording
    if (process.env.NODE_ENV === 'development') {
      console.warn('Continuing without recording in development mode');
      recordingStarted = true;
      return {
        screen: { _id: 'dev-mock-screen', type: 'screen', error: 'Recording disabled in development' },
        cameraAudio: { _id: 'dev-mock-camera-audio', type: 'camera-audio', error: 'Recording disabled in development' },
        camera: { _id: 'dev-mock-camera', type: 'camera', error: 'Recording disabled in development' },
        microphone: { _id: 'dev-mock-microphone', type: 'microphone', error: 'Recording disabled in development' }
      };
    }
    throw new Error('Failed to start immediate recordings: ' + error.message);
  }
};

/**
 * Create backend recording entries with actual attempt ID
 * @param {string} attemptId - The actual quiz attempt ID
 * @returns {Promise<void>}
 */
const createBackendRecordingEntries = async (attemptId) => {
  try {
    // Create screen recording entry if it exists and is local
    if (recordingMetadata.screen && recordingMetadata.screen._id.includes('local-')) {
      const response = await axios.post('/api/recordings', {
        attemptId,
        type: 'screen'
      });
      recordingMetadata.screen = response.data.data;
    }
    // Create camera recording entry if it exists and is local
    if (recordingMetadata.camera && recordingMetadata.camera._id.includes('local-')) {
      const response = await axios.post('/api/recordings', {
        attemptId,
        type: 'camera'
      });
      recordingMetadata.camera = response.data.data;
      updateCameraAudioMetadata(); // Update if camera metadata changed
    }
    // Create microphone recording entry if it exists and is local
    if (recordingMetadata.microphone && recordingMetadata.microphone._id.includes('local-')) {
      const response = await axios.post('/api/recordings', {
        attemptId,
        type: 'microphone'
      });
      recordingMetadata.microphone = response.data.data;
      updateCameraAudioMetadata(); // Update if microphone metadata changed
    }
  } catch (error) {
    console.error('Error creating backend recording entries:', error);
    throw error;
  }
};

/**
 * Update recording metadata with actual attempt ID when quiz starts
 * @param {string} attemptId - The actual quiz attempt ID
 * @returns {Promise<Object>} Updated recording metadata
 */
export const updateRecordingAttemptId = async (attemptId) => {
  try {
    console.log('updateRecordingAttemptId called with:', attemptId);
    console.log('Recording state:', {
      recordingStarted,
      screenMetadata: recordingMetadata.screen,
      cameraMetadata: recordingMetadata.camera,
      microphoneMetadata: recordingMetadata.microphone
    });

    if (!recordingStarted) {
      console.error('Recording validation failed: recording not started');
      throw new Error('Recording not started');
    }

    // Check that we have at least one recording type active
    // Note: Check individual types now, not the combined cameraAudio
    if (!recordingMetadata.screen && !recordingMetadata.camera && !recordingMetadata.microphone) {
      console.error('Recording validation failed: no recording metadata available');
      throw new Error('No recording metadata available');
    }

    // Create backend recording entries with the actual attempt ID
    // This replaces the local metadata with real backend entries
    await createBackendRecordingEntries(attemptId);

    console.log('Recording attempt ID updated and backend entries created successfully');
    return recordingMetadata;
  } catch (error) {
    console.error('Error updating recording attempt ID:', error);
    // Don't throw error, just log it - recording can continue
    return recordingMetadata;
  }
};

/**
 * Start all recordings for a quiz attempt using existing streams
 * @param {Object} streams - Object containing media streams (screen, camera, microphone)
 * @param {string} attemptId - The quiz attempt ID
 * @returns {Promise<Object>} Recording metadata
 */
export const startAllRecordings = async (streams, attemptId) => {
  try {
    // Check if we're in development mode and recording is disabled
    const isDevelopment = process.env.NODE_ENV === 'development';
    const skipRecording = isDevelopment && process.env.REACT_APP_SKIP_RECORDING === 'true';

    if (skipRecording) {
      console.warn('Recording skipped in development mode');
      // Return mock recording metadata
      return {
        screen: { _id: 'mock-screen-recording', type: 'screen' },
        cameraAudio: { _id: 'mock-camera-audio-recording', type: 'camera-audio' },
        camera: { _id: 'mock-camera-recording', type: 'camera' },
        microphone: { _id: 'mock-microphone-recording', type: 'microphone' }
      };
    }

    // Validate that we have the required streams
    if (!streams?.screen || !streams?.camera || !streams?.microphone) {
      throw new Error('Missing required media streams. Please ensure all permissions are granted.');
    }

    let screenMeta = null;
    let cameraMeta = null;
    let microphoneMeta = null;
    let cameraAudioMeta = null; // For backward compatibility
    let errors = [];

    // Try to start screen recording using existing stream
    try {
      screenMeta = await startScreenRecording(streams.screen, attemptId);
      console.log('Screen recording started successfully');
    } catch (error) {
      console.error('Screen recording failed:', error);
      errors.push('Screen recording failed: ' + error.message);
      // Create a mock recording entry for screen
      screenMeta = { _id: 'failed-screen-recording', type: 'screen', error: error.message };
    }

    // Try to start camera recording using existing stream
    try {
      cameraMeta = await startCameraRecording(streams.camera, attemptId);
      console.log('Camera recording started successfully');
    } catch (error) {
      console.error('Camera recording failed:', error);
      errors.push('Camera recording failed: ' + error.message);
      // Create a mock recording entry for camera
      cameraMeta = { _id: 'failed-camera-recording', type: 'camera', error: error.message };
    }

    // Try to start microphone recording using existing stream
    try {
      microphoneMeta = await startMicrophoneRecording(streams.microphone, attemptId);
      console.log('Microphone recording started successfully');
    } catch (error) {
      console.error('Microphone recording failed:', error);
      errors.push('Microphone recording failed: ' + error.message);
      // Create a mock recording entry for microphone
      microphoneMeta = { _id: 'failed-microphone-recording', type: 'microphone', error: error.message };
    }

    // If all recordings failed, throw an error
    if (errors.length === 3) {
      throw new Error('All recordings failed: ' + errors.join(', '));
    }
    // If some recordings failed, log a warning but continue
    if (errors.length > 0) {
      console.warn('Partial recording failure:', errors.join(', '));
    }

    // Ensure backward compatibility metadata is updated
    updateCameraAudioMetadata();
    cameraAudioMeta = recordingMetadata.cameraAudio; // Get the derived value

    console.log('Recording setup completed:', { screen: screenMeta, camera: cameraMeta, microphone: microphoneMeta });
    return {
      screen: screenMeta,
      cameraAudio: cameraAudioMeta, // Backward compatibility
      camera: cameraMeta,
      microphone: microphoneMeta
    };
  } catch (error) {
    console.error('Error starting recordings:', error);
    // In development, allow quiz to continue without recording
    if (process.env.NODE_ENV === 'development') {
      console.warn('Continuing without recording in development mode');
      return {
        screen: { _id: 'dev-mock-screen', type: 'screen', error: 'Recording disabled in development' },
        cameraAudio: { _id: 'dev-mock-camera-audio', type: 'camera-audio', error: 'Recording disabled in development' },
        camera: { _id: 'dev-mock-camera', type: 'camera', error: 'Recording disabled in development' },
        microphone: { _id: 'dev-mock-microphone', type: 'microphone', error: 'Recording disabled in development' }
      };
    }
    throw new Error('Failed to start recordings: ' + error.message);
  }
};

/**
 * Stop all recordings
 * @returns {Promise<Object>} Object containing recording blobs
 */
export const stopAllRecordings = async () => {
  try {
    // Check if we're in development mode or have mock recordings
    const isDevelopment = process.env.NODE_ENV === 'development';
    const skipRecording = isDevelopment && process.env.REACT_APP_SKIP_RECORDING === 'true';

    if (skipRecording || (recordingMetadata.screen && recordingMetadata.screen._id.includes('mock'))) {
      console.warn('Stopping mock recordings in development mode');
      // Return mock blobs
      const mockBlob = new Blob(['mock recording data'], { type: 'video/webm' });
      return {
        screen: mockBlob,
        camera: mockBlob,
        microphone: new Blob(['mock audio data'], { type: 'audio/webm' }) // Mock audio
      };
    }

    let screenBlob = null;
    let cameraBlob = null;
    let microphoneBlob = null;
    let errors = [];

    // Try to stop screen recording
    try {
      screenBlob = await stopScreenRecording();
    } catch (error) {
      console.error('Failed to stop screen recording:', error);
      errors.push('Screen recording stop failed: ' + error.message);
      // Create a mock blob for failed recording
      screenBlob = new Blob(['failed screen recording'], { type: 'video/webm' });
    }

    // Try to stop camera recording
    try {
      cameraBlob = await stopCameraRecording();
    } catch (error) {
      console.error('Failed to stop camera recording:', error);
      errors.push('Camera recording stop failed: ' + error.message);
      // Create a mock blob for failed recording
      cameraBlob = new Blob(['failed camera recording'], { type: 'video/webm' });
    }

    // Try to stop microphone recording
    try {
      microphoneBlob = await stopMicrophoneRecording();
    } catch (error) {
      console.error('Failed to stop microphone recording:', error);
      errors.push('Microphone recording stop failed: ' + error.message);
      // Create a mock blob for failed recording
      microphoneBlob = new Blob(['failed microphone recording'], { type: 'audio/webm' });
    }

    // Log warnings for any failures but continue
    if (errors.length > 0) {
      console.warn('Some recordings failed to stop properly:', errors);
    }

    return {
      screen: screenBlob,
      camera: cameraBlob,
      microphone: microphoneBlob
    };
  } catch (error) {
    console.error('Error stopping recordings:', error);
    // In development, return mock blobs to allow quiz completion
    if (process.env.NODE_ENV === 'development') {
      console.warn('Returning mock blobs due to recording errors in development');
      const mockBlob = new Blob(['error mock recording'], { type: 'video/webm' });
      return {
        screen: mockBlob,
        camera: mockBlob,
        microphone: new Blob(['error mock audio'], { type: 'audio/webm' })
      };
    }
    throw new Error('Failed to stop recordings');
  }
};

/**
 * Upload all recordings
 * @param {Object} blobs - Object containing recording blobs {screen, camera, microphone}
 * @returns {Promise<Object>} Upload results
 */
export const uploadAllRecordings = async (blobs) => {
  try {
    // Prevent duplicate uploads
    if (uploadInProgress) {
      console.warn('Upload already in progress, skipping duplicate upload request');
      return {
        screen: { status: 'skipped', message: 'Upload already in progress' },
        camera: { status: 'skipped', message: 'Upload already in progress' },
        microphone: { status: 'skipped', message: 'Upload already in progress' },
        // Backward compatibility
        cameraAudio: { status: 'skipped', message: 'Upload already in progress' }
      };
    }
    if (uploadCompleted) {
      console.warn('Upload already completed, skipping duplicate upload request');
      return {
        screen: { status: 'skipped', message: 'Upload already completed' },
        camera: { status: 'skipped', message: 'Upload already completed' },
        microphone: { status: 'skipped', message: 'Upload already completed' },
        // Backward compatibility
        cameraAudio: { status: 'skipped', message: 'Upload already completed' }
      };
    }
    uploadInProgress = true;
    console.log('Starting upload process...');

    // Check if we're dealing with mock recordings
    const isDevelopment = process.env.NODE_ENV === 'development';
    const hasMockRecordings = recordingMetadata.screen &&
      (recordingMetadata.screen._id.includes('mock') || recordingMetadata.screen._id.includes('dev-mock'));

    if (isDevelopment && hasMockRecordings) {
      console.warn('Skipping upload for mock recordings in development mode');
      uploadCompleted = true;
      uploadInProgress = false;
      return {
        screen: { status: 'success', message: 'Mock upload completed' },
        camera: { status: 'success', message: 'Mock upload completed' },
        microphone: { status: 'success', message: 'Mock upload completed' },
        // Backward compatibility
        cameraAudio: { status: 'success', message: 'Mock upload completed' }
      };
    }

    let screenResult = null;
    let cameraResult = null;
    let microphoneResult = null;
    let cameraAudioResult = null; // For backward compatibility
    let errors = [];

    // Helper to check if a recording metadata is valid for upload
    const isValidRecording = (meta) =>
      meta &&
      !meta._id.includes('failed') &&
      !meta._id.includes('local-') &&
      !meta._id.includes('mock') &&
      !meta._id.includes('disabled');

    // Try to upload screen recording
    try {
      if (isValidRecording(recordingMetadata.screen)) {
        console.log('Uploading screen recording with ID:', recordingMetadata.screen._id);
        screenResult = await uploadRecording(blobs.screen, recordingMetadata.screen._id);
      } else {
        const reason = recordingMetadata.screen?._id?.includes('local-') ? 'Backend entry not created' :
                      recordingMetadata.screen?._id?.includes('failed') ? 'Recording failed' :
                      recordingMetadata.screen?._id?.includes('disabled') ? 'Recording disabled' :
                      'Mock recording';
        console.warn(`Skipping screen recording upload - ${reason} (ID: ${recordingMetadata.screen?._id})`);
        screenResult = { status: 'skipped', message: `${reason}, upload skipped` };
      }
    } catch (error) {
      console.error('Screen recording upload failed:', error);
      errors.push('Screen upload failed: ' + error.message);
      screenResult = { status: 'error', message: error.message };
    }

    // Try to upload camera recording
    try {
      if (isValidRecording(recordingMetadata.camera)) {
        console.log('Uploading camera recording with ID:', recordingMetadata.camera._id);
        cameraResult = await uploadRecording(blobs.camera, recordingMetadata.camera._id);
      } else {
        const reason = recordingMetadata.camera?._id?.includes('local-') ? 'Backend entry not created' :
                      recordingMetadata.camera?._id?.includes('failed') ? 'Recording failed' :
                      recordingMetadata.camera?._id?.includes('disabled') ? 'Recording disabled' :
                      'No camera recording';
        console.warn(`Skipping camera recording upload - ${reason} (ID: ${recordingMetadata.camera?._id})`);
        cameraResult = { status: 'skipped', message: `${reason}, upload skipped` };
      }
    } catch (error) {
      console.error('Camera recording upload failed:', error);
      errors.push('Camera upload failed: ' + error.message);
      cameraResult = { status: 'error', message: error.message };
    }

    // Try to upload microphone recording
    try {
      if (isValidRecording(recordingMetadata.microphone)) {
        console.log('Uploading microphone recording with ID:', recordingMetadata.microphone._id);
        microphoneResult = await uploadRecording(blobs.microphone, recordingMetadata.microphone._id);
      } else {
        const reason = recordingMetadata.microphone?._id?.includes('local-') ? 'Backend entry not created' :
                      recordingMetadata.microphone?._id?.includes('failed') ? 'Recording failed' :
                      recordingMetadata.microphone?._id?.includes('disabled') ? 'Recording disabled' :
                      'No microphone recording';
        console.warn(`Skipping microphone recording upload - ${reason} (ID: ${recordingMetadata.microphone?._id})`);
        microphoneResult = { status: 'skipped', message: `${reason}, upload skipped` };
      }
    } catch (error) {
      console.error('Microphone recording upload failed:', error);
      errors.push('Microphone upload failed: ' + error.message);
      microphoneResult = { status: 'error', message: error.message };
    }

    // Mark upload as completed
    uploadCompleted = true;
    uploadInProgress = false;

    // Log warnings for any failures but continue
    if (errors.length > 0) {
      console.warn('Some uploads failed:', errors);
    }

    // Backward compatibility: aggregate camera/microphone into a pseudo cameraAudio result if needed by caller
    const cameraOrAudioSuccess = (cameraResult && cameraResult.status === 'success') || (microphoneResult && microphoneResult.status === 'success');
    cameraAudioResult = cameraOrAudioSuccess ?
                        { status: 'success', message: 'Camera or audio uploaded' } :
                        { status: 'skipped', message: 'No camera or audio to upload' };

    console.log('Upload process completed:', { screen: screenResult, camera: cameraResult, microphone: microphoneResult });

    return {
      screen: screenResult,
      camera: cameraResult,
      microphone: microphoneResult,
      // Backward compatibility
      cameraAudio: cameraAudioResult
    };
  } catch (error) {
    uploadInProgress = false;
    console.error('Error uploading recordings:', error);
    // In development, return mock results to allow quiz completion
    if (process.env.NODE_ENV === 'development') {
      console.warn('Returning mock upload results due to errors in development');
      return {
        screen: { status: 'error', message: 'Development mode - upload skipped' },
        camera: { status: 'error', message: 'Development mode - upload skipped' },
        microphone: { status: 'error', message: 'Development mode - upload skipped' },
        // Backward compatibility
        cameraAudio: { status: 'error', message: 'Development mode - upload skipped' }
      };
    }
    throw new Error('Failed to upload recordings');
  }
};

/**
 * Check if recording is active
 * @returns {boolean} True if recording is active
 */
export const isRecordingActive = () => {
  return (
    (screenRecorder && screenRecorder.state === 'recording') ||
    (cameraRecorder && cameraRecorder.state === 'recording') ||
    (microphoneRecorder && microphoneRecorder.state === 'recording')
  );
};

/**
 * Reset upload state (for testing or error recovery)
 */
export const resetUploadState = () => {
  uploadInProgress = false;
  uploadCompleted = false;
  console.log('Upload state reset');
};

/**
 * Get current upload status
 * @returns {Object} Upload status information
 */
export const getUploadStatus = () => {
  return {
    uploadInProgress,
    uploadCompleted,
    recordingMetadata: {
      screen: recordingMetadata.screen ? {
        id: recordingMetadata.screen._id,
        type: recordingMetadata.screen.type,
        status: recordingMetadata.screen.status
      } : null,
      camera: recordingMetadata.camera ? {
        id: recordingMetadata.camera._id,
        type: recordingMetadata.camera.type,
        status: recordingMetadata.camera.status
      } : null,
      microphone: recordingMetadata.microphone ? {
        id: recordingMetadata.microphone._id,
        type: recordingMetadata.microphone.type,
        status: recordingMetadata.microphone.status
      } : null,
      // Backward compatibility
      cameraAudio: recordingMetadata.cameraAudio ? {
        id: recordingMetadata.cameraAudio._id,
        type: recordingMetadata.cameraAudio.type,
        status: recordingMetadata.cameraAudio.status
      } : null
    }
  };
};

/**
 * Validate that recording is working properly
 * @returns {Object} Validation result with details
 */
export const validateRecordingStatus = () => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check if recording was started
  if (!recordingStarted) {
    validation.isValid = false;
    validation.errors.push('Recording has not been started');
    return validation;
  }

  // Check if recording metadata exists
  if (!recordingMetadata) {
    validation.isValid = false;
    validation.errors.push('Recording metadata not available');
    return validation;
  }

  // Check screen recording if it should be active
  if (recordingMetadata.screen) {
    if (recordingMetadata.screen._id.includes('failed')) {
      validation.isValid = false;
      validation.errors.push('Screen recording failed to start');
    } else if (recordingMetadata.screen._id.includes('local-')) {
      validation.warnings.push('Screen recording backend entry not created yet');
    } else if (!screenRecorder) {
      if (activeStreams.screen && activeStreams.screen.getTracks().every(track => track.readyState === 'live')) {
        validation.warnings.push('Screen recorder not initialized but stream is active (can be recovered)');
      } else {
        validation.isValid = false;
        validation.errors.push('Screen recorder not initialized');
      }
    } else if (screenRecorder.state !== 'recording') {
      if (activeStreams.screen && activeStreams.screen.getTracks().every(track => track.readyState === 'live')) {
        validation.warnings.push(`Screen recorder is not in recording state (current state: ${screenRecorder.state}) but stream is active (can be recovered)`);
      } else {
        validation.isValid = false;
        validation.errors.push(`Screen recorder is not in recording state (current state: ${screenRecorder.state})`);
      }
    } else if (activeStreams.screen && activeStreams.screen.getTracks().some(track => track.readyState !== 'live')) {
      validation.isValid = false;
      validation.errors.push('Screen recording stream is no longer active');
    }
  }

  // Check camera recording if it should be active
  if (recordingMetadata.camera) {
    if (recordingMetadata.camera._id.includes('failed')) {
      validation.isValid = false;
      validation.errors.push('Camera recording failed to start');
    } else if (recordingMetadata.camera._id.includes('local-')) {
      validation.warnings.push('Camera recording backend entry not created yet');
    } else if (!cameraRecorder) {
      const hasActiveCameraStream = activeStreams.camera && activeStreams.camera.getTracks().every(track => track.readyState === 'live');
      if (hasActiveCameraStream) {
        validation.warnings.push('Camera recorder not initialized but stream is active (can be recovered)');
      } else {
        validation.isValid = false;
        validation.errors.push('Camera recorder not initialized');
      }
    } else if (cameraRecorder && cameraRecorder.state !== 'recording') {
      const hasActiveCameraStream = activeStreams.camera && activeStreams.camera.getTracks().every(track => track.readyState === 'live');
      if (hasActiveCameraStream) {
        validation.warnings.push(`Camera recorder is not in recording state (current state: ${cameraRecorder.state}) but stream is active (can be recovered)`);
      } else {
        validation.isValid = false;
        validation.errors.push(`Camera recorder is not in recording state (current state: ${cameraRecorder.state})`);
      }
    } else if (activeStreams.camera && activeStreams.camera.getTracks().some(track => track.readyState !== 'live')) {
      validation.isValid = false;
      validation.errors.push('Camera recording stream is no longer active');
    }
  }

  // Check microphone recording if it should be active
  if (recordingMetadata.microphone) {
    if (recordingMetadata.microphone._id.includes('failed')) {
      validation.isValid = false;
      validation.errors.push('Microphone recording failed to start');
    } else if (recordingMetadata.microphone._id.includes('local-')) {
      validation.warnings.push('Microphone recording backend entry not created yet');
    } else if (!microphoneRecorder) {
      const hasActiveMicrophoneStream = activeStreams.microphone && activeStreams.microphone.getTracks().every(track => track.readyState === 'live');
      if (hasActiveMicrophoneStream) {
        validation.warnings.push('Microphone recorder not initialized but stream is active (can be recovered)');
      } else {
        validation.isValid = false;
        validation.errors.push('Microphone recorder not initialized');
      }
    } else if (microphoneRecorder && microphoneRecorder.state !== 'recording') {
      const hasActiveMicrophoneStream = activeStreams.microphone && activeStreams.microphone.getTracks().every(track => track.readyState === 'live');
      if (hasActiveMicrophoneStream) {
        validation.warnings.push(`Microphone recorder is not in recording state (current state: ${microphoneRecorder.state}) but stream is active (can be recovered)`);
      } else {
        validation.isValid = false;
        validation.errors.push(`Microphone recorder is not in recording state (current state: ${microphoneRecorder.state})`);
      }
    } else if (activeStreams.microphone && activeStreams.microphone.getTracks().some(track => track.readyState !== 'live')) {
      validation.isValid = false;
      validation.errors.push('Microphone recording stream is no longer active');
    }
  }

  return validation;
};

/**
 * Get detailed recording status for debugging
 */
export const getRecordingDebugInfo = () => {
  return {
    recordingStarted,
    recordingMetadata: recordingMetadata ? {
      screen: recordingMetadata.screen ? {
        id: recordingMetadata.screen._id,
        hasRecorder: !!screenRecorder,
        recorderState: screenRecorder ? screenRecorder.state : 'null',
        hasStream: !!activeStreams.screen,
        streamActive: activeStreams.screen ? activeStreams.screen.getTracks().every(track => track.readyState === 'live') : false
      } : null,
      camera: recordingMetadata.camera ? {
        id: recordingMetadata.camera._id,
        hasRecorder: !!cameraRecorder,
        recorderState: cameraRecorder ? cameraRecorder.state : 'null',
        hasStream: !!activeStreams.camera,
        streamActive: activeStreams.camera ? activeStreams.camera.getTracks().every(track => track.readyState === 'live') : false
      } : null,
      microphone: recordingMetadata.microphone ? {
        id: recordingMetadata.microphone._id,
        hasRecorder: !!microphoneRecorder,
        recorderState: microphoneRecorder ? microphoneRecorder.state : 'null',
        hasStream: !!activeStreams.microphone,
        streamActive: activeStreams.microphone ? activeStreams.microphone.getTracks().every(track => track.readyState === 'live') : false
      } : null,
      // Backward compatibility debug info
      cameraAudio: recordingMetadata.cameraAudio ? {
        id: recordingMetadata.cameraAudio._id,
        derivedFrom: recordingMetadata.camera ? 'camera' : (recordingMetadata.microphone ? 'microphone' : 'none')
      } : null
    } : null,
    screenRecorder: screenRecorder ? {
      state: screenRecorder.state,
      mimeType: screenRecorder.mimeType
    } : null,
    cameraRecorder: cameraRecorder ? {
      state: cameraRecorder.state,
      mimeType: cameraRecorder.mimeType
    } : null,
    microphoneRecorder: microphoneRecorder ? {
      state: microphoneRecorder.state,
      mimeType: microphoneRecorder.mimeType
    } : null
  };
};

/**
 * Check if recording can be recovered (streams are still active even if recorders are lost)
 */
export const canRecoverRecording = () => {
  const hasActiveScreenStream = activeStreams.screen &&
    activeStreams.screen.getTracks().every(track => track.readyState === 'live');
  const hasActiveCameraStream = activeStreams.camera &&
    activeStreams.camera.getTracks().every(track => track.readyState === 'live');
  const hasActiveMicrophoneStream = activeStreams.microphone &&
    activeStreams.microphone.getTracks().every(track => track.readyState === 'live');

  return {
    canRecover: hasActiveScreenStream || hasActiveCameraStream || hasActiveMicrophoneStream,
    screenStreamActive: hasActiveScreenStream,
    cameraStreamActive: hasActiveCameraStream,
    microphoneStreamActive: hasActiveMicrophoneStream
  };
};

/**
 * Attempt to recover recording if streams are still active but recorders are lost
 */
export const recoverRecording = async () => {
  try {
    const recovery = canRecoverRecording();
    console.log('Attempting to recover recording...', recovery);
    let recovered = false;

    // Recover screen recording if stream is active but recorder is lost
    if (recovery.screenStreamActive && (!screenRecorder || screenRecorder.state !== 'recording')) {
      console.log('Recovering screen recording...');
      try {
        await startScreenRecordingLocal(activeStreams.screen);
        recovered = true;
      } catch (error) {
        console.error('Failed to recover screen recording:', error);
      }
    }

    // Recover camera recording if stream is active but recorder is lost
    if (recovery.cameraStreamActive && (!cameraRecorder || cameraRecorder.state !== 'recording')) {
      console.log('Recovering camera recording...');
      try {
        await startCameraRecordingLocal(activeStreams.camera);
        recovered = true;
      } catch (error) {
        console.error('Failed to recover camera recording:', error);
      }
    }

    // Recover microphone recording if stream is active but recorder is lost
    if (recovery.microphoneStreamActive && (!microphoneRecorder || microphoneRecorder.state !== 'recording')) {
      console.log('Recovering microphone recording...');
      try {
        await startMicrophoneRecordingLocal(activeStreams.microphone);
        recovered = true;
      } catch (error) {
        console.error('Failed to recover microphone recording:', error);
      }
    }

    // If no streams were available for recovery, check if we have disabled recordings that are OK
    if (!recovery.canRecover) {
      // Check if we have any recording metadata (including disabled ones)
      if (recordingMetadata.screen || recordingMetadata.camera || recordingMetadata.microphone) {
        console.log('No active streams to recover, but recording metadata exists (may include disabled recordings)');
        return true; // This is OK if recordings are disabled
      } else {
        throw new Error('No active streams available for recovery and no recording metadata');
      }
    }

    if (recovered) {
      console.log('Recording recovery completed successfully');
    } else {
      console.log('No recovery needed - recordings are already active or disabled');
    }
    return true;
  } catch (error) {
    console.error('Failed to recover recording:', error);
    return false;
  }
};

/**
 * Stop all media streams and disconnect from devices
 * This should be called when the quiz ends to properly release camera, microphone, and screen sharing
 */
export const disconnectAllMediaDevices = () => {
  try {
    console.log('Disconnecting all media devices...');
    let tracksStoppedCount = 0;

    // Helper function to stop tracks from a stream
    const stopTracks = (stream, label) => {
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            track.stop();
            tracksStoppedCount++;
            console.log(`Stopped ${label} track:`, track.kind, track.label);
          }
        });
      }
    };

    // Stop screen recorder if active
    if (screenRecorder) {
      if (screenRecorder.state === 'recording') {
        screenRecorder.stop();
        console.log('Screen recorder stopped');
      }
      // Stop all tracks from screen recorder's stream
      stopTracks(screenRecorder.stream, 'screen recorder stream');
    }

    // Stop camera recorder if active
    if (cameraRecorder) {
      if (cameraRecorder.state === 'recording') {
        cameraRecorder.stop();
        console.log('Camera recorder stopped');
      }
      // Stop all tracks from camera recorder's stream
      stopTracks(cameraRecorder.stream, 'camera recorder stream');
    }

    // Stop microphone recorder if active
    if (microphoneRecorder) {
      if (microphoneRecorder.state === 'recording') {
        microphoneRecorder.stop();
        console.log('Microphone recorder stopped');
      }
      // Stop all tracks from microphone recorder's stream
      stopTracks(microphoneRecorder.stream, 'microphone recorder stream');
    }

    // Stop all explicitly stored active streams (should be redundant now, but good for cleanup)
    stopTracks(activeStreams.screen, 'active screen stream');
    stopTracks(activeStreams.camera, 'active camera stream');
    stopTracks(activeStreams.microphone, 'active microphone stream');

    // Reset recording state
    recordingStarted = false;
    screenRecorder = null;
    cameraRecorder = null;
    microphoneRecorder = null;
    screenChunks = [];
    cameraChunks = [];
    microphoneChunks = [];
    recordingMetadata = {
      screen: null,
      camera: null,
      microphone: null,
      cameraAudio: null
    };
    activeStreams = {
      screen: null,
      camera: null,
      microphone: null
    };

    console.log(`All media devices disconnected successfully. Stopped ${tracksStoppedCount} tracks.`);
  } catch (error) {
    console.error('Error disconnecting media devices:', error);
  }
};

// --- Deprecated Functions (Kept for potential backward compatibility) ---

/**
 * Legacy function - now replaced by separate camera and microphone recording
 * @deprecated Use startCameraRecordingLocal and startMicrophoneRecordingLocal instead
 */
const startCameraAudioRecordingLocal = async (cameraStream, audioStream) => {
  console.warn('startCameraAudioRecordingLocal is deprecated. Using separate camera and microphone recordings.');
  const results = {};
  if (cameraStream) {
    results.camera = await startCameraRecordingLocal(cameraStream);
  }
  if (audioStream) {
    results.microphone = await startMicrophoneRecordingLocal(audioStream);
  }
  // Return camera metadata for backward compatibility
  return results.camera || results.microphone || { _id: 'no-streams-provided', type: 'camera-audio' };
};

/**
 * Stop camera-audio recording locally (deprecated)
 * @returns {Promise<Blob>} The recorded blob
 * @deprecated Use stopCameraRecording and stopMicrophoneRecording instead
 */
const stopCameraAudioRecordingLocal = async () => {
  console.warn('stopCameraAudioRecordingLocal is deprecated. Using separate camera and microphone recordings.');
  // Try to stop camera recording first, then microphone
  try {
    if (cameraRecorder && cameraRecorder.state === 'recording') {
      return await stopCameraRecording();
    } else if (microphoneRecorder && microphoneRecorder.state === 'recording') {
      return await stopMicrophoneRecording();
    } else {
      throw new Error('No active camera or microphone recording found');
    }
  } catch (error) {
    console.error('Error stopping camera-audio recording:', error);
    throw error;
  }
};

// --- Utility Functions ---

/**
 * Get recording errors if any
 * @returns {Object|null} Error object or null if no errors
 */
export const getRecordingErrors = () => {
  const errors = {};
  let hasErrors = false;

  if (screenRecorder && screenRecorder.state === 'inactive' && recordingMetadata.screen) {
    errors.screen = 'Screen recording stopped unexpectedly';
    hasErrors = true;
  }
  if (cameraRecorder && cameraRecorder.state === 'inactive' && recordingMetadata.camera) {
    errors.camera = 'Camera recording stopped unexpectedly';
    hasErrors = true;
  }
  if (microphoneRecorder && microphoneRecorder.state === 'inactive' && recordingMetadata.microphone) {
    errors.microphone = 'Microphone recording stopped unexpectedly';
    hasErrors = true;
  }

  return hasErrors ? errors : null;
};

/**
 * Get current recording metadata
 * @returns {Object} Current recording metadata
 */
export const getRecordingMetadata = () => {
  return recordingMetadata;
};

/**
 * Check if recording is properly initialized
 * @returns {boolean} True if recording is initialized
 */
export const isRecordingInitialized = () => {
  return recordingStarted && (recordingMetadata.screen || recordingMetadata.camera || recordingMetadata.microphone);
};

/**
 * Get recording initialization status
 * @returns {Object} Detailed initialization status
 */
export const getRecordingInitializationStatus = () => {
  return {
    recordingStarted,
    hasScreenRecording: !!recordingMetadata.screen,
    hasCameraRecording: !!recordingMetadata.camera,
    hasMicrophoneRecording: !!recordingMetadata.microphone,
    screenRecordingId: recordingMetadata.screen?._id,
    cameraRecordingId: recordingMetadata.camera?._id,
    microphoneRecordingId: recordingMetadata.microphone?._id,
    screenRecordingState: screenRecorder?.state,
    cameraRecordingState: cameraRecorder?.state,
    microphoneRecordingState: microphoneRecorder?.state
  };
};
