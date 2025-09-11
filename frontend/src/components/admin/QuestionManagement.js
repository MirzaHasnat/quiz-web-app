import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  DragIndicator as DragIndicator
} from '@mui/icons-material';
import QuestionTypeEditor from './QuestionTypeEditor';
import ConfirmDialog from './ConfirmDialog';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

import axios from '../../utils/axiosConfig';

// Question service functions
const getQuizQuestions = async (quizId) => {
  try {
    const response = await axios.get(`/api/quizzes/${quizId}/questions`);
    return response.data.data;
  } catch (error) {
    console.error('Error fetching questions:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch questions');
  }
};

const addQuestion = async (quizId, questionData) => {
  try {
    const response = await axios.post(`/api/quizzes/${quizId}/questions`, questionData);
    return response.data;
  } catch (error) {
    console.error('Error adding question:', error);
    throw new Error(error.response?.data?.message || 'Failed to add question');
  }
};

const updateQuestion = async (quizId, questionId, questionData) => {
  try {
    const response = await axios.put(`/api/quizzes/${quizId}/questions/${questionId}`, questionData);
    return response.data;
  } catch (error) {
    console.error('Error updating question:', error);
    throw new Error(error.response?.data?.message || 'Failed to update question');
  }
};

const deleteQuestion = async (quizId, questionId) => {
  try {
    const response = await axios.delete(`/api/quizzes/${quizId}/questions/${questionId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting question:', error);
    throw new Error(error.response?.data?.message || 'Failed to delete question');
  }
};

const reorderQuestions = async (quizId, questionIds) => {
  try {
    const response = await axios.put(`/api/quizzes/${quizId}/reorder`, { questionIds });
    return response.data;
  } catch (error) {
    console.error('Error reordering questions:', error);
    throw new Error(error.response?.data?.message || 'Failed to reorder questions');
  }
};

const QuestionManagement = ({ quiz, onBack }) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    action: null
  });
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);

  // Fetch questions for the quiz
  useEffect(() => {
    const fetchQuestions = async () => {
      if (!quiz || !quiz._id) return;

      try {
        setLoading(true);
        setError(null);

        const fetchedQuestions = await getQuizQuestions(quiz._id);
        console.log('Fetched questions:', fetchedQuestions);
        setQuestions(fetchedQuestions);
      } catch (err) {
        setError(err.message || 'Failed to fetch questions');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [quiz]);

  // Handle adding a new question
  const handleAddQuestion = () => {
    const newQuestion = {
      type: 'single-select',
      text: '',
      points: 1,
      options: [
        { text: '', isCorrect: true },
        { text: '', isCorrect: false }
      ],
      isNew: true // Flag to identify new questions
    };

    setQuestions([...questions, newQuestion]);
    setUnsavedChanges(true);
  };

  // Handle question change
  const handleQuestionChange = (updatedQuestion, index) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      ...updatedQuestion,
      modified: true // Flag to identify modified questions
    };

    setQuestions(updatedQuestions);
    setUnsavedChanges(true);
  };

  // Handle question delete
  const handleDeleteQuestion = (index) => {
    const questionToDelete = questions[index];

    // If it's a new question that hasn't been saved yet, just remove it
    if (questionToDelete.isNew) {
      const updatedQuestions = questions.filter((_, idx) => idx !== index);
      setQuestions(updatedQuestions);
      setUnsavedChanges(true);
      return;
    }

    // Otherwise, show confirmation dialog
    setConfirmDialog({
      open: true,
      title: 'Delete Question',
      message: 'Are you sure you want to delete this question? This action cannot be undone.',
      action: async () => {
        try {
          await deleteQuestion(quiz._id, questionToDelete._id);

          const updatedQuestions = questions.filter((_, idx) => idx !== index);
          setQuestions(updatedQuestions);

          setSuccess('Question deleted successfully');
          setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
          setError(err.message || 'Failed to delete question');
        } finally {
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      }
    });
  };

  // Handle question duplicate
  const handleDuplicateQuestion = (index) => {
    const questionToDuplicate = questions[index];

    // Create a copy of the question without the _id (so it becomes a new question)
    const duplicatedQuestion = {
      ...questionToDuplicate,
      _id: undefined, // Remove ID so it's treated as new
      isNew: true,
      text: `${questionToDuplicate.text} (Copy)`,
      // Deep copy options array
      options: questionToDuplicate.options ? questionToDuplicate.options.map(option => ({
        ...option,
        _id: undefined // Remove option IDs too
      })) : []
    };

    // Insert the duplicated question right after the original
    const updatedQuestions = [
      ...questions.slice(0, index + 1),
      duplicatedQuestion,
      ...questions.slice(index + 1)
    ];

    setQuestions(updatedQuestions);
    setUnsavedChanges(true);
    setSuccess('Question duplicated successfully');
    setTimeout(() => setSuccess(null), 3000);
  };

  // Handle saving all changes
  const handleSaveChanges = async () => {
    try {
      setSavingChanges(true);
      setError(null);

      // Process each question
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];

        // Skip questions that haven't been modified
        if (!question.isNew && !question.modified) continue;

        // Prepare question data
        const questionData = {
          type: question.type,
          text: question.text,
          timeLimit: question.timeLimit,
          points: question.points,
          options: question.options
        };

        // Add correctAnswer for free-text questions
        if (question.type === 'free-text' && question.correctAnswer) {
          questionData.correctAnswer = question.correctAnswer;
        }

        if (question.isNew) {
          // Add new question
          await addQuestion(quiz._id, questionData);
        } else {
          // Update existing question
          await updateQuestion(quiz._id, question._id, questionData);
        }
      }

      // Refresh questions after saving
      const updatedQuestions = await getQuizQuestions(quiz._id);
      setQuestions(updatedQuestions);

      setUnsavedChanges(false);
      setSuccess('All changes saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSavingChanges(false);
    }
  };

  // Handle question reordering
  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    // Reorder questions locally
    const reorderedQuestions = [...questions];
    const [removed] = reorderedQuestions.splice(sourceIndex, 1);
    reorderedQuestions.splice(destinationIndex, 0, removed);

    setQuestions(reorderedQuestions);
    setUnsavedChanges(true);

    // If all questions have IDs, we can reorder on the server
    const allHaveIds = reorderedQuestions.every(q => q._id);

    if (allHaveIds) {
      try {
        const questionIds = reorderedQuestions.map(q => q._id);
        await reorderQuestions(quiz._id, questionIds);
      } catch (err) {
        setError(err.message || 'Failed to reorder questions');
      }
    }
  };

  // Check if there are any validation errors
  const hasValidationErrors = () => {
    for (const question of questions) {
      // Check if question text is empty
      if (!question.text || !question.text.trim()) {
        console.log('Validation error: Empty question text', question);
        return true;
      }

      // For multiple choice questions, check options
      if (question.type !== 'free-text') {
        // Check if there are at least 2 options
        if (!question.options || question.options.length < 2) {
          console.log('Validation error: Less than 2 options', question);
          return true;
        }

        // Check if any option text is empty
        if (question.options.some(option => !option.text || !option.text.trim())) {
          console.log('Validation error: Empty option text', question);
          return true;
        }

        // For single-select, check if exactly one option is marked as correct
        if (question.type === 'single-select') {
          const correctOptions = question.options.filter(option => option.isCorrect);
          console.log(`Single-select question has ${correctOptions.length} correct options:`, question);
          if (correctOptions.length !== 1) {
            return true;
          }
        }

        // For multi-select, check if at least one option is marked as correct
        if (question.type === 'multi-select') {
          const correctOptions = question.options.filter(option => option.isCorrect);
          console.log(`Multi-select question has ${correctOptions.length} correct options:`, question);
          if (correctOptions.length < 1) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Handle back button with unsaved changes warning
  const handleBack = () => {
    if (unsavedChanges) {
      setConfirmDialog({
        open: true,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to go back without saving?',
        action: () => {
          setConfirmDialog(prev => ({ ...prev, open: false }));
          onBack();
        }
      });
    } else {
      onBack();
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={handleBack} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h2">
            Manage Questions: {quiz?.title}
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddQuestion}
            sx={{ mr: 1 }}
          >
            Add Question
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSaveChanges}
            disabled={!unsavedChanges || savingChanges || hasValidationErrors()}
          >
            Save Changes
          </Button>
        </Box>
      </Box>

      {/* Error and Success Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {/* Loading Indicator */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Questions List */}
          {questions.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                No questions added yet. Click "Add Question" to create your first question.
              </Typography>
            </Paper>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="questions">
                {(provided) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {questions.map((question, index) => (
                      <Draggable key={question._id || `new-${index}`} draggableId={question._id || `new-${index}`} index={index}>
                        {(provided) => (
                          <Box
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                              <Box
                                {...provided.dragHandleProps}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  p: 1,
                                  color: 'text.secondary',
                                  cursor: 'grab'
                                }}
                              >
                                <DragIndicator />
                              </Box>
                              <Box sx={{ flexGrow: 1 }}>
                                <QuestionTypeEditor
                                  question={question}
                                  onChange={handleQuestionChange}
                                  onDelete={handleDeleteQuestion}
                                  onDuplicate={handleDuplicateQuestion}
                                  index={index}
                                  quizTimingMode={quiz?.timingMode || 'total'}
                                />
                              </Box>
                            </Box>
                          </Box>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {/* Add Question Button (Bottom) */}
          {questions.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleAddQuestion}
              >
                Add Another Question
              </Button>
            </Box>
          )}

          {/* Unsaved Changes Warning */}
          {unsavedChanges && (
            <Alert severity="warning" sx={{ mt: 3 }}>
              You have unsaved changes. Please click "Save Changes" to save your work.
            </Alert>
          )}

          {/* Validation Errors Warning */}
          {hasValidationErrors() && unsavedChanges && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Please fix validation errors before saving. Check that all questions have text and all options are properly configured.
            </Alert>
          )}
        </>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </Box>
  );
};

export default QuestionManagement;