import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Alert, 
  CircularProgress, 
  Chip 
} from '@mui/material';
import { 
  VisibilityOff as VisibilityOffIcon,
  Visibility as VisibilityIcon,
  HourglassEmpty as HourglassEmptyIcon
} from '@mui/icons-material';
import { checkResultVisibility } from '../services/resultVisibilityService';

/**
 * Component to display the result visibility status for a quiz attempt
 * @param {Object} props
 * @param {string} props.attemptId - The ID of the attempt to check
 */
const ResultVisibilityStatus = ({ attemptId }) => {
  const [visibilityStatus, setVisibilityStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVisibilityStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await checkResultVisibility(attemptId);
        setVisibilityStatus(response.data);
        
        setLoading(false);
      } catch (err) {
        console.error('Error checking result visibility:', err);
        setError('Failed to check result visibility status');
        setLoading(false);
      }
    };

    if (attemptId) {
      fetchVisibilityStatus();
    }
  }, [attemptId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2">Checking result visibility...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!visibilityStatus) {
    return null;
  }

  return (
    <Box sx={{ mt: 2, mb: 2 }}>
      {visibilityStatus.resultsVisible ? (
        <Alert 
          severity="success" 
          icon={<VisibilityIcon />}
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Typography variant="body2">
            Your quiz results are available. You can see your score and feedback.
          </Typography>
        </Alert>
      ) : visibilityStatus.requiresManualReview ? (
        <Alert 
          severity="info" 
          icon={<HourglassEmptyIcon />}
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Typography variant="body2">
            Your quiz results will be available after manual review by an administrator.
            {visibilityStatus.hasFreeTextQuestions && 
              ' This quiz contains free text questions that require manual grading.'}
          </Typography>
        </Alert>
      ) : (
        <Alert 
          severity="info" 
          icon={<VisibilityOffIcon />}
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <Typography variant="body2">
            Results for this quiz are not immediately visible. Please check back later.
          </Typography>
        </Alert>
      )}
      
      <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
        <Chip 
          size="small" 
          label={`Status: ${visibilityStatus.status}`} 
          color={visibilityStatus.status === 'reviewed' ? 'success' : 'default'}
        />
        {visibilityStatus.hasFreeTextQuestions && (
          <Chip size="small" label="Contains free text questions" color="primary" />
        )}
      </Box>
    </Box>
  );
};

export default ResultVisibilityStatus;