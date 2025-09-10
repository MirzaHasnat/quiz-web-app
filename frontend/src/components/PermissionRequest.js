import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import VideocamIcon from '@mui/icons-material/Videocam';
import MicIcon from '@mui/icons-material/Mic';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { 
  requestScreenPermission, 
  requestCameraPermission, 
  requestMicrophonePermission,
  validateAllPermissions,
  stopAllStreams,
  stopRequiredStreams
} from '../services/mediaPermissions';
import { 
  checkBrowserSupport, 
  verifyRequiredPermissions,
  getPermissionErrorMessage
} from '../utils/permissionValidator';
import { startImmediateRecording } from '../services/recordingService';

const PermissionRequest = ({ recordingRequirements, onPermissionsGranted, onCancel }) => {
  const [permissionStep, setPermissionStep] = useState(0);
  const [permissions, setPermissions] = useState({
    screen: false,
    camera: false,
    microphone: false
  });
  const [streams, setStreams] = useState({
    screen: null,
    camera: null,
    microphone: null
  });
  const [requiredPermissions, setRequiredPermissions] = useState(null); // Start with null to indicate not loaded
  const [permissionSteps, setPermissionSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [browserSupported, setBrowserSupported] = useState(true);

  useEffect(() => {
    // Check browser support
    const supported = checkBrowserSupport();
    setBrowserSupported(supported);
    
    if (!supported) {
      const cameraPermission = requiredPermissions?.enableCamera ? 'Camera ' : null
      const microphonePermission = requiredPermissions?.enableMicrophone ? 'Microphone ' : null
      const screenPermission = requiredPermissions?.enableScreen ? 'Screen ' : null
      const errorMsg = `This quiz requires ${cameraPermission}${microphonePermission}${screenPermission}Your browser does not support the required features. Please use a modern browser like Chrome, Firefox, or Edge.`
      setError(errorMsg);
    }
    
    // Don't stop streams when component unmounts - recording should continue
    // Streams will be stopped only when quiz is submitted or user leaves the quiz
    return () => {
      console.log('PermissionRequest component unmounting, but keeping streams active for recording');
    };
  }, [streams]);

  // Set up required permissions based on quiz requirements
  useEffect(() => {
    if (recordingRequirements) {
      const required = [];
      const steps = [];
      
      if (recordingRequirements.enableScreen) {
        required.push('screen');
        steps.push({ key: 'screen', label: 'Screen Sharing' });
      }
      if (recordingRequirements.enableCamera) {
        required.push('camera');
        steps.push({ key: 'camera', label: 'Camera' });
      }
      if (recordingRequirements.enableMicrophone) {
        required.push('microphone');
        steps.push({ key: 'microphone', label: 'Microphone' });
      }
      
      steps.push({ key: 'ready', label: 'Ready' });
      
      setRequiredPermissions(required); // Now set as array instead of null
      setPermissionSteps(steps);
    }
  }, [recordingRequirements]);

  // Check if all required permissions are granted and start recording immediately
  useEffect(() => {
    // Only proceed if we have recording requirements loaded and required permissions processed
    if (!recordingRequirements || requiredPermissions === null) {
      return;
    }
    
    // Only proceed if we have required permissions defined and all are granted
    if (requiredPermissions.length === 0) {
      // No permissions required - immediately grant
      const startRecordingImmediately = async () => {
        try {
          // Start recording immediately with empty streams and requirements
          const recordingMetadata = await startImmediateRecording({}, recordingRequirements);
          
          // Validate that recording actually started successfully (if any recording is required)
          if (recordingRequirements.enableScreen || recordingRequirements.enableCamera || recordingRequirements.enableMicrophone) {
            const { validateRecordingStatus } = await import('../services/recordingService');
            const recordingValidation = validateRecordingStatus();
            
            if (!recordingValidation.isValid) {
              throw new Error(`Recording validation failed: ${recordingValidation.errors.join(', ')}`);
            }
          }
          
          // Pass both streams and recording metadata to parent
          onPermissionsGranted({
            streams: {},
            recordingMetadata,
            success: true
          });
        } catch (error) {
          console.error('Failed to start immediate recording:', error);
          
          // Don't notify parent if recording failed - show error instead
          setError(`Recording failed to start: ${error.message}. Please try again or contact support.`);
        }
      };
      
      startRecordingImmediately();
      return;
    }
    
    // Validate that all required permissions are properly granted
    const validation = validateRequiredPermissions();
    
    if (validation.valid && requiredPermissions.length > 0) {
      const startRecordingImmediately = async () => {
        try {
          // Start recording immediately with the streams and requirements
          const recordingMetadata = await startImmediateRecording(streams, recordingRequirements);
          
          // Validate that recording actually started successfully
          const { validateRecordingStatus } = await import('../services/recordingService');
          const recordingValidation = validateRecordingStatus();
          
          if (!recordingValidation.isValid) {
            throw new Error(`Recording validation failed: ${recordingValidation.errors.join(', ')}`);
          }
          
          // Pass both streams and recording metadata to parent
          onPermissionsGranted({
            streams,
            recordingMetadata,
            success: true
          });
        } catch (error) {
          console.error('Failed to start immediate recording:', error);
          
          // Don't notify parent if recording failed - show error instead
          setError(`Recording failed to start: ${error.message}. Please try again or contact support.`);
          
          // Don't stop streams here - let user retry or refresh page
          console.log('Recording failed, but keeping streams active for potential retry');
        }
      };
      
      startRecordingImmediately();
    }
  }, [permissions, streams, onPermissionsGranted, requiredPermissions, recordingRequirements]);

  const handlePermission = async (permissionType) => {
    setLoading(true);
    setError(null);
    try {
      let stream;
      switch (permissionType) {
        case 'screen':
          if (recordingRequirements.enableScreen) {
            stream = await requestScreenPermission();
          } else {
            throw new Error('Screen recording not required for this quiz');
          }
          break;
        case 'camera':
          if (recordingRequirements.enableCamera) {
            stream = await requestCameraPermission();
          } else {
            throw new Error('Camera recording not required for this quiz');
          }
          break;
        case 'microphone':
          if (recordingRequirements.enableMicrophone) {
            stream = await requestMicrophonePermission();
          } else {
            throw new Error('Microphone recording not required for this quiz');
          }
          break;
        default:
          throw new Error('Unknown permission type');
      }
      
      setStreams(prev => ({ ...prev, [permissionType]: stream }));
      setPermissions(prev => ({ ...prev, [permissionType]: true }));
      setPermissionStep(prev => prev + 1);
    } catch (err) {
      setError(getPermissionErrorMessage(permissionType));
    } finally {
      setLoading(false);
    }
  };

  // Validate that all required permissions are properly granted
  const validateRequiredPermissions = () => {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return { valid: true, missingPermissions: [] };
    }

    const missingPermissions = [];
    
    for (const permission of requiredPermissions) {
      if (!permissions[permission]) {
        missingPermissions.push(permission);
      } else if (!streams[permission]) {
        missingPermissions.push(`${permission} (stream not available)`);
      }
    }

    return {
      valid: missingPermissions.length === 0,
      missingPermissions
    };
  };

  const resetPermission = () => {
    // Reset the current permission step to try again
    if (permissionStep > 0 && requiredPermissions && permissionStep <= requiredPermissions.length) {
      const currentPermissionType = requiredPermissions[permissionStep - 1];
      
      // Stop the current stream only if it was actually requested
      if (streams[currentPermissionType] && recordingRequirements[`enable${currentPermissionType.charAt(0).toUpperCase() + currentPermissionType.slice(1)}`]) {
        streams[currentPermissionType].getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped ${currentPermissionType} track for retry`);
        });
      }
      
      // Reset the permission state
      setStreams(prev => ({ ...prev, [currentPermissionType]: null }));
      setPermissions(prev => ({ ...prev, [currentPermissionType]: false }));
      setPermissionStep(prev => prev - 1);
    }
    setError(null);
  };

  if (!browserSupported) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="outlined" onClick={onCancel}>
          Back
        </Button>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Required Permissions
      </Typography>
      
      {requiredPermissions === null ? (
        <Typography variant="body2" paragraph>
          Loading permission requirements...
        </Typography>
      ) : requiredPermissions.length === 0 ? (
        <Typography variant="body2" paragraph>
          This quiz does not require any media recording permissions. You can start the quiz immediately.
        </Typography>
      ) : (
        <>
          <Typography variant="body2" paragraph>
            This quiz requires the following permissions for monitoring purposes.
            Please grant all required permissions to continue.
          </Typography>

          <List>
            {recordingRequirements.enableScreen && (
              <ListItem>
                <ListItemIcon>
                  {permissions.screen ? <CheckCircleIcon color="success" /> : <ScreenShareIcon />}
                </ListItemIcon>
                <ListItemText 
                  primary="Screen Sharing" 
                  secondary="Allows us to monitor your screen during the quiz to ensure academic integrity"
                />
              </ListItem>
            )}
            {recordingRequirements.enableCamera && (
              <ListItem>
                <ListItemIcon>
                  {permissions.camera ? <CheckCircleIcon color="success" /> : <VideocamIcon />}
                </ListItemIcon>
                <ListItemText 
                  primary="Camera" 
                  secondary="Allows us to verify your identity during the quiz"
                />
              </ListItem>
            )}
            {recordingRequirements.enableMicrophone && (
              <ListItem>
                <ListItemIcon>
                  {permissions.microphone ? <CheckCircleIcon color="success" /> : <MicIcon />}
                </ListItemIcon>
                <ListItemText 
                  primary="Microphone" 
                  secondary="Allows us to record audio during the quiz"
                />
              </ListItem>
            )}
          </List>
        </>
      )}

      {permissionSteps.length > 1 && (
        <Stepper activeStep={permissionStep} sx={{ mb: 3 }}>
          {permissionSteps.map((step, index) => (
            <Step key={step.key}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <>
            {error && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="outlined" color="warning" onClick={resetPermission}>
                  Try Again
                </Button>
                <Button variant="outlined" onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
              </Box>
            )}
            
            {requiredPermissions && permissionStep < requiredPermissions.length && !error && (
              <Button 
                variant="contained" 
                color="primary" 
                onClick={() => handlePermission(requiredPermissions[permissionStep])}
                disabled={loading}
              >
                Allow {requiredPermissions[permissionStep] === 'screen' ? 'Screen Sharing' : 
                       requiredPermissions[permissionStep] === 'camera' ? 'Camera' : 'Microphone'}
              </Button>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
};

export default PermissionRequest;