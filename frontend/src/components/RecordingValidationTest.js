import React, { useState } from 'react';
import { Button, Box, Typography, Alert, Paper } from '@mui/material';
import { validateRecordingBeforeQuiz } from '../services/recordingValidationService';

const RecordingValidationTest = () => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const testValidation = async () => {
    setLoading(true);
    try {
      const mockRequirements = {
        enableScreen: true,
        enableCamera: true,
        enableMicrophone: true
      };
      
      const validation = await validateRecordingBeforeQuiz(mockRequirements);
      setResult(validation);
    } catch (error) {
      setResult({
        isValid: false,
        error: 'TEST_ERROR',
        message: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    try {
      const axios = (await import('../utils/axiosConfig')).default;
      const response = await axios.get('/api/recordings/test-connection');
      setResult({
        isValid: true,
        message: 'Backend connection successful',
        data: response.data
      });
    } catch (error) {
      setResult({
        isValid: false,
        error: 'CONNECTION_ERROR',
        message: error.message,
        data: error.response?.data
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, m: 2 }}>
      <Typography variant="h6" gutterBottom>
        Recording Validation Test
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button 
          variant="contained" 
          onClick={testValidation}
          disabled={loading}
        >
          Test Recording Validation
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={testConnection}
          disabled={loading}
        >
          Test Backend Connection
        </Button>
      </Box>

      {result && (
        <Alert 
          severity={result.isValid ? 'success' : 'error'}
          sx={{ mt: 2 }}
        >
          <Typography variant="body2">
            <strong>Status:</strong> {result.isValid ? 'Valid' : 'Invalid'}
          </Typography>
          <Typography variant="body2">
            <strong>Message:</strong> {result.message}
          </Typography>
          {result.error && (
            <Typography variant="body2">
              <strong>Error:</strong> {result.error}
            </Typography>
          )}
          {result.data && (
            <Typography variant="body2" component="pre" sx={{ mt: 1, fontSize: '0.75rem' }}>
              {JSON.stringify(result.data, null, 2)}
            </Typography>
          )}
        </Alert>
      )}
    </Paper>
  );
};

export default RecordingValidationTest;