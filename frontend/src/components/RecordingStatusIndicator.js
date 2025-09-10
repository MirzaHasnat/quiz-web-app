import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  Badge
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import MicIcon from '@mui/icons-material/Mic';
import ErrorIcon from '@mui/icons-material/Error';
import { isRecordingActive, getRecordingErrors } from '../services/recordingService';

/**
 * Component to display recording status indicators
 * Shows status of screen, camera, and microphone recordings based on requirements
 */
const RecordingStatusIndicator = ({ recordingIds, recordingRequirements }) => {
  const [recordingStatus, setRecordingStatus] = useState({
    active: true,
    errors: null
  });
  
  // Check recording status periodically
  useEffect(() => {
    // Initial check
    checkRecordingStatus();
    
    // Set up interval to check status
    const interval = setInterval(checkRecordingStatus, 5000);
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, []);
  
  // Function to check recording status
  const checkRecordingStatus = () => {
    const active = isRecordingActive();
    const errors = getRecordingErrors();
    
    setRecordingStatus({
      active,
      errors
    });
  };
  
  // Render error indicator if there are errors
  if (recordingStatus.errors) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Tooltip title="Recording error. Please contact support.">
          <Chip
            icon={<ErrorIcon />}
            label="Recording Error"
            color="error"
            variant="outlined"
          />
        </Tooltip>
      </Box>
    );
  }
  
  // Use default requirements if not provided (backward compatibility)
  const requirements = recordingRequirements || {
    enableScreen: true,
    enableCamera: true,
    enableMicrophone: true
  };

  // Check if any recording is enabled
  const hasAnyRecording = requirements.enableScreen || requirements.enableCamera || requirements.enableMicrophone;

  // If no recording is enabled, don't show the indicator
  if (!hasAnyRecording) {
    return null;
  }

  // Render active recording indicators
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
      <Typography variant="body2" sx={{ mr: 1 }}>
        Recording:
      </Typography>
      
      {requirements.enableScreen && (
        <Tooltip title="Screen recording active">
          <Badge
            color={recordingStatus.active ? "success" : "error"}
            variant="dot"
            sx={{ mr: 1 }}
          >
            <ScreenShareIcon fontSize="small" />
          </Badge>
        </Tooltip>
      )}
      
      {requirements.enableCamera && (
        <Tooltip title="Camera recording active">
          <Badge
            color={recordingStatus.active ? "success" : "error"}
            variant="dot"
            sx={{ mr: 1 }}
          >
            <VideocamIcon fontSize="small" />
          </Badge>
        </Tooltip>
      )}
      
      {requirements.enableMicrophone && (
        <Tooltip title="Microphone recording active">
          <Badge
            color={recordingStatus.active ? "success" : "error"}
            variant="dot"
          >
            <MicIcon fontSize="small" />
          </Badge>
        </Tooltip>
      )}
    </Box>
  );
};

export default RecordingStatusIndicator;