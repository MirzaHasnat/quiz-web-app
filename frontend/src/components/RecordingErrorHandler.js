import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Alert,
  Typography
} from '@mui/material';
import { getRecordingErrors } from '../services/recordingService';

/**
 * Component to handle recording errors
 * Displays a modal dialog when recording errors occur
 */
const RecordingErrorHandler = ({ onError, onRetry, onCancel }) => {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState(null);
  
  // Check for recording errors periodically
  useEffect(() => {
    const checkErrors = () => {
      const recordingErrors = getRecordingErrors();
      if (recordingErrors) {
        setErrors(recordingErrors);
        setOpen(true);
        if (onError) {
          onError(recordingErrors);
        }
      }
    };
    
    // Initial check
    checkErrors();
    
    // Set up interval to check for errors
    const interval = setInterval(checkErrors, 5000);
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, [onError]);
  
  // Handle retry button click
  const handleRetry = () => {
    setOpen(false);
    if (onRetry) {
      onRetry();
    }
  };
  
  // Handle cancel button click
  const handleCancel = () => {
    setOpen(false);
    if (onCancel) {
      onCancel();
    }
  };
  
  // If no errors, don't render anything
  if (!errors) {
    return null;
  }
  
  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      aria-labelledby="recording-error-dialog-title"
      aria-describedby="recording-error-dialog-description"
    >
      <DialogTitle id="recording-error-dialog-title">
        Recording Error
      </DialogTitle>
      <DialogContent>
        <Alert severity="error" sx={{ mb: 2 }}>
          There was an issue with the recording system.
        </Alert>
        <DialogContentText id="recording-error-dialog-description">
          <Typography variant="body1" paragraph>
            The following recording errors were detected:
          </Typography>
          <ul>
            {errors.screen && (
              <li>Screen recording: {errors.screen}</li>
            )}
            {errors.cameraAudio && (
              <li>Camera/Audio recording: {errors.cameraAudio}</li>
            )}
          </ul>
          <Typography variant="body1" paragraph>
            Please try again or contact support if the issue persists.
          </Typography>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} color="error">
          Cancel Quiz
        </Button>
        <Button onClick={handleRetry} color="primary" autoFocus>
          Retry Recording
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecordingErrorHandler;