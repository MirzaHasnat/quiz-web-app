import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import axios from '../../utils/axiosConfig';
import QuizList from './QuizList';
import QuizFormDialog from './QuizFormDialog';
import ConfirmDialog from './ConfirmDialog';
import QuestionManagement from './QuestionManagement';
import { useDebounce } from '../../hooks/useDebounce';

// Quiz service functions
const getQuizzes = async (params) => {
  try {
    const response = await axios.get('/api/quizzes', { params });
    
    return {
      data: response.data.data,
      pagination: {
        page: parseInt(params.page) || 1,
        limit: parseInt(params.limit) || 10,
        total: response.data.count,
        pages: Math.ceil(response.data.count / (parseInt(params.limit) || 10))
      }
    };
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch quizzes');
  }
};

const getQuizStats = async () => {
  try {
    const response = await axios.get('/api/quizzes');
    const quizzes = response.data.data;
    
    // Calculate stats
    const total = quizzes.length;
    const active = quizzes.filter(quiz => quiz.isActive).length;
    const inactive = total - active;
    const withQuestions = quizzes.filter(quiz => quiz.questions && quiz.questions.length > 0).length;
    
    return {
      data: {
        total,
        active,
        inactive,
        withQuestions
      }
    };
  } catch (error) {
    console.error('Error fetching quiz statistics:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch quiz statistics');
  }
};

