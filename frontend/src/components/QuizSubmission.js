import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
  Snackbar,
  Alert,
  Box,
  CircularProgress
} from '@mui/material';
import axios from '../utils/axiosConfig';
import { stopAllRecordings, uploadAllRecordings, disconnectAllMediaDevices } from '../services/recordingService';

/**
 * Quiz Submission Component
 * Handles quiz submission with validation, confirmation, and result display
 */
const QuizSubmission = ({ 
  quizId, 
  attemptId, 
  questions, 
  answers, 
  disabled 
}) => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');
  const [validationErrors, setValidationErrors] = useState([]);

  // Check if all questions are answered
  const allQuestionsAnswered = () => {
    return questions.every(question => answers[question._id]);
  };

  // Format answers for API requests
  const formatAnswers = () => {
    return Object.entries(answers).map(([questionId, answer]) => {
      // Handle different answer formats based on question type
      const question = questions.find(q => (q.id || q._id) === questionId);
      if (!question) return null;
      
      if (question.type === 'single-select') {
        return {
          questionId,
          selectedOptions: Array.isArray(answer) ? answer : [answer],
          textAnswer: ''
        };
      } else if (question.type === 'multi-select') {
        return {
          questionId,
          selectedOptions: Array.isArray(answer) ? answer : [answer],
          textAnswer: ''
        };
      } else if (question.type === 'free-text') {
        return {
          questionId,
          selectedOptions: [],
          textAnswer: answer || ''
        };
      }
      return null;
    }).filter(a => a !== null);
  };

  // Validate answers before submission
  const validateAnswers = async () => {
    try {
      // Format answers for validation
      const formattedAnswers = formatAnswers();
      
      // Send validation request
      const response = await axios.post(
        `/api/attempts/validate/${quizId}/${attemptId}`, 
        { answers: formattedAnswers }
      );
      
      const { validationResults, allQuestionsAnswered, isValid } = response.data.data;
      
      // If validation fails, show errors
      if (!isValid) {
        const errors = validationResults.filter(result => !result.valid);
        setValidationErrors(errors);
        
        // Create error message
        const errorMessage = errors.length === 1 
          ? `Error in question ${questions.findIndex(q => q._id === errors[0].questionId) + 1}: ${errors[0].error}`
          : `Found ${errors.length} errors in your answers. Please review before submitting.`;
        
        setSnackbarMessage(errorMessage);
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return false;
      }
      
      // If not all questions are answered, show warning
      if (!allQuestionsAnswered) {
        setSnackbarMessage('Not all questions have been answered. Please review before submitting.');
        setSnackbarSeverity('warning');
        setSnackbarOpen(true);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Validation error:', err);
      setSnackbarMessage('Failed to validate answers. Please try again.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return false;
    }
  };

  // Open confirmation dialog
  const handleSubmitClick = async () => {
    // Always allow submission, but show warning if not all questions answered
    if (!allQuestionsAnswered()) {
      setSnackbarMessage('Some questions are not answered. You can still submit, but unanswered questions will receive 0 points.');
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
    }
    setConfirmDialogOpen(true);
  };

  // Handle quiz submission
  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setConfirmDialogOpen(false);
      
      // Stop all recordings
      const recordingBlobs = await stopAllRecordings();
      
      // Format answers for submission
      const formattedAnswers = formatAnswers();
      
      // Submit quiz answers
      const response = await axios.put(`/api/attempts/submit/${quizId}/${attemptId}`, {
        answers: formattedAnswers
      });
      
      // Upload recordings
      await uploadAllRecordings(recordingBlobs);
      
      // Disconnect all media devices (camera, microphone, screen sharing)
      disconnectAllMediaDevices();
      
      // Check if we should show results immediately
      const responseData = response.data.data;
      if (responseData.totalScore !== undefined) {
        // Show results dialog
        setQuizResult({
          totalScore: responseData.totalScore,
          maxScore: responseData.maxScore,
          negativeMarkingApplied: responseData.negativeMarkingApplied,
          positiveScore: responseData.positiveScore,
          negativeScore: responseData.negativeScore
        });
        setResultDialogOpen(true);
      } else {
        // Show message that results will be available after review
        setSnackbarMessage('Quiz submitted successfully! Results will be available after review.');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        
        // Navigate to dashboard after a delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      }
    } catch (err) {
      setSnackbarMessage('Failed to submit quiz. Please try again.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button 
        variant="contained" 
        color="success" 
        onClick={handleSubmitClick}
        disabled={disabled || submitting}
        fullWidth
        size="large"
        sx={{ mt: 2 }}
      >
        {submitting ? (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
            Submitting...
          </Box>
        ) : (
          'Submit Quiz'
        )}
      </Button>
      
      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        aria-labelledby="confirm-submission-dialog-title"
        aria-describedby="confirm-submission-dialog-description"
      >
        <DialogTitle id="confirm-submission-dialog-title">
          Confirm Quiz Submission
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-submission-dialog-description">
            Are you sure you want to submit your quiz? Once submitted, you cannot change your answers.
            All recordings will be stopped and saved.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleSubmit} color="primary" variant="contained" autoFocus>
            Submit Quiz
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Result Dialog */}
      <Dialog
        open={resultDialogOpen}
        onClose={() => {
          setResultDialogOpen(false);
          navigate('/dashboard');
        }}
        aria-labelledby="result-dialog-title"
        aria-describedby="result-dialog-description"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="result-dialog-title" align="center">
          Quiz Results
        </DialogTitle>
        <DialogContent>
          {quizResult && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h3" gutterBottom color="primary">
                {quizResult.totalScore} / {quizResult.maxScore}
              </Typography>
              <Typography variant="h5" gutterBottom>
                {Math.round((quizResult.totalScore / quizResult.maxScore) * 100)}%
              </Typography>
              
              {quizResult.negativeMarkingApplied && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    Score Breakdown
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 2 }}>
                    <Box>
                      <Typography variant="body2" color="success.main">
                        <strong>Positive Score</strong>
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        +{quizResult.positiveScore || 0}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="error.main">
                        <strong>Penalty Points</strong>
                      </Typography>
                      <Typography variant="h6" color="error.main">
                        -{quizResult.negativeScore || 0}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">
                        <strong>Final Score</strong>
                      </Typography>
                      <Typography variant="h6">
                        {quizResult.totalScore}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
              
              <Typography variant="body1" sx={{ mt: 2 }}>
                {quizResult.totalScore === quizResult.maxScore 
                  ? 'Perfect score! Congratulations!' 
                  : quizResult.totalScore >= quizResult.maxScore * 0.7 
                    ? 'Great job!' 
                    : 'Keep practicing!'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setResultDialogOpen(false);
              navigate('/dashboard');
            }} 
            color="primary" 
            variant="contained"
            fullWidth
          >
            Return to Dashboard
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity} 
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default QuizSubmission;