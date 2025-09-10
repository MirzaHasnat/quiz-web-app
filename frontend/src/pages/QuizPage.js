import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material';
import axios from '../utils/axiosConfig';
import PermissionRequest from '../components/PermissionRequest';
import RecordingErrorPage from '../components/RecordingErrorPage';
import { validateRecordingBeforeQuiz } from '../services/recordingValidationService';
// Recording service functions are imported dynamically when needed

const QuizPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [recordingRequirements, setRecordingRequirements] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [attemptId, setAttemptId] = useState(null);
  const [recordings, setRecordings] = useState({
    screen: null,
    cameraAudio: null
  });
  const [attemptStatus, setAttemptStatus] = useState(null);
  const [canStart, setCanStart] = useState(true);
  const [canResume, setCanResume] = useState(false);
  const [recordingValidation, setRecordingValidation] = useState(null);
  const [showRecordingError, setShowRecordingError] = useState(false);

  useEffect(() => {
    const fetchQuizAndAttemptStatus = async () => {
      try {
        // Fetch quiz details
        const quizResponse = await axios.get(`/api/quizzes/${quizId}`);
        setQuiz(quizResponse.data.data);
        
        // Fetch recording requirements
        const recordingResponse = await axios.get(`/api/quizzes/${quizId}/recording-requirements`);
        setRecordingRequirements(recordingResponse.data.data.recordingRequirements);
        
        // Check for existing attempts
        const attemptResponse = await axios.get(`/api/attempts/check/${quizId}`);
        const attemptData = attemptResponse.data.data;
        
        setCanStart(attemptData.canStart);
        setCanResume(attemptData.canResume);
        setAttemptStatus(attemptData.attemptStatus);
        setAttemptId(attemptData.attemptId);
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load quiz. Please try again later.');
        setLoading(false);
      }
    };

    fetchQuizAndAttemptStatus();
  }, [quizId]);

  const handlePermissionsGranted = async (permissionData) => {
    console.log('Permissions granted and recording started:', permissionData);
    
    // Only proceed if permissions were successfully granted and recording started
    if (!permissionData.success) {
      console.error('Permissions were not successfully granted or recording failed');
      setError('Failed to start recording. Please ensure all required permissions are granted and try again.');
      return;
    }
    
    // Validate recording before allowing quiz access
    try {
      const validation = await validateRecordingBeforeQuiz(recordingRequirements);
      setRecordingValidation(validation);
      
      if (!validation.isValid) {
        console.error('Recording validation failed:', validation);
        setShowRecordingError(true);
        return;
      }
      
      // Validation passed, proceed with permissions
      setPermissionsGranted(true);
      
      // Recording has already started immediately after permissions were granted
      if (permissionData.recordingMetadata) {
        // Extract only string IDs, ensuring they are primitive strings
        const screenId = String(permissionData.recordingMetadata.screen?._id || 'failed-screen-recording');
        const cameraAudioId = String(permissionData.recordingMetadata.cameraAudio?._id || 'failed-camera-audio-recording');
        
        // Validate that recording IDs are not failed IDs
        if (screenId.includes('failed') || cameraAudioId.includes('failed')) {
          console.error('Recording failed to start properly:', { screenId, cameraAudioId });
          setShowRecordingError(true);
          setRecordingValidation({
            isValid: false,
            error: 'RECORDING_FAILED',
            message: 'Recording failed to start properly. Please try again or contact support.'
          });
          return;
        }
        
        // Only store primitive string values, not the full objects
        setRecordings({
          screen: screenId,
          cameraAudio: cameraAudioId
        });
        
        console.log('Recording is already active and will continue until quiz completion');
        console.log('Recording IDs:', { screen: screenId, cameraAudio: cameraAudioId });
      } else {
        console.error('No recording metadata received');
        setShowRecordingError(true);
        setRecordingValidation({
          isValid: false,
          error: 'RECORDING_METADATA_MISSING',
          message: 'Recording failed to start. Please try again or contact support.'
        });
      }
    } catch (validationError) {
      console.error('Recording validation error:', validationError);
      setShowRecordingError(true);
      setRecordingValidation({
        isValid: false,
        error: 'VALIDATION_ERROR',
        message: `Recording validation failed: ${validationError.message}`
      });
    }
  };

  const startQuiz = async () => {
    try {
      // Validate that permissions are properly granted and recording is working
      if (!permissionsGranted) {
        setError('Please grant all required permissions before starting the quiz.');
        return;
      }

      // Pre-quiz recording validation
      try {
        const validation = await validateRecordingBeforeQuiz(recordingRequirements);
        
        if (!validation.isValid) {
          console.error('Pre-quiz recording validation failed:', validation);
          setRecordingValidation(validation);
          setShowRecordingError(true);
          return;
        }
        
        if (validation.warnings && validation.warnings.length > 0) {
          console.warn('Recording warnings:', validation.warnings);
        }
      } catch (validationError) {
        console.error('Failed to validate recording status:', validationError);
        setRecordingValidation({
          isValid: false,
          error: 'VALIDATION_ERROR',
          message: `Unable to validate recording status: ${validationError.message}`
        });
        setShowRecordingError(true);
        return;
      }

      // Create a new quiz attempt
      const attemptResponse = await axios.post(`/api/attempts/start/${quizId}`);
      const newAttemptId = attemptResponse.data.data._id;
      setAttemptId(newAttemptId);
      
      // Update recording metadata with the actual attempt ID and create backend entries
      try {
        const { updateRecordingAttemptId } = await import('../services/recordingService');
        await updateRecordingAttemptId(newAttemptId);
        console.log('Recording attempt ID updated successfully');
      } catch (recordingError) {
        console.error('Failed to update recording attempt ID:', recordingError);
        setError('Failed to initialize recording for this quiz attempt. Please try again.');
        return;
      }
      
      console.log('Navigating to quiz attempt page...');
      navigate(`/quiz/${quizId}/attempt/${newAttemptId}`);
    } catch (err) {
      console.error('Error starting quiz:', err);
      
      // Provide more specific error messages
      if (err.message.includes('attempt')) {
        setError('Failed to create quiz attempt. Please try again or contact your administrator.');
      } else {
        setError('Failed to start quiz. Please try again.');
      }
    }
  };

  const resumeQuiz = async () => {
    try {
      // Validate that permissions are properly granted and recording is working
      if (!permissionsGranted) {
        setError('Please grant all required permissions before resuming the quiz.');
        return;
      }

      // Pre-quiz recording validation
      try {
        const validation = await validateRecordingBeforeQuiz(recordingRequirements);
        
        if (!validation.isValid) {
          console.error('Pre-quiz recording validation failed:', validation);
          setRecordingValidation(validation);
          setShowRecordingError(true);
          return;
        }
        
        if (validation.warnings && validation.warnings.length > 0) {
          console.warn('Recording warnings:', validation.warnings);
        }
      } catch (validationError) {
        console.error('Failed to validate recording status:', validationError);
        setRecordingValidation({
          isValid: false,
          error: 'VALIDATION_ERROR',
          message: `Unable to validate recording status: ${validationError.message}`
        });
        setShowRecordingError(true);
        return;
      }

      // Update recording metadata with the existing attempt ID and create backend entries
      try {
        const { updateRecordingAttemptId } = await import('../services/recordingService');
        await updateRecordingAttemptId(attemptId);
        console.log('Recording attempt ID updated successfully for resume');
      } catch (recordingError) {
        console.error('Failed to update recording attempt ID for resume:', recordingError);
        setError('Failed to initialize recording for resuming this quiz. Please try again.');
        return;
      }
      
      console.log('Navigating to resume quiz attempt page...');
      navigate(`/quiz/${quizId}/attempt/${attemptId}`);
    } catch (err) {
      console.error('Error resuming quiz:', err);
      setError('Failed to resume quiz. Please try again.');
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleRecordingErrorRetry = (validation) => {
    setRecordingValidation(validation);
    if (validation.isValid) {
      setShowRecordingError(false);
      setPermissionsGranted(true);
    }
  };

  const handleRecordingErrorBack = () => {
    setShowRecordingError(false);
    setPermissionsGranted(false);
    navigate('/dashboard');
  };

  const handleForceStart = () => {
    // Development only - force start quiz without recording validation
    if (process.env.NODE_ENV === 'development') {
      console.warn('Force starting quiz without recording validation (development mode)');
      setShowRecordingError(false);
      setPermissionsGranted(true);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Box sx={{ my: 4 }}>
          <Alert severity="error">{error}</Alert>
          <Button variant="contained" onClick={handleBack} sx={{ mt: 2 }}>
            Back to Dashboard
          </Button>
        </Box>
      </Container>
    );
  }

  // Show recording error page if there's a recording validation error
  if (showRecordingError && recordingValidation) {
    return (
      <RecordingErrorPage
        error={recordingValidation}
        recordingRequirements={recordingRequirements}
        onRetry={handleRecordingErrorRetry}
        onBack={handleRecordingErrorBack}
        onForceStart={process.env.NODE_ENV === 'development' ? handleForceStart : null}
      />
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {quiz?.title}
        </Typography>
        
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="body1" paragraph>
            {quiz?.description}
          </Typography>
          <Typography variant="body2">
            Duration: {quiz?.duration} minutes
          </Typography>
        </Paper>

{/* Show different UI based on attempt status */}
        {attemptStatus === 'submitted' || attemptStatus === 'reviewed' ? (
          <Paper sx={{ p: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              You have already completed this quiz.
            </Alert>
            <Button variant="contained" onClick={handleBack}>
              Back to Dashboard
            </Button>
          </Paper>
        ) : attemptStatus === 'time_up' ? (
          <Paper sx={{ p: 3 }}>
            <Alert severity="warning" sx={{ mb: 3 }}>
              Your previous quiz attempt ended because time ran out.
            </Alert>
            <Button variant="contained" onClick={handleBack}>
              Back to Dashboard
            </Button>
          </Paper>
        ) : attemptStatus === 'expired' ? (
          <Paper sx={{ p: 3 }}>
            <Alert severity="warning" sx={{ mb: 3 }}>
              Your previous quiz attempt has expired. The time limit was exceeded.
            </Alert>
            <Button variant="contained" onClick={handleBack}>
              Back to Dashboard
            </Button>
          </Paper>
        ) : !permissionsGranted ? (
          <PermissionRequest 
            recordingRequirements={recordingRequirements}
            onPermissionsGranted={handlePermissionsGranted} 
            onCancel={handleBack} 
          />
        ) : (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              {canResume ? 'Resume Quiz' : 'Ready to Start'}
            </Typography>
            
            {canResume ? (
              <>
                <Alert severity="warning" sx={{ mb: 3 }}>
                  You have an in-progress quiz attempt. You can resume where you left off.
                </Alert>
                <Typography variant="body1" paragraph>
                  Your previous answers have been saved. Click "Resume Quiz" to continue.
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="body1" paragraph>
                  All required permissions have been granted. You can now start the quiz.
                </Typography>
                
                {/* Show recording status */}
                {recordingRequirements && (recordingRequirements.enableScreen || recordingRequirements.enableCamera || recordingRequirements.enableMicrophone) && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    ✅ All required permissions granted and recording is active
                  </Alert>
                )}
              </>
            )}
            
            <Alert severity="info" sx={{ mb: 3 }}>
              {canResume ? 'Resuming' : 'Starting'} the quiz will {canResume ? 'restart' : 'start'} recording your screen, camera, and microphone.
            </Alert>
            

            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
              <Button variant="outlined" onClick={handleBack}>
                Back
              </Button>
              {canResume ? (
                <Button variant="contained" color="warning" onClick={resumeQuiz}>
                  Resume Quiz
                </Button>
              ) : canStart ? (
                <Button variant="contained" color="success" onClick={startQuiz}>
                  Start Quiz
                </Button>
              ) : (
                <Button variant="contained" disabled>
                  Quiz Not Available
                </Button>
              )}
            </Box>
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default QuizPage;