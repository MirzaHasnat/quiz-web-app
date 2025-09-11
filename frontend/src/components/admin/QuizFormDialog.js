import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  CircularProgress,
  Switch,
  FormControlLabel,
  Grid,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from '@mui/material';
import axios from '../../utils/axiosConfig';

// Quiz service functions
const createQuiz = async (quizData) => {
  try {
    const response = await axios.post('/api/quizzes', quizData);
    return response.data;
  } catch (error) {
    console.error('Error creating quiz:', error);
    throw new Error(error.response?.data?.message || 'Failed to create quiz');
  }
};

const updateQuiz = async (quizId, quizData) => {
  try {
    const response = await axios.put(`/api/quizzes/${quizId}`, quizData);
    return response.data;
  } catch (error) {
    console.error('Error updating quiz:', error);
    throw new Error(error.response?.data?.message || 'Failed to update quiz');
  }
};

const QuizFormDialog = ({ open, quiz, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    timingMode: 'total', // 'total' | 'per-question'
    duration: 30,
    isActive: false,
    showResultsImmediately: false,
    recordingSettings: {
      enableMicrophone: false,
      enableCamera: false,
      enableScreen: false
    },
    negativeMarking: {
      enabled: false,
      penaltyValue: 0.5
    },
    resultVisibilitySettings: {
      showQuestionDetails: false,
      showCorrectAnswers: false,
      showUserAnswers: false,
      showFeedback: false
    }
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  // Reset form when dialog opens/closes or quiz changes
  useEffect(() => {
    if (open) {
      if (quiz) {
        // Edit mode - populate form with quiz data
        setFormData({
          title: quiz.title || '',
          description: quiz.description || '',
          timingMode: quiz.timingMode || 'total',
          duration: quiz.duration || 30,
          isActive: quiz.isActive || false,
          showResultsImmediately: quiz.showResultsImmediately || false,
          recordingSettings: {
            enableMicrophone: quiz.recordingSettings?.enableMicrophone ?? true,
            enableCamera: quiz.recordingSettings?.enableCamera ?? true,
            enableScreen: quiz.recordingSettings?.enableScreen ?? true
          },
          negativeMarking: {
            enabled: quiz.negativeMarking?.enabled ?? false,
            penaltyValue: quiz.negativeMarking?.penaltyValue ?? 0.25
          },
          resultVisibilitySettings: {
            showQuestionDetails: quiz.resultVisibilitySettings?.showQuestionDetails ?? true,
            showCorrectAnswers: quiz.resultVisibilitySettings?.showCorrectAnswers ?? true,
            showUserAnswers: quiz.resultVisibilitySettings?.showUserAnswers ?? true,
            showFeedback: quiz.resultVisibilitySettings?.showFeedback ?? true
          }
        });
      } else {
        // Create mode - reset form
        setFormData({
          title: '',
          description: '',
          timingMode: 'total',
          duration: 30,
          isActive: false,
          showResultsImmediately: false,
          recordingSettings: {
            enableMicrophone: false,
            enableCamera: false,
            enableScreen: false
          },
          negativeMarking: {
            enabled: false,
            penaltyValue: 0.25
          },
          resultVisibilitySettings: {
            showQuestionDetails: false,
            showCorrectAnswers: false,
            showUserAnswers: false,
            showFeedback: false
          }
        });
      }
      setErrors({});
      setError(null);
      setSuccess('');
    }
  }, [open, quiz]);

  // Handle form input change
  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    
    // Handle nested recording settings
    if (name.startsWith('recordingSettings.')) {
      const settingName = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        recordingSettings: {
          ...prev.recordingSettings,
          [settingName]: checked
        }
      }));
    } 
    // Handle nested negative marking settings
    else if (name.startsWith('negativeMarking.')) {
      const settingName = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        negativeMarking: {
          ...prev.negativeMarking,
          [settingName]: settingName === 'enabled' ? checked : parseFloat(value) || 0
        }
      }));
    }
    // Handle nested result visibility settings
    else if (name.startsWith('resultVisibilitySettings.')) {
      const settingName = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        resultVisibilitySettings: {
          ...prev.resultVisibilitySettings,
          [settingName]: checked
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: name === 'isActive' || name === 'showResultsImmediately' ? checked : value
      }));
    }
    
    // Clear field-specific error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title cannot exceed 100 characters';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!formData.duration) {
      newErrors.duration = 'Duration is required for total timing mode';
    } else if (isNaN(formData.duration) || formData.duration <= 0) {
      newErrors.duration = 'Duration must be a positive number';
    } else if (formData.duration > 300) {
      newErrors.duration = 'Duration cannot exceed 300 minutes (5 hours)';
    }
    
    // Validate negative marking penalty value
    if (formData.negativeMarking.enabled) {
      if (isNaN(formData.negativeMarking.penaltyValue) || formData.negativeMarking.penaltyValue < 0) {
        newErrors['negativeMarking.penaltyValue'] = 'Penalty value must be a positive number';
      } else if (formData.negativeMarking.penaltyValue > 10) {
        newErrors['negativeMarking.penaltyValue'] = 'Penalty value cannot exceed 10 points';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Prepare quiz data
      const quizData = {
        title: formData.title,
        description: formData.description,
        timingMode: formData.timingMode,
        duration: formData.timingMode === 'total' ? Number(formData.duration) : undefined,
        isActive: formData.isActive,
        showResultsImmediately: formData.showResultsImmediately,
        recordingSettings: formData.recordingSettings,
        negativeMarking: formData.negativeMarking,
        resultVisibilitySettings: formData.resultVisibilitySettings
      };
      
      let result;
      if (quiz) {
        // Update existing quiz
        result = await updateQuiz(quiz._id, quizData);
      } else {
        // Create new quiz
        result = await createQuiz(quizData);
      }
      
      // Check if scores were recalculated
      if (result.data?.scoresRecalculated) {
        const { attemptsProcessed, attemptsUpdated } = result.data.scoresRecalculated;
        if (attemptsUpdated > 0) {
          setSuccess(`Quiz updated successfully! Scores automatically recalculated for ${attemptsUpdated} out of ${attemptsProcessed} existing attempts.`);
        } else if (attemptsProcessed > 0) {
          setSuccess(`Quiz updated successfully! No score changes needed for ${attemptsProcessed} existing attempts.`);
        } else {
          setSuccess('Quiz updated successfully!');
        }
      } else {
        setSuccess(`Quiz ${quiz ? 'updated' : 'created'} successfully!`);
      }
      
      // Close dialog after a longer delay to show success message
      setTimeout(() => {
        onClose(true); // Pass true to indicate refresh needed
      }, 3000);
    } catch (err) {
      setError(err.message || (quiz ? 'Failed to update quiz' : 'Failed to create quiz'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="md" fullWidth>
      <DialogTitle>{quiz ? 'Edit Quiz' : 'Create New Quiz'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                margin="dense"
                label="Title"
                name="title"
                fullWidth
                variant="outlined"
                value={formData.title}
                onChange={handleChange}
                error={Boolean(errors.title)}
                helperText={errors.title}
                disabled={loading}
                autoFocus
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                margin="dense"
                label="Description"
                name="description"
                fullWidth
                variant="outlined"
                value={formData.description}
                onChange={handleChange}
                error={Boolean(errors.description)}
                helperText={errors.description}
                disabled={loading}
                multiline
                rows={4}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Timing Settings
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Timing Mode</InputLabel>
                <Select
                  value={formData.timingMode}
                  onChange={handleChange}
                  label="Timing Mode"
                  name="timingMode"
                  disabled={loading}
                >
                  <MenuItem value="total">Total Quiz Duration</MenuItem>
                  <MenuItem value="per-question">Per Question Duration</MenuItem>
                </Select>
                <FormHelperText>
                  {formData.timingMode === 'total' 
                    ? 'Single timer for the entire quiz' 
                    : 'Individual timers for each question'
                  }
                </FormHelperText>
              </FormControl>
            </Grid>
            
            {formData.timingMode === 'total' && (
              <Grid item xs={12} md={6}>
                <TextField
                  margin="dense"
                  label="Quiz Duration (minutes)"
                  name="duration"
                  type="number"
                  fullWidth
                  variant="outlined"
                  value={formData.duration}
                  onChange={handleChange}
                  error={Boolean(errors.duration)}
                  helperText={errors.duration || 'Total time allowed for the entire quiz'}
                  disabled={loading}
                  inputProps={{ min: 1, max: 300 }}
                />
              </Grid>
            )}
            
            {formData.timingMode === 'per-question' && (
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    <strong>Per-Question Timing:</strong> You'll set individual time limits for each question when managing questions. 
                    This mode provides more granular control over time allocation.
                  </Typography>
                </Alert>
              </Grid>
            )}
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Quiz Settings
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={handleChange}
                    name="isActive"
                    color="primary"
                    disabled={loading}
                  />
                }
                label="Active (available for assignment to users)"
              />
            </Grid>
            
            <Grid item xs={12}>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.showResultsImmediately}
                      onChange={handleChange}
                      name="showResultsImmediately"
                      color="primary"
                      disabled={loading}
                    />
                  }
                  label="Show Results Immediately"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
                  When enabled, quiz results will be shown to users immediately after submission for quizzes with only auto-graded questions.
                  If the quiz contains free-text questions, results will only be visible after manual review regardless of this setting.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Recording Settings
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Configure which recording types are required for this quiz. Users will only be asked for permissions for enabled recording types.
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.recordingSettings.enableMicrophone}
                      onChange={handleChange}
                      name="recordingSettings.enableMicrophone"
                      color="primary"
                      disabled={loading}
                    />
                  }
                  label="Microphone Recording"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
                  Record audio during the quiz session
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.recordingSettings.enableCamera}
                      onChange={handleChange}
                      name="recordingSettings.enableCamera"
                      color="primary"
                      disabled={loading}
                    />
                  }
                  label="Camera Recording"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
                  Record video from the user's camera
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.recordingSettings.enableScreen}
                      onChange={handleChange}
                      name="recordingSettings.enableScreen"
                      color="primary"
                      disabled={loading}
                    />
                  }
                  label="Screen Recording"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
                  Record the user's screen activity
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Negative Marking
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Configure negative marking to penalize incorrect answers. This helps discourage random guessing and provides more accurate assessment of knowledge.
              </Typography>
              {quiz && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="caption">
                    <strong>Note:</strong> Changing negative marking settings will automatically recalculate scores for all existing quiz attempts, including those already reviewed.
                  </Typography>
                </Alert>
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.negativeMarking.enabled}
                      onChange={handleChange}
                      name="negativeMarking.enabled"
                      color="primary"
                      disabled={loading}
                    />
                  }
                  label="Enable Negative Marking"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
                  Subtract points for incorrect answers
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                margin="dense"
                label="Penalty Value (points)"
                name="negativeMarking.penaltyValue"
                type="number"
                fullWidth
                variant="outlined"
                value={formData.negativeMarking.penaltyValue}
                onChange={handleChange}
                error={Boolean(errors['negativeMarking.penaltyValue'])}
                helperText={errors['negativeMarking.penaltyValue'] || 'Points to subtract for each incorrect answer'}
                disabled={loading || !formData.negativeMarking.enabled}
                inputProps={{ min: 0, max: 10, step: 0.25 }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Result Visibility Settings
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Control what information users can see when viewing their quiz results after review.
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.resultVisibilitySettings.showQuestionDetails}
                      onChange={handleChange}
                      name="resultVisibilitySettings.showQuestionDetails"
                      color="primary"
                      disabled={loading}
                    />
                  }
                  label="Show Question Details"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
                  Show individual questions and user answers
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.resultVisibilitySettings.showCorrectAnswers}
                      onChange={handleChange}
                      name="resultVisibilitySettings.showCorrectAnswers"
                      color="primary"
                      disabled={loading || !formData.resultVisibilitySettings.showQuestionDetails}
                    />
                  }
                  label="Show Correct Answers"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
                  Highlight correct answers for each question
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.resultVisibilitySettings.showFeedback}
                      onChange={handleChange}
                      name="resultVisibilitySettings.showFeedback"
                      color="primary"
                      disabled={loading || !formData.resultVisibilitySettings.showQuestionDetails}
                    />
                  }
                  label="Show Feedback"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
                  Display feedback provided during review
                </Typography>
              </Box>
            </Grid>
          </Grid>
          
          {quiz && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="info" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">
                  You can manage questions for this quiz after saving or use the Questions button in the quiz list.
                </Typography>
                <Button 
                  variant="outlined" 
                  color="primary" 
                  size="small"
                  onClick={() => {
                    // This would navigate to question management
                    console.log('Navigate to question management for quiz:', quiz._id);
                  }}
                >
                  Manage Questions
                </Button>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading || Boolean(success)}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {quiz ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default QuizFormDialog;