const QuizManagement = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    isActive: ''
  });
  
  // Debounce search term for API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [sorting, setSorting] = useState({
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    withQuestions: 0
  });
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    action: null
  });
  const [showQuestionManagement, setShowQuestionManagement] = useState(false);
  const [selectedQuizForQuestions, setSelectedQuizForQuestions] = useState(null);

  // Fetch quizzes with current filters, pagination, and sorting
  const fetchQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: sorting.sortBy,
        sortOrder: sorting.sortOrder
      };
      
      // Add debounced search term if present (text-based search)
      if (debouncedSearchTerm.trim()) {
        params.search = debouncedSearchTerm.trim();
      }
      
      // Add filters if present
      if (filters.isActive !== '') {
        params.isActive = filters.isActive;
      }
      
      const response = await getQuizzes(params);
      setQuizzes(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err.message || 'Failed to fetch quizzes');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, sorting.sortBy, sorting.sortOrder, debouncedSearchTerm, filters]);

  // Fetch quiz statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await getQuizStats();
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch quiz statistics:', err);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchQuizzes();
    fetchStats();
  }, [fetchQuizzes, fetchStats]);

  // Handle search - immediate UI update, debounced API call
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Reset pagination when debounced search term changes
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [debouncedSearchTerm]);

  // Handle filter change
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on filter change
  };

  // Handle sort change
  const handleSortChange = (sortBy) => {
    setSorting(prev => ({
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Handle page change
  const handlePageChange = (event, newPage) => {
    setPagination(prev => ({ ...prev, page: newPage + 1 }));
  };

  // Handle rows per page change
  const handleLimitChange = (event) => {
    setPagination(prev => ({
      ...prev,
      limit: parseInt(event.target.value, 10),
      page: 1
    }));
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchQuizzes();
    fetchStats();
  };

  // Handle add quiz
  const handleAddQuiz = () => {
    setSelectedQuiz(null);
    setOpenDialog(true);
  };

  // Handle edit quiz
  const handleEditQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setOpenDialog(true);
  };

  // Handle dialog close
  const handleDialogClose = (refresh = false) => {
    setOpenDialog(false);
    if (refresh) {
      fetchQuizzes();
      fetchStats();
    }
  };

  // Handle quiz action (activate/deactivate, delete, manage questions)
  const handleQuizAction = (action, quiz) => {
    switch (action) {
      case 'activate':
        setConfirmDialog({
          open: true,
          title: 'Activate Quiz',
          message: `Are you sure you want to activate "${quiz.title}"? This will make it available for assignment to users.`,
          action: async () => {
            try {
              await axios.put(`/api/quizzes/${quiz._id}`, { isActive: true });
              setConfirmDialog(prev => ({ ...prev, open: false }));
              fetchQuizzes();
              fetchStats();
            } catch (error) {
              console.error('Error activating quiz:', error);
              setError(error.response?.data?.message || 'Failed to activate quiz');
              setConfirmDialog(prev => ({ ...prev, open: false }));
            }
          }
        });
        break;
      case 'deactivate':
        setConfirmDialog({
          open: true,
          title: 'Deactivate Quiz',
          message: `Are you sure you want to deactivate "${quiz.title}"? This will make it unavailable for all users.`,
          action: async () => {
            try {
              await axios.put(`/api/quizzes/${quiz._id}`, { isActive: false });
              setConfirmDialog(prev => ({ ...prev, open: false }));
              fetchQuizzes();
              fetchStats();
            } catch (error) {
              console.error('Error deactivating quiz:', error);
              setError(error.response?.data?.message || 'Failed to deactivate quiz');
              setConfirmDialog(prev => ({ ...prev, open: false }));
            }
          }
        });
        break;
      case 'delete':
        setConfirmDialog({
          open: true,
          title: 'Delete Quiz',
          message: `Are you sure you want to delete "${quiz.title}"? This action cannot be undone and will remove all associated data.`,
          action: async () => {
            try {
              await axios.delete(`/api/quizzes/${quiz._id}`);
              setConfirmDialog(prev => ({ ...prev, open: false }));
              fetchQuizzes();
              fetchStats();
            } catch (error) {
              console.error('Error deleting quiz:', error);
              setError(error.response?.data?.message || 'Failed to delete quiz');
              setConfirmDialog(prev => ({ ...prev, open: false }));
            }
          }
        });
        break;
      case 'manage-questions':
        // Show question management interface for this quiz
        setSelectedQuizForQuestions(quiz);
        setShowQuestionManagement(true);
        break;
      default:
        break;
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setFilters({
      isActive: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle back from question management
  const handleBackFromQuestionManagement = () => {
    setShowQuestionManagement(false);
    setSelectedQuizForQuestions(null);
    // Refresh quizzes to get updated question counts
    fetchQuizzes();
    fetchStats();
  };

  return (
    <Box>
      {showQuestionManagement && selectedQuizForQuestions ? (
        <QuestionManagement 
          quiz={selectedQuizForQuestions} 
          onBack={handleBackFromQuestionManagement} 
        />
      ) : (
        <>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" component="h2">
              Quiz Management
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddQuiz}
            >
              Create Quiz
            </Button>
          </Box>

          {/* Stats Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="subtitle2" color="textSecondary">Total Quizzes</Typography>
                <Typography variant="h4">{stats.total}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="subtitle2" color="textSecondary">Active Quizzes</Typography>
                <Typography variant="h4">{stats.active}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="subtitle2" color="textSecondary">Inactive Quizzes</Typography>
                <Typography variant="h4">{stats.inactive}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="subtitle2" color="textSecondary">With Questions</Typography>
                <Typography variant="h4">{stats.withQuestions}</Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Search and Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Search Quizzes by Title"
                  placeholder="Type quiz title to search..."
                  variant="outlined"
                  value={searchTerm}
                  onChange={handleSearch}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    )
                  }}
                  helperText={loading && debouncedSearchTerm !== searchTerm ? "Searching..." : ""}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="isActive"
                    value={filters.isActive}
                    onChange={handleFilterChange}
                    label="Status"
                  >
                    <MenuItem value="">All Status</MenuItem>
                    <MenuItem value="true">Active</MenuItem>
                    <MenuItem value="false">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={handleRefresh}
                  sx={{ mr: 1 }}
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<FilterListIcon />}
                  onClick={resetFilters}
                >
                  Reset
                </Button>
              </Grid>
            </Grid>

            {/* Active Filters */}
            {(searchTerm || filters.isActive !== '') && (
              <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" color="textSecondary" sx={{ mr: 1, alignSelf: 'center' }}>
                  Active Filters:
                </Typography>
                {searchTerm && (
                  <Chip
                    label={`Search: ${searchTerm}`}
                    onDelete={() => setSearchTerm('')}
                    size="small"
                  />
                )}
                {filters.isActive !== '' && (
                  <Chip
                    label={`Status: ${filters.isActive === 'true' ? 'Active' : 'Inactive'}`}
                    onDelete={() => setFilters(prev => ({ ...prev, isActive: '' }))}
                    size="small"
                  />
                )}
              </Box>
            )}
          </Paper>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Quiz List */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <QuizList
              quizzes={quizzes}
              pagination={pagination}
              sorting={sorting}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              onSortChange={handleSortChange}
              onEditQuiz={handleEditQuiz}
              onQuizAction={handleQuizAction}
              onRefresh={handleRefresh}
            />
          )}

          {/* Quiz Form Dialog */}
          <QuizFormDialog
            open={openDialog}
            quiz={selectedQuiz}
            onClose={handleDialogClose}
          />

          {/* Confirmation Dialog */}
          <ConfirmDialog
            open={confirmDialog.open}
            title={confirmDialog.title}
            message={confirmDialog.message}
            onConfirm={confirmDialog.action}
            onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
          />
        </>
      )}
    </Box>
  );
};

export default QuizManagement;