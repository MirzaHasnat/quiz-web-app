import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Grid,
  Paper,
  Divider,
  FormHelperText,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  Card,
  CardContent,
  CardActions,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  DragIndicator as DragIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';
import TimingService from '../../services/timingService';

const QuestionTypeEditor = ({ question, onChange, onDelete, onDuplicate, index, quizTimingMode }) => {
  const [questionData, setQuestionData] = useState({
    type: 'single-select',
    text: '',
    points: 1,
    timeLimit: 60, // Default time limit in seconds
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false }
    ],
    correctAnswer: ''
  });
  const [errors, setErrors] = useState({});

  // Initialize with question data if provided
  useEffect(() => {
    if (question) {
      console.log('QuestionTypeEditor received question:', question);
      const processedOptions = question.options && question.options.length > 0 
        ? question.options.map(option => {
            console.log('Processing option:', option);
            return { ...option };
          })
        : [
            { text: '', isCorrect: true },
            { text: '', isCorrect: false }
          ];
      
      setQuestionData({
        type: question.type || 'single-select',
        text: question.text || '',
        points: question.points || 1,
        timeLimit: question.timeLimit || 60,
        options: processedOptions,
        correctAnswer: question.correctAnswer || ''
      });
    }
  }, [question]);

  // Handle question type change
  const handleTypeChange = (e) => {
    const newType = e.target.value;
    
    let updatedOptions = [...questionData.options];
    
    // Reset correct answers based on type
    if (newType === 'single-select' && questionData.type !== 'single-select') {
      // Ensure only one option is marked as correct
      updatedOptions = updatedOptions.map((option, idx) => ({
        ...option,
        isCorrect: idx === 0 // Mark only the first option as correct
      }));
    } else if (newType === 'free-text') {
      // For free text, we don't need options
      updatedOptions = [];
    }
    
    const updatedQuestion = {
      ...questionData,
      type: newType,
      options: updatedOptions,
      correctAnswer: newType === 'free-text' ? questionData.correctAnswer : ''
    };
    
    setQuestionData(updatedQuestion);
    onChange(updatedQuestion, index);
  };

  // Handle question text change
  const handleTextChange = (e) => {
    const updatedQuestion = {
      ...questionData,
      text: e.target.value
    };
    
    setQuestionData(updatedQuestion);
    onChange(updatedQuestion, index);
    
    // Clear error if exists
    if (errors.text) {
      setErrors(prev => ({ ...prev, text: '' }));
    }
  };

  // Handle points change
  const handlePointsChange = (e) => {
    const points = Math.max(1, parseInt(e.target.value) || 1);
    
    const updatedQuestion = {
      ...questionData,
      points
    };
    
    setQuestionData(updatedQuestion);
    onChange(updatedQuestion, index);
  };

  // Handle time limit change
  const handleTimeLimitChange = (e) => {
    const timeLimit = Math.max(10, parseInt(e.target.value) || 60);
    
    const updatedQuestion = {
      ...questionData,
      timeLimit
    };
    
    setQuestionData(updatedQuestion);
    onChange(updatedQuestion, index);
  };

  // Get recommended time limits based on question type
  const getRecommendedTimeLimits = (type) => {
    const recommendations = TimingService.getDefaultRecommendations(type);
    return recommendations.map(rec => rec.seconds);
  };

  // Get quick time limit buttons
  const getQuickTimeLimitButtons = (type) => {
    return TimingService.getDefaultRecommendations(type);
  };

  // Handle option text change
  const handleOptionTextChange = (e, optionIndex) => {
    const updatedOptions = [...questionData.options];
    updatedOptions[optionIndex] = {
      ...updatedOptions[optionIndex],
      text: e.target.value
    };
    
    const updatedQuestion = {
      ...questionData,
      options: updatedOptions
    };
    
    setQuestionData(updatedQuestion);
    onChange(updatedQuestion, index);
    
    // Clear error if exists
    if (errors.options && errors.options[optionIndex]) {
      const updatedErrors = { ...errors };
      if (updatedErrors.options) {
        updatedErrors.options[optionIndex] = '';
      }
      setErrors(updatedErrors);
    }
  };

  // Handle option correct status change
  const handleOptionCorrectChange = (optionIndex) => {
    const updatedOptions = [...questionData.options];
    
    if (questionData.type === 'single-select') {
      // For single select, only one option can be correct
      updatedOptions.forEach((option, idx) => {
        option.isCorrect = idx === optionIndex;
      });
    } else {
      // For multi-select, toggle the current option
      updatedOptions[optionIndex] = {
        ...updatedOptions[optionIndex],
        isCorrect: !updatedOptions[optionIndex].isCorrect
      };
    }
    
    const updatedQuestion = {
      ...questionData,
      options: updatedOptions
    };
    
    setQuestionData(updatedQuestion);
    onChange(updatedQuestion, index);
  };

  // Handle adding a new option
  const handleAddOption = () => {
    const updatedOptions = [
      ...questionData.options,
      { text: '', isCorrect: false }
    ];
    
    const updatedQuestion = {
      ...questionData,
      options: updatedOptions
    };
    
    setQuestionData(updatedQuestion);
    onChange(updatedQuestion, index);
  };

  // Handle removing an option
  const handleRemoveOption = (optionIndex) => {
    if (questionData.options.length <= 2) {
      // Don't allow fewer than 2 options for multiple choice
      return;
    }
    
    const updatedOptions = questionData.options.filter((_, idx) => idx !== optionIndex);
    
    // If we're removing the only correct option in single-select, make the first option correct
    if (questionData.type === 'single-select' && questionData.options[optionIndex].isCorrect) {
      updatedOptions[0].isCorrect = true;
    }
    
    const updatedQuestion = {
      ...questionData,
      options: updatedOptions
    };
    
    setQuestionData(updatedQuestion);
    onChange(updatedQuestion, index);
  };

  // Handle correct answer change for free text
  const handleCorrectAnswerChange = (e) => {
    const updatedQuestion = {
      ...questionData,
      correctAnswer: e.target.value
    };
    
    setQuestionData(updatedQuestion);
    onChange(updatedQuestion, index);
  };

  // Handle moving option up
  const handleMoveOptionUp = (optionIndex) => {
    if (optionIndex === 0) return;
    
    const updatedOptions = [...questionData.options];
    const temp = updatedOptions[optionIndex];
    updatedOptions[optionIndex] = updatedOptions[optionIndex - 1];
    updatedOptions[optionIndex - 1] = temp;
    
    const updatedQuestion = {
      ...questionData,
      options: updatedOptions
    };
    
    setQuestionData(updatedQuestion);
    onChange(updatedQuestion, index);
  };

  // Handle moving option down
  const handleMoveOptionDown = (optionIndex) => {
    if (optionIndex === questionData.options.length - 1) return;
    
    const updatedOptions = [...questionData.options];
    const temp = updatedOptions[optionIndex];
    updatedOptions[optionIndex] = updatedOptions[optionIndex + 1];
    updatedOptions[optionIndex + 1] = temp;
    
    const updatedQuestion = {
      ...questionData,
      options: updatedOptions
    };
    
    setQuestionData(updatedQuestion);
    onChange(updatedQuestion, index);
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Question {index + 1}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<DuplicateIcon />}
              onClick={() => onDuplicate(index)}
            >
              Duplicate
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={() => onDelete(index)}
            >
              Remove
            </Button>
          </Box>
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Question Text"
              variant="outlined"
              value={questionData.text}
              onChange={handleTextChange}
              error={Boolean(errors.text)}
              helperText={errors.text}
              multiline
              rows={2}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={questionData.type}
                    onChange={handleTypeChange}
                    label="Type"
                  >
                    <MenuItem value="single-select">Single Select</MenuItem>
                    <MenuItem value="multi-select">Multi Select</MenuItem>
                    <MenuItem value="free-text">Free Text</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Points"
                  variant="outlined"
                  type="number"
                  value={questionData.points}
                  onChange={handlePointsChange}
                  inputProps={{ min: 1 }}
                />
              </Grid>
              
              {quizTimingMode === 'per-question' && (
                <Grid item xs={12}>
                  <Box>
                    <TextField
                      fullWidth
                      label="Time Limit (seconds)"
                      variant="outlined"
                      type="number"
                      value={questionData.timeLimit}
                      onChange={handleTimeLimitChange}
                      inputProps={{ min: 10, max: 3600 }}
                      helperText={`Recommended for ${questionData.type}: ${getRecommendedTimeLimits(questionData.type).join('s, ')}s`}
                      InputProps={{
                        startAdornment: <TimeIcon color="action" sx={{ mr: 1 }} />
                      }}
                    />
                    
                    <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>
                        Quick set:
                      </Typography>
                      {getQuickTimeLimitButtons(questionData.type).map((option) => (
                        <Chip
                          key={option.seconds}
                          label={option.display}
                          variant={questionData.timeLimit === option.seconds ? 'filled' : 'outlined'}
                          size="small"
                          clickable
                          onClick={() => {
                            const updatedQuestion = {
                              ...questionData,
                              timeLimit: option.seconds
                            };
                            setQuestionData(updatedQuestion);
                            onChange(updatedQuestion, index);
                          }}
                          color={questionData.timeLimit === option.seconds ? 'primary' : 'default'}
                        />
                      ))}
                    </Box>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 3 }}>
          {questionData.type === 'free-text' ? (
            <TextField
              fullWidth
              label="Correct Answer (Optional)"
              variant="outlined"
              value={questionData.correctAnswer || ''}
              onChange={handleCorrectAnswerChange}
              helperText="Leave blank if this question requires manual review"
              multiline
              rows={2}
            />
          ) : (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1">
                  Options {questionData.type === 'single-select' ? '(Select one correct answer)' : '(Select one or more correct answers)'}
                </Typography>
              </Box>
              
              <List>
                {questionData.options.map((option, optionIndex) => (
                  <ListItem
                    key={optionIndex}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                      bgcolor: option.isCorrect ? 'success.50' : 'transparent'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Box sx={{ mr: 1, display: 'flex', flexDirection: 'column' }}>
                        <Tooltip title="Move Up">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveOptionUp(optionIndex)}
                              disabled={optionIndex === 0}
                            >
                              <ArrowUpIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Move Down">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleMoveOptionDown(optionIndex)}
                              disabled={optionIndex === questionData.options.length - 1}
                            >
                              <ArrowDownIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                      
                      <TextField
                        fullWidth
                        label={`Option ${optionIndex + 1}`}
                        variant="outlined"
                        value={option.text}
                        onChange={(e) => handleOptionTextChange(e, optionIndex)}
                        error={Boolean(errors.options && errors.options[optionIndex])}
                        helperText={errors.options && errors.options[optionIndex]}
                        size="small"
                        sx={{ flexGrow: 1, mr: 2 }}
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={option.isCorrect}
                            onChange={() => handleOptionCorrectChange(optionIndex)}
                            color="success"
                          />
                        }
                        label="Correct"
                        sx={{ mr: 1, minWidth: 100 }}
                      />
                      
                      <Tooltip title="Remove Option">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveOption(optionIndex)}
                            disabled={questionData.options.length <= 2}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </ListItem>
                ))}
              </List>
              
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddOption}
                >
                  Add Option
                </Button>
              </Box>
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default QuestionTypeEditor;