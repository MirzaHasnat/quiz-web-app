import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Box,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { isRecordingActive, getRecordingErrors, startAllRecordings } from '../services/recordingService';

/**
 * Recording Monitor Component
 * Continuously monitors recording status and provides restart functionality
 */
const RecordingMonitor = ({ 
  recordingIds, 
  attemptId, 
  onRecordingRestart,
  onRecordingFailure 
}) => {
  const [recordingStatus, setRecordingStatus] = useState({
    isActive: true,
    errors: null,
    lastCheck: Date.now()
  });
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [streams, setStreams] = useState(null);

  // Check recording status periodically
  const checkRecordingStatus = useCallback(() => {
    const isActive = isRecordingActive();
    const errors = getRecordingErrors();
    
    setRecordingStatus(prev => ({
      isActive,
      errors,
      lastCheck: Date.now(),
      // Only show dialog if recording was active before and now it's not
      shouldShowDialog: prev.isActive && !isActive
    }));

    // Show restart dialog if recording stopped unexpectedly
    if (!isActive && errors) {
      setShowRestartDialog(true);
    }
  }, []);

  // Set up periodic monitoring
  useEffect(() => {
    if (!recordingIds) return;

    // Check immediately
    checkRecordingStatus();

    // Set up interval to check every 5 seconds
    const interval = setInterval(checkRecordingStatus, 5000);

    return () => clearInterval(interval);
  }, [recordingIds, checkRecordingStatus]);

  // Get media streams for restart
  const getMediaStreams = async () => {
    try {
      // Request screen sharing
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      // Request camera
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      });

      // Request microphone
      const microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      return {
        screen: screenStream,
        camera: cameraStream,
        microphone: microphoneStream
      };
    } catch (error) {
      console.error('Error getting media streams:', error);
      throw error;
    }
  };

  // Handle recording restart
  const handleRestartRecording = async () => {
    try {
      setRestarting(true);

      // Get fresh media streams
      const mediaStreams = await getMediaStreams();
      setStreams(mediaStreams);

      // Start recordings
      const recordingMeta = await startAllRecordings(mediaStreams, attemptId);

      // Update recording IDs
      if (onRecordingRestart) {
        onRecordingRestart({
          screen: recordingMeta.screen._id,
          cameraAudio: recordingMeta.cameraAudio._id
        });
      }

      // Close dialog
      setShowRestartDialog(false);
      
      // Update status
      setRecordingStatus({
        isActive: true,
        errors: null,
        lastCheck: Date.now()
      });

    } catch (error) {
      console.error('Failed to restart recording:', error);
      
      if (onRecordingFailure) {
        onRecordingFailure(error);
      }
    } finally {
      setRestarting(false);
    }
  };

  // Handle dialog close (user chooses to continue without recording)
  const handleContinueWithoutRecording = () => {
    setShowRestartDialog(false);
    
    if (onRecordingFailure) {
      onRecordingFailure(new Error('User chose to continue without recording'));
    }
  };

  // Render recording status indicator
  const renderStatusIndicator = () => {
    if (!recordingIds) return null;

    const { isActive, errors } = recordingStatus;

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {isActive ? (
          <Chip
            icon={<VideocamIcon />}
            label="Recording Active"
            color="success"
            size="small"
            variant="outlined"
          />
        ) : (
          <Chip
            icon={<VideocamOffIcon />}
            label="Recording Stopped"
            color="error"
            size="small"
            variant="outlined"
          />
        )}
        
        {errors && (
          <Chip
            icon={<WarningIcon />}
            label="Recording Issues"
            color="warning"
            size="small"
            variant="outlined"
          />
        )}
      </Box>
    );
  };

  return (
    <>
      {/* Status Indicator */}
      {renderStatusIndicator()}

      {/* Restart Dialog */}
      <Dialog
        open={showRestartDialog}
        onClose={() => {}} // Prevent closing by clicking outside
        aria-labelledby="recording-restart-dialog-title"
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle id="recording-restart-dialog-title">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            Recording Stopped
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Your quiz recording has stopped unexpectedly. This may affect the integrity of your quiz attempt.
          </Alert>
          
          <Typography variant="body1" paragraph>
            To maintain quiz integrity, we recommend restarting the recording. This will require you to grant permissions again.
          </Typography>

          {recordingStatus.errors && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Recording Errors:
              </Typography>
              {Object.entries(recordingStatus.errors).map(([type, error]) => (
                <Alert key={type} severity="error" sx={{ mb: 1 }}>
                  <strong>{type}:</strong> {error}
                </Alert>
              ))}
            </Box>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            You can choose to continue without recording, but this may be flagged for review.
          </Typography>
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={handleContinueWithoutRecording}
            color="inherit"
            disabled={restarting}
          >
            Continue Without Recording
          </Button>
          
          <Button
            onClick={handleRestartRecording}
            variant="contained"
            color="primary"
            disabled={restarting}
            startIcon={restarting ? <CircularProgress size={20} /> : <RefreshIcon />}
          >
            {restarting ? 'Restarting...' : 'Restart Recording'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RecordingMonitor;