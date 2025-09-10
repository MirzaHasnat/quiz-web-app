import React, { useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  IconButton,
  Chip,
  Tooltip,
  Box,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Badge
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ToggleOn as ActivateIcon,
  ToggleOff as DeactivateIcon,
  QuestionAnswer as QuestionsIcon,
  MoreVert as MoreVertIcon,
  People as UsersIcon
} from '@mui/icons-material';
import axios from '../../utils/axiosConfig';

// Quiz service functions
const toggleQuizActive = async (quizId, isActive) => {
  try {
    const response = await axios.put(`/api/quizzes/${quizId}`, { isActive });
    return response.data;
  } catch (error) {
    console.error(`Error ${isActive ? 'activating' : 'deactivating'} quiz:`, error);
    throw new Error(error.response?.data?.message || `Failed to ${isActive ? 'activate' : 'deactivate'} quiz`);
  }
};

const deleteQuiz = async (quizId) => {
  try {
    const response = await axios.delete(`/api/quizzes/${quizId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting quiz:', error);
    throw new Error(error.response?.data?.message || 'Failed to delete quiz');
  }
};

const QuizList = ({
  quizzes,
  pagination,
  sorting,
  onPageChange,
  onLimitChange,
  onSortChange,
  onEditQuiz,
  onQuizAction,
  onRefresh
}) => {
  const [actionMenu, setActionMenu] = useState({
    anchorEl: null,
    quiz: null
  });

  // Handle menu open
  const handleMenuOpen = (event, quiz) => {
    setActionMenu({
      anchorEl: event.currentTarget,
      quiz
    });
  };

  // Handle menu close
  const handleMenuClose = () => {
    setActionMenu({
      anchorEl: null,
      quiz: null
    });
  };

  // Handle toggle quiz active status
  const handleToggleActive = async (quiz) => {
    try {
      const newActiveStatus = !quiz.isActive;
      const action = newActiveStatus ? 'activate' : 'deactivate';
      
      // Call the onQuizAction to show confirmation dialog
      onQuizAction(action, quiz);
      
      // The actual toggle will be handled after confirmation
      handleMenuClose();
    } catch (error) {
      console.error('Error toggling quiz active status:', error);
      handleMenuClose();
    }
  };

  // Handle delete quiz
  const handleDelete = (quiz) => {
    onQuizAction('delete', quiz);
    handleMenuClose();
  };

  // Handle manage questions
  const handleManageQuestions = (quiz) => {
    // Navigate to question management
    onQuizAction('manage-questions', quiz);
    handleMenuClose();
  };

  // Handle manage users
  const handleManageUsers = (quiz) => {
    // This would navigate to a user activation page/view
    console.log('Manage users for quiz:', quiz._id);
    handleMenuClose();
  };

  // Confirm toggle active status
  const confirmToggleActive = async (quiz) => {
    try {
      const newActiveStatus = !quiz.isActive;
      await toggleQuizActive(quiz._id, newActiveStatus);
      onRefresh();
    } catch (error) {
      console.error('Error toggling quiz active status:', error);
    }
  };

  // Confirm delete quiz
  const confirmDelete = async (quiz) => {
    try {
      await deleteQuiz(quiz._id);
      onRefresh();
    } catch (error) {
      console.error('Error deleting quiz:', error);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      // Format: "Jan 1, 2023 2:30 PM"
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>
              <TableSortLabel
                active={sorting.sortBy === 'title'}
                direction={sorting.sortBy === 'title' ? sorting.sortOrder : 'asc'}
                onClick={() => onSortChange('title')}
              >
                Title
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sorting.sortBy === 'isActive'}
                direction={sorting.sortBy === 'isActive' ? sorting.sortOrder : 'asc'}
                onClick={() => onSortChange('isActive')}
              >
                Status
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel
                active={sorting.sortBy === 'duration'}
                direction={sorting.sortBy === 'duration' ? sorting.sortOrder : 'asc'}
                onClick={() => onSortChange('duration')}
              >
                Duration
              </TableSortLabel>
            </TableCell>
            <TableCell>Questions</TableCell>
            <TableCell>
              <TableSortLabel
                active={sorting.sortBy === 'createdAt'}
                direction={sorting.sortBy === 'createdAt' ? sorting.sortOrder : 'asc'}
                onClick={() => onSortChange('createdAt')}
              >
                Created
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {quizzes.length > 0 ? (
            quizzes.map((quiz) => (
              <TableRow key={quiz._id}>
                <TableCell>
                  <Typography variant="body1">{quiz.title}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {quiz.description.length > 60 
                      ? `${quiz.description.substring(0, 60)}...` 
                      : quiz.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={quiz.isActive ? 'Active' : 'Inactive'}
                    color={quiz.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{quiz.duration} min</TableCell>
                <TableCell>
                  <Badge 
                    badgeContent={quiz.questions ? quiz.questions.length : 0} 
                    color="primary"
                    showZero
                  >
                    <QuestionsIcon />
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(quiz.createdAt)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit Quiz">
                    <IconButton
                      size="small"
                      onClick={() => onEditQuiz(quiz)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, quiz)}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} align="center">
                <Box sx={{ py: 3 }}>
                  <Typography variant="body1" color="textSecondary">
                    No quizzes found
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={pagination.total}
        rowsPerPage={pagination.limit}
        page={pagination.page - 1}
        onPageChange={onPageChange}
        onRowsPerPageChange={onLimitChange}
      />

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenu.anchorEl}
        open={Boolean(actionMenu.anchorEl)}
        onClose={handleMenuClose}
      >
        {actionMenu.quiz && (
          <>
            <MenuItem onClick={() => handleToggleActive(actionMenu.quiz)}>
              <ListItemIcon>
                {actionMenu.quiz.isActive ? <DeactivateIcon fontSize="small" /> : <ActivateIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText>
                {actionMenu.quiz.isActive ? 'Deactivate Quiz' : 'Activate Quiz'}
              </ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleManageQuestions(actionMenu.quiz)}>
              <ListItemIcon>
                <QuestionsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Manage Questions</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleManageUsers(actionMenu.quiz)}>
              <ListItemIcon>
                <UsersIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Manage User Access</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleDelete(actionMenu.quiz)}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText sx={{ color: 'error.main' }}>Delete Quiz</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </TableContainer>
  );
};

export default QuizList;