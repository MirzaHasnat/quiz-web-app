/**
 * Recording Validation Service
 * Handles pre-quiz validation of recording status and permissions
 */

/**
 * Validate recording status before starting quiz
 * @param {Object} recordingRequirements - Recording requirements from quiz
 * @returns {Promise<Object>} Validation result
 */
export const validateRecordingBeforeQuiz = async (recordingRequirements) => {
  try {
    // Import recording service functions
    const { 
      validateRecordingStatus, 
      getRecordingDebugInfo,
      getRecordingMetadata,
      isRecordingInitialized,
      getRecordingInitializationStatus
    } = await import('./recordingService');

    const { enableScreen = false, enableCamera = false, enableMicrophone = false } = recordingRequirements || {};

    // If no recording is required at all, immediately return valid
    if (!enableScreen && !enableCamera && !enableMicrophone) {
      return {
        isValid: true,
        message: 'No recording required for this quiz.',
        metadata: null,
        warnings: []
      };
    }

    // Check if recording is properly initialized
    if (!isRecordingInitialized()) {
      const initStatus = getRecordingInitializationStatus();
      
      return {
        isValid: false,
        error: 'RECORDING_NOT_STARTED',
        message: 'Recording has not been started. Please grant permissions and ensure recording is active.',
        canRetry: true,
        debugInfo: initStatus
      };
    }

    // Get current recording metadata
    const metadata = getRecordingMetadata();

    // Validate recording status
    const recordingValidation = validateRecordingStatus();
    
    if (!recordingValidation.isValid) {
      const debugInfo = getRecordingDebugInfo();
      
      return {
        isValid: false,
        error: 'RECORDING_VALIDATION_FAILED',
        message: `Recording validation failed: ${recordingValidation.errors.join(', ')}`,
        details: recordingValidation.errors,
        debugInfo,
        canRetry: true
      };
    }

    // Check if required recording types are available based on quiz requirements
    const missingRecordings = [];
    
    if (enableScreen && (!metadata.screen || metadata.screen._id.includes('failed'))) {
      missingRecordings.push('screen recording');
    }
    
    if ((enableCamera || enableMicrophone) && 
        (!metadata.cameraAudio || metadata.cameraAudio._id.includes('failed'))) {
      missingRecordings.push('camera/audio recording');
    }

    if (missingRecordings.length > 0) {
      return {
        isValid: false,
        error: 'REQUIRED_RECORDINGS_MISSING',
        message: `Required recordings are missing or failed: ${missingRecordings.join(', ')}`,
        missingRecordings,
        canRetry: true
      };
    }

    // Check for backend entry creation capability
    const needsBackendEntry = (metadata.screen && metadata.screen._id.startsWith('local-')) ||
                             (metadata.cameraAudio && metadata.cameraAudio._id.startsWith('local-'));

    if (needsBackendEntry) {
      // Test backend connectivity
      try {
        const axios = (await import('../utils/axiosConfig')).default;
        await axios.get('/api/recordings/test-connection');
      } catch (error) {
        return {
          isValid: false,
          error: 'BACKEND_CONNECTION_FAILED',
          message: 'Cannot connect to recording backend. Please check your internet connection.',
          canRetry: true
        };
      }
    }

    // All validations passed
    return {
      isValid: true,
      message: 'Recording validation successful',
      metadata,
      warnings: recordingValidation.warnings || []
    };

  } catch (error) {
    console.error('Recording validation error:', error);
    
    return {
      isValid: false,
      error: 'VALIDATION_ERROR',
      message: `Recording validation failed: ${error.message}`,
      canRetry: true
    };
  }
};

/**
 * Attempt to recover recording before quiz starts
 * @param {Object} recordingRequirements - Recording requirements from quiz
 * @returns {Promise<Object>} Recovery result
 */
export const attemptRecordingRecovery = async (recordingRequirements) => {
  try {
    const { recoverRecording } = await import('./recordingService');
    
    console.log('Attempting recording recovery...');
    const recovered = await recoverRecording();
    
    if (recovered) {
      // Re-validate after recovery
      const validation = await validateRecordingBeforeQuiz(recordingRequirements);
      
      if (validation.isValid) {
        return {
          success: true,
          message: 'Recording successfully recovered and validated'
        };
      } else {
        return {
          success: false,
          message: `Recording recovery failed validation: ${validation.message}`,
          validationError: validation
        };
      }
    } else {
      return {
        success: false,
        message: 'Recording recovery failed - unable to restore recording state'
      };
    }
  } catch (error) {
    console.error('Recording recovery error:', error);
    
    return {
      success: false,
      message: `Recording recovery failed: ${error.message}`
    };
  }
};

/**
 * Get user-friendly error message for recording validation errors
 * @param {string} errorCode - Error code from validation
 * @returns {Object} User-friendly error information
 */
export const getRecordingErrorInfo = (errorCode) => {
  const errorMap = {
    'RECORDING_NOT_STARTED': {
      title: 'Recording Not Started',
      description: 'The recording system has not been initialized. This usually happens when permissions were not properly granted.',
      suggestions: [
        'Refresh the page and grant all required permissions',
        'Ensure your browser supports screen recording',
        'Check that no other applications are using your camera or microphone'
      ]
    },
    'RECORDING_VALIDATION_FAILED': {
      title: 'Recording Validation Failed',
      description: 'The recording system is not functioning properly.',
      suggestions: [
        'Try refreshing the page',
        'Close other applications that might be using your camera or microphone',
        'Check your browser permissions for this site',
        'Try using a different browser (Chrome recommended)'
      ]
    },
    'REQUIRED_RECORDINGS_MISSING': {
      title: 'Required Recordings Missing',
      description: 'Some required recording types failed to start or are not available.',
      suggestions: [
        'Refresh the page and grant all permissions again',
        'Ensure your camera and microphone are properly connected',
        'Check that screen sharing is allowed in your browser',
        'Try using a different browser if the problem persists'
      ]
    },
    'BACKEND_CONNECTION_FAILED': {
      title: 'Connection Error',
      description: 'Cannot connect to the recording service backend.',
      suggestions: [
        'Check your internet connection',
        'Try refreshing the page',
        'Contact your administrator if the problem persists'
      ]
    },
    'VALIDATION_ERROR': {
      title: 'Validation Error',
      description: 'An unexpected error occurred while validating the recording system.',
      suggestions: [
        'Try refreshing the page',
        'Clear your browser cache and cookies',
        'Try using a different browser',
        'Contact technical support if the problem persists'
      ]
    }
  };

  return errorMap[errorCode] || {
    title: 'Unknown Error',
    description: 'An unknown error occurred with the recording system.',
    suggestions: [
      'Try refreshing the page',
      'Contact technical support'
    ]
  };
};