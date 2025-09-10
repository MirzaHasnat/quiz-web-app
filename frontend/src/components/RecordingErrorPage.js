import React, { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import HelpIcon from '@mui/icons-material/Help';
import BugReportIcon from '@mui/icons-material/BugReport';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { 
  validateRecordingBeforeQuiz, 
  attemptRecordingRecovery,
  getRecordingErrorInfo 
} from '../services/recordingValidationService';

const RecordingErrorPage = ({ 
  error, 
  recordingRequirements, 
  onRetry, 
  onBack, 
  onForceStart 
}) => {
  const [retrying, setRetrying] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  const errorInfo = getRecordingErrorInfo(error.error);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const validation = await validateRecordingBeforeQuiz(recordingRequirements);
      if (validation.isValid) {
        onRetry(validation);
      } else {
        // Still has errors, just refresh the error state
        onRetry(validation);
      }
    } catch (err) {
      console.error('Retry validation failed:', err);
      onRetry({
        isValid: false,
        error: 'VALIDATION_ERROR',
        message: `Retry failed: ${err.message}`
      });
    } finally {
      setRetrying(false);
    }
  };

  const handleRecovery = async () => {
    setRecovering(true);
    try {
      const recovery = await attemptRecordingRecovery(recordingRequirements);
      if (recovery.success) {
        // Recovery successful, trigger retry
        onRetry({
          isValid: true,
          message: recovery.message
        });
      } else {
        // Recovery failed, show error
        onRetry({
          isValid: false,
          error: 'RECOVERY_FAILED',
          message: recovery.message
        });
      }
    } catch (err) {
      console.error('Recovery failed:', err);
      onRetry({
        isValid: false,
        error: 'RECOVERY_FAILED',
        message: `Recovery failed: ${err.message}`
      });
    } finally {
      setRecovering(false);
    }
  };

  const handleRefreshPage = () => {
    window.location.reload();
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <ErrorIcon color="error" sx={{ fontSize: 40, mr: 2 }} />
            <Typography variant="h4" component="h1">
              {errorInfo.title}
            </Typography>
          </Box>

          <Alert severity="error" sx={{ mb: 3 }}>
            {error.message}
          </Alert>

          <Typography variant="body1" paragraph>
            {errorInfo.description}
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Suggested Solutions:
          </Typography>
          
          <List>
            {errorInfo.suggestions.map((suggestion, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <HelpIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary={suggestion} />
              </ListItem>
            ))}
          </List>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleRetry}
                disabled={retrying}
                startIcon={retrying ? <CircularProgress size={20} /> : <RefreshIcon />}
              >
                {retrying ? 'Checking...' : 'Try Again'}
              </Button>

              {error.canRetry && (
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={handleRecovery}
                  disabled={recovering}
                  startIcon={recovering ? <CircularProgress size={20} /> : <BugReportIcon />}
                >
                  {recovering ? 'Recovering...' : 'Attempt Recovery'}
                </Button>
              )}

              <Button
                variant="outlined"
                onClick={handleRefreshPage}
                startIcon={<RefreshIcon />}
              >
                Refresh Page
              </Button>

              <Button
                variant="outlined"
                onClick={onBack}
              >
                Back to Dashboard
              </Button>
            </Box>

            {/* Development/Admin force start option */}
            {process.env.NODE_ENV === 'development' && onForceStart && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Development Mode: You can force start the quiz without recording validation.
                  This should only be used for testing purposes.
                </Alert>
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={onForceStart}
                  size="small"
                >
                  Force Start Quiz (Dev Only)
                </Button>
              </Box>
            )}
          </Box>

          {/* Debug Information */}
          {(error.debugInfo || error.details) && (
            <Box sx={{ mt: 3 }}>
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  onClick={() => setShowDebugInfo(!showDebugInfo)}
                >
                  <Typography variant="subtitle2">
                    Technical Details (for support)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1 }}>
                    <Typography variant="caption" component="div" sx={{ mb: 1 }}>
                      Error Code: {error.error}
                    </Typography>
                    
                    {error.details && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" component="div" sx={{ fontWeight: 'bold' }}>
                          Error Details:
                        </Typography>
                        <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                          {Array.isArray(error.details) ? error.details.join('\n') : JSON.stringify(error.details, null, 2)}
                        </Typography>
                      </Box>
                    )}

                    {error.debugInfo && (
                      <Box>
                        <Typography variant="caption" component="div" sx={{ fontWeight: 'bold' }}>
                          Debug Information:
                        </Typography>
                        <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(error.debugInfo, null, 2)}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default RecordingErrorPage;