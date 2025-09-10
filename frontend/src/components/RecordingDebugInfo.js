import React, { useState, useEffect } from 'react';
import { Paper, Typography, Button, Alert, Box } from '@mui/material';

const RecordingDebugInfo = () => {
  const [debugInfo, setDebugInfo] = useState(null);
  const [validation, setValidation] = useState(null);

  const refreshDebugInfo = async () => {
    try {
      const { getRecordingDebugInfo, validateRecordingStatus } = await import('../services/recordingService');
      const debug = getRecordingDebugInfo();
      const valid = validateRecordingStatus();
      
      setDebugInfo(debug);
      setValidation(valid);
    } catch (error) {
      console.error('Failed to get debug info:', error);
    }
  };

  useEffect(() => {
    refreshDebugInfo();
    const interval = setInterval(refreshDebugInfo, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!debugInfo || !validation) {
    return <Typography>Loading debug info...</Typography>;
  }

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Recording Debug Information
      </Typography>
      
      <Button onClick={refreshDebugInfo} variant="outlined" size="small" sx={{ mb: 2 }}>
        Refresh
      </Button>

      <Alert severity={validation.isValid ? 'success' : 'error'} sx={{ mb: 2 }}>
        Recording Status: {validation.isValid ? 'Valid' : 'Invalid'}
      </Alert>

      {validation.errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Errors: {validation.errors.join(', ')}
        </Alert>
      )}

      {validation.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Warnings: {validation.warnings.join(', ')}
        </Alert>
      )}

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2">Recording Started: {debugInfo.recordingStarted ? 'Yes' : 'No'}</Typography>
        
        {debugInfo.recordingMetadata && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 1 }}>Screen Recording:</Typography>
            <Typography variant="body2" sx={{ ml: 2 }}>
              ID: {debugInfo.recordingMetadata.screen?.id || 'None'}
            </Typography>
            <Typography variant="body2" sx={{ ml: 2 }}>
              Has Recorder: {debugInfo.recordingMetadata.screen?.hasRecorder ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="body2" sx={{ ml: 2 }}>
              Recorder State: {debugInfo.recordingMetadata.screen?.recorderState || 'N/A'}
            </Typography>

            <Typography variant="subtitle2" sx={{ mt: 1 }}>Camera-Audio Recording:</Typography>
            <Typography variant="body2" sx={{ ml: 2 }}>
              ID: {debugInfo.recordingMetadata.cameraAudio?.id || 'None'}
            </Typography>
            <Typography variant="body2" sx={{ ml: 2 }}>
              Has Recorder: {debugInfo.recordingMetadata.cameraAudio?.hasRecorder ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="body2" sx={{ ml: 2 }}>
              Recorder State: {debugInfo.recordingMetadata.cameraAudio?.recorderState || 'N/A'}
            </Typography>
          </>
        )}
      </Box>
    </Paper>
  );
};

export default RecordingDebugInfo;