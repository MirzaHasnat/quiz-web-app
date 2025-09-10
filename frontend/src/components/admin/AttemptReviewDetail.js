import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Videocam as VideocamIcon,
  DoneAll as DoneAllIcon,
  Undo as UndoIcon
} from '@mui/icons-material';
import { getAttemptDetails, reviewAttempt, updateAnswerFeedback } from '../../services/attemptService';
import { getAttemptRecordings } from '../../services/recordingService';
import { completeReview, unreviewAttempt } from '../../services/resultVisibilityService';
import CombinedRecordingPlayer from './CombinedRecordingPlayer';

const AttemptReviewDetail = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tabValue, setTabValue] = useState(() => {
    // Initialize tab value based on URL query parameter
    const params = new URLSearchParams(location.search);
    return params.get('tab') === 'recordings' ? 1 : 0;
  });
  const [feedback, setFeedback] = useState({});
  const [scores, setScores] = useState({});
  const [negativeScores, setNegativeScores] = useState({});
  const [totalScore, setTotalScore] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [recordingsData, setRecordingsData] = useState(null);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [completeReviewDialogOpen, setCompleteReviewDialogOpen] = useState(false);
  const [unreviewDialogOpen, setUnreviewDialogOpen] = useState(false);

  useEffect(() => {
    fetchAttemptDetails();
  }, [attemptId]);
  
  // Fetch recordings data when tab changes to recordings
  useEffect(() => {
    if (tabValue === 1 && attemptId) {
      fetchRecordingsData();
    }
  }, [tabValue, attemptId]);
  
  const fetchRecordingsData = async () => {
    try {
      setLoadingRecordings(true);
      const data = await getAttemptRecordings(attemptId);
      setRecordingsData(data);
      setLoadingRecordings(false);
    } catch (err) {
      console.error('Error fetching recordings data:', err);
      setLoadingRecordings(false);
    }
  };

  const fetchAttemptDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getAttemptDetails(attemptId);
      const attemptData = response.data;
      
      setAttempt(attemptData);
      
      // Initialize feedback and scores from attempt data
      const initialFeedback = {};
      const initialScores = {};
      const initialNegativeScores = {};
      
      attemptData.answers.forEach(answer => {
        initialFeedback[answer._id] = answer.feedback || '';
        initialScores[answer._id] = answer.score || 0;
        initialNegativeScores[answer._id] = answer.negativeScore || 0;
      });
      
      setFeedback(initialFeedback);
      setScores(initialScores);
      setNegativeScores(initialNegativeScores);
      setTotalScore(attemptData.totalScore);
      
      setLoading(false);
    } catch (err) {
      setError('Failed to load attempt details. Please try again.');
      setLoading(false);
      console.error('Error fetching attempt details:', err);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleFeedbackChange = (answerId, value) => {
    setFeedback(prev => ({ ...prev, [answerId]: value }));
  };

  const handleScoreChange = (answerId, value) => {
    const newScore = Math.max(0, Math.min(parseInt(value) || 0, getMaxPointsForQuestion(answerId)));
    
    setScores(prev => ({ ...prev, [answerId]: newScore }));
    
    // Recalculate total score including negative marking
    recalculateTotalScore(answerId, newScore, negativeScores[answerId] || 0);
  };

  const handleNegativeScoreChange = (answerId, value) => {
    const newNegativeScore = Math.max(0, parseFloat(value) || 0);
    
    setNegativeScores(prev => ({ ...prev, [answerId]: newNegativeScore }));
    
    // Recalculate total score including negative marking
    recalculateTotalScore(answerId, scores[answerId] || 0, newNegativeScore);
  };

  const recalculateTotalScore = (changedAnswerId, newScore, newNegativeScore) => {
    let positiveScore = 0;
    let totalNegativeScore = 0;
    
    Object.keys(scores).forEach(id => {
      if (id !== changedAnswerId) {
        positiveScore += scores[id];
        totalNegativeScore += negativeScores[id] || 0;
      }
    });
    
    positiveScore += newScore;
    totalNegativeScore += newNegativeScore;
    
    setTotalScore(positiveScore - totalNegativeScore);
  };

  const getMaxPointsForQuestion = (answerId) => {
    if (!attempt || !attempt.quizId || !attempt.quizId.questions) return 0;
    
    const answer = attempt.answers.find(a => a._id === answerId);
    if (!answer) return 0;
    
    const question = attempt.quizId.questions.find(q => q._id === answer.questionId);
    return question ? question.points : 0;
  };

  const handleSaveAnswer = async (answerId) => {
    try {
      setSaving(true);
      
      await updateAnswerFeedback(attemptId, answerId, {
        feedback: feedback[answerId],
        score: scores[answerId],
        negativeScore: negativeScores[answerId] || 0,
        isCorrect: scores[answerId] > 0
      });
      
      setSuccessMessage('Answer updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setSaving(false);
    } catch (err) {
      setError('Failed to update answer. Please try again.');
      setSaving(false);
      console.error('Error updating answer:', err);
    }
  };

  const handleOpenCompleteReviewDialog = () => {
    setCompleteReviewDialogOpen(true);
  };

  const handleCloseCompleteReviewDialog = () => {
    setCompleteReviewDialogOpen(false);
  };

  const handleCompleteReview = async () => {
    try {
      setSaving(true);
      
      // Prepare answers data with updated scores and feedback
      const answers = attempt.answers.map(answer => ({
        _id: answer._id,
        score: scores[answer._id],
        negativeScore: negativeScores[answer._id] || 0,
        feedback: feedback[answer._id],
        isCorrect: scores[answer._id] > 0
      }));
      
      // First save all the answer scores and feedback
      await reviewAttempt(attemptId, {
        answers,
        totalScore
      });
      
      // Then mark the attempt as reviewed to make results visible to the user
      await completeReview(attemptId);
      
      setSuccessMessage('Review completed successfully. Results are now visible to the user.');
      setCompleteReviewDialogOpen(false);
      
      setTimeout(() => {
        navigate('/admin/attempts');
      }, 2000);
      
    } catch (err) {
      setError('Failed to complete review. Please try again.');
      setSaving(false);
      console.error('Error completing review:', err);
    }
  };

  const handleOpenUnreviewDialog = () => {
    setUnreviewDialogOpen(true);
  };

  const handleCloseUnreviewDialog = () => {
    setUnreviewDialogOpen(false);
  };

  const handleUnreview = async () => {
    try {
      setSaving(true);
      
      // Mark the attempt as submitted (unreview)
      await unreviewAttempt(attemptId);
      
      setSuccessMessage('Attempt unreviewed successfully. Results are no longer visible to the user.');
      setUnreviewDialogOpen(false);
      
      // Refresh the attempt data
      await fetchAttemptDetails();
      setSaving(false);
      
    } catch (err) {
      setError('Failed to unreview attempt. Please try again.');
      setSaving(false);
      console.error('Error unreviewing attempt:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'in-progress':
        return <Chip label="In Progress" color="warning" size="small" />;
      case 'submitted':
        return <Chip label="Submitted" color="info" size="small" />;
      case 'reviewed':
        return <Chip label="Reviewed" color="success" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  const renderQuestionContent = (question, answer) => {
    if (!question) return 'Question not found';
    
    return (
      <>
        <Typography variant="h6" gutterBottom>
          {question.text}
        </Typography>
        
        {question.type === 'single-select' && (
          <Box sx={{ ml: 2 }}>
            {question.options.map(option => (
              <Box key={option._id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                {answer.selectedOptions.includes(option._id) ? (
                  <CheckIcon color={option.isCorrect ? "success" : "error"} />
                ) : (
                  option.isCorrect && <CheckIcon color="success" sx={{ opacity: 0.5 }} />
                )}
                <Typography 
                  sx={{ 
                    ml: 1,
                    fontWeight: answer.selectedOptions.includes(option._id) ? 'bold' : 'normal',
                    color: answer.selectedOptions.includes(option._id) && !option.isCorrect ? 'error.main' : 'inherit'
                  }}
                >
                  {option.text}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        
        {question.type === 'multi-select' && (
          <Box sx={{ ml: 2 }}>
            {question.options.map(option => (
              <Box key={option._id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                {answer.selectedOptions.includes(option._id) ? (
                  <CheckIcon color={option.isCorrect ? "success" : "error"} />
                ) : (
                  option.isCorrect && <CheckIcon color="success" sx={{ opacity: 0.5 }} />
                )}
                <Typography 
                  sx={{ 
                    ml: 1,
                    fontWeight: answer.selectedOptions.includes(option._id) ? 'bold' : 'normal',
                    color: answer.selectedOptions.includes(option._id) && !option.isCorrect ? 'error.main' : 'inherit'
                  }}
                >
                  {option.text}
                  {option.probability && ` (${option.probability}%)`}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        
        {question.type === 'free-text' && (
          <Box sx={{ ml: 2, mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {answer.textAnswer || 'No answer provided'}
            </Typography>
          </Box>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">{error}</Alert>
        <Button 
          variant="contained" 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/admin/attempts')}
          sx={{ mt: 2 }}
        >
          Back to Attempts
        </Button>
      </Box>
    );
  }

  if (!attempt) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="warning">Attempt not found</Alert>
        <Button 
          variant="contained" 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/admin/attempts')}
          sx={{ mt: 2 }}
        >
          Back to Attempts
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/admin/attempts')}
        >
          Back to Attempts
        </Button>
        
        <Typography variant="h5">
          Review Attempt
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<DoneAllIcon />}
            onClick={handleOpenCompleteReviewDialog}
            disabled={saving || attempt.status === 'reviewed'}
          >
            {saving ? 'Saving...' : 'Complete Review'}
          </Button>
          
          {attempt.status === 'reviewed' && (
            <Button 
              variant="outlined" 
              color="warning"
              startIcon={<UndoIcon />}
              onClick={handleOpenUnreviewDialog}
              disabled={saving}
            >
              Unreview
            </Button>
          )}
        </Box>
      </Box>
      
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1">
              Quiz: <strong>{attempt.quizId?.title}</strong>
            </Typography>
            <Typography variant="subtitle1">
              User: <strong>{attempt.userId?.username}</strong>
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1">
              Status: {getStatusChip(attempt.status)}
            </Typography>
            <Typography variant="subtitle1">
              Score: <strong>{totalScore}</strong> / {attempt.maxScore}
              {attempt.negativeMarkingApplied && (
                <Chip 
                  label="Negative Marking Applied" 
                  color="warning" 
                  size="small" 
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1">
              Started: {formatDate(attempt.startTime)}
            </Typography>
            <Typography variant="subtitle1">
              Submitted: {formatDate(attempt.endTime)}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            {attempt.reviewedBy && (
              <>
                <Typography variant="subtitle1">
                  Reviewed by: <strong>{attempt.reviewedBy.username}</strong>
                </Typography>
                <Typography variant="subtitle1">
                  Reviewed at: {formatDate(attempt.reviewedAt)}
                </Typography>
              </>
            )}
          </Grid>
        </Grid>
        
        {attempt.negativeMarkingApplied && (
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Score Breakdown
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="success.main">
                  <strong>Positive Score:</strong> {
                    attempt.answers.reduce((total, answer) => total + (answer.score || 0), 0)
                  }
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="error.main">
                  <strong>Penalty Points:</strong> -{
                    attempt.answers.reduce((total, answer) => total + (answer.negativeScore || 0), 0)
                  }
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2">
                  <strong>Final Score:</strong> {totalScore}
                </Typography>
              </Grid>
            </Grid>
          </Grid>
        )}
      </Paper>
      
      <Box sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Answers" />
          <Tab label="Recordings" />
        </Tabs>
      </Box>
      
      {tabValue === 0 && (
        <Box>
          {attempt.answers.map((answer, index) => {
            const question = attempt.quizId?.questions?.find(q => q._id === answer.questionId);
            const maxPoints = question ? question.points : 0;
            
            return (
              <Card key={answer._id} sx={{ mb: 3 }}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Question {index + 1} ({question?.type || 'unknown'})
                  </Typography>
                  
                  {renderQuestionContent(question, answer)}
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={attempt.negativeMarkingApplied ? 6 : 8}>
                      <TextField
                        label="Feedback"
                        multiline
                        rows={3}
                        fullWidth
                        value={feedback[answer._id] || ''}
                        onChange={(e) => handleFeedbackChange(answer._id, e.target.value)}
                        disabled={saving}
                      />
                    </Grid>
                    <Grid item xs={12} md={attempt.negativeMarkingApplied ? 3 : 4}>
                      <TextField
                        label={`Score (max: ${maxPoints})`}
                        type="number"
                        fullWidth
                        value={scores[answer._id] || 0}
                        onChange={(e) => handleScoreChange(answer._id, e.target.value)}
                        inputProps={{ min: 0, max: maxPoints }}
                        disabled={saving}
                      />
                    </Grid>
                    {attempt.negativeMarkingApplied && (
                      <Grid item xs={12} md={3}>
                        <TextField
                          label="Penalty Points"
                          type="number"
                          fullWidth
                          value={negativeScores[answer._id] || 0}
                          onChange={(e) => handleNegativeScoreChange(answer._id, e.target.value)}
                          inputProps={{ min: 0, step: 0.25 }}
                          disabled={saving}
                          helperText="Points to subtract"
                        />
                      </Grid>
                    )}
                  </Grid>
                  
                  {attempt.negativeMarkingApplied && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Answer Score Breakdown:</strong>
                      </Typography>
                      <Typography variant="body2" color="success.main">
                        Positive Score: +{scores[answer._id] || 0}
                      </Typography>
                      <Typography variant="body2" color="error.main">
                        Penalty: -{negativeScores[answer._id] || 0}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Net Score: {(scores[answer._id] || 0) - (negativeScores[answer._id] || 0)}</strong>
                      </Typography>
                    </Box>
                  )}
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    color="primary"
                    startIcon={<SaveIcon />}
                    onClick={() => handleSaveAnswer(answer._id)}
                    disabled={saving}
                  >
                    Save Changes
                  </Button>
                </CardActions>
              </Card>
            );
          })}
        </Box>
      )}
      
      {tabValue === 1 && (
        <Box>
          {loadingRecordings ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : recordingsData && recordingsData.recordings && recordingsData.recordings.length > 0 ? (
            <CombinedRecordingPlayer recordings={recordingsData.recordings} />
          ) : attempt.recordings && attempt.recordings.length > 0 ? (
            <CombinedRecordingPlayer 
              recordings={attempt.recordings.map(recording => ({
                id: recording._id,
                type: recording.type
              }))} 
            />
          ) : (
            <Alert severity="info">No recordings available for this attempt</Alert>
          )}
          
          {/* Recording information summary */}
          {recordingsData && recordingsData.attempt && (
            <Paper sx={{ p: 2, mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Recording Session Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2">
                    <strong>User:</strong> {recordingsData.attempt.user?.username || 'Unknown'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Session Start:</strong> {formatDate(recordingsData.attempt.startTime)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2">
                    <strong>Session End:</strong> {formatDate(recordingsData.attempt.endTime)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Status:</strong> {recordingsData.attempt.status}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          )}
        </Box>
      )}
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/admin/attempts')}
        >
          Back to Attempts
        </Button>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<DoneAllIcon />}
            onClick={handleOpenCompleteReviewDialog}
            disabled={saving || attempt.status === 'reviewed'}
          >
            {saving ? 'Saving...' : 'Complete Review'}
          </Button>
          
          {attempt.status === 'reviewed' && (
            <Button 
              variant="outlined" 
              color="warning"
              startIcon={<UndoIcon />}
              onClick={handleOpenUnreviewDialog}
              disabled={saving}
            >
              Unreview
            </Button>
          )}
        </Box>
      </Box>

      {/* Complete Review Dialog */}
      <Dialog
        open={completeReviewDialogOpen}
        onClose={handleCloseCompleteReviewDialog}
        aria-labelledby="complete-review-dialog-title"
        aria-describedby="complete-review-dialog-description"
      >
        <DialogTitle id="complete-review-dialog-title">
          Complete Review
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="complete-review-dialog-description">
            Completing this review will save all changes and make the results visible to the user. 
            The attempt status will be changed to "Reviewed".
            <br /><br />
            Total Score: <strong>{totalScore}</strong> / {attempt.maxScore}
            <br /><br />
            Are you sure you want to complete this review?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCompleteReviewDialog} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={handleCompleteReview} 
            color="primary" 
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <DoneAllIcon />}
          >
            {saving ? 'Saving...' : 'Complete Review'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unreview Dialog */}
      <Dialog
        open={unreviewDialogOpen}
        onClose={handleCloseUnreviewDialog}
        maxWidth="sm"
        fullWidth
        aria-labelledby="unreview-dialog-title"
        aria-describedby="unreview-dialog-description"
      >
        <DialogTitle id="unreview-dialog-title">
          Unreview Attempt
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="unreview-dialog-description">
            Are you sure you want to unreview this attempt? This will:
            <br />• Change the status back to "Submitted"
            <br />• Hide the results from the user
            <br />• Allow you to make further changes to scores and feedback
            <br />
            <br />
            The user will no longer be able to see their results until you complete the review again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUnreviewDialog} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={handleUnreview} 
            color="warning" 
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <UndoIcon />}
          >
            {saving ? 'Saving...' : 'Unreview'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AttemptReviewDetail;