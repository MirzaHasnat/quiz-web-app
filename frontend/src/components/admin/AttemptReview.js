import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Checkbox
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Videocam as VideocamIcon,
  Undo as UndoIcon
} from '@mui/icons-material';
import { getAttempts, batchUpdateAttempts } from '../../services/attemptService';

const AttemptReview = () => {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    quizId: '',
    userId: '',
    status: '',
    startDate: '',
    endDate: ''
  });
  const [selectedAttempts, setSelectedAttempts] = useState([]);
  
  // Load attempts on component mount and when filters change
  useEffect(() => {
    fetchAttempts();
  }, [page, rowsPerPage]);

  const fetchAttempts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = {
        ...filters,
        page: page + 1, // API uses 1-based indexing
        limit: rowsPerPage
      };
      
      const response = await getAttempts(queryParams);
      setAttempts(response.data);
      setTotalCount(response.total);
      setLoading(false);
    } catch (err) {
      setError('Failed to load attempts. Please try again.');
      setLoading(false);
      console.error('Error fetching attempts:', err);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = () => {
    setPage(0);
    fetchAttempts();
  };

  const handleClearFilters = () => {
    setFilters({
      quizId: '',
      userId: '',
      status: '',
      startDate: '',
      endDate: ''
    });
    setPage(0);
  };

  const handleSelectAttempt = (attemptId) => {
    setSelectedAttempts(prev => {
      if (prev.includes(attemptId)) {
        return prev.filter(id => id !== attemptId);
      } else {
        return [...prev, attemptId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedAttempts.length === attempts.length) {
      setSelectedAttempts([]);
    } else {
      setSelectedAttempts(attempts.map(attempt => attempt._id));
    }
  };

  const handleBatchMarkReviewed = async () => {
    if (selectedAttempts.length === 0) return;
    
    try {
      setLoading(true);
      await batchUpdateAttempts(selectedAttempts, 'mark-reviewed');
      fetchAttempts();
      setSelectedAttempts([]);
    } catch (err) {
      setError('Failed to update attempts. Please try again.');
      console.error('Error updating attempts:', err);
      setLoading(false);
    }
  };

  const handleBatchUnreview = async () => {
    if (selectedAttempts.length === 0) return;
    
    try {
      setLoading(true);
      await batchUpdateAttempts(selectedAttempts, 'unreview');
      fetchAttempts();
      setSelectedAttempts([]);
    } catch (err) {
      setError('Failed to unreview attempts. Please try again.');
      console.error('Error unreviewing attempts:', err);
      setLoading(false);
    }
  };

  const handleIndividualUnreview = async (attemptId) => {
    try {
      setLoading(true);
      await batchUpdateAttempts([attemptId], 'unreview');
      fetchAttempts();
    } catch (err) {
      setError('Failed to unreview attempt. Please try again.');
      console.error('Error unreviewing attempt:', err);
      setLoading(false);
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

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Quiz Attempt Review
      </Typography>
      
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              name="quizId"
              label="Quiz ID"
              variant="outlined"
              fullWidth
              size="small"
              value={filters.quizId}
              onChange={handleFilterChange}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              name="userId"
              label="User ID"
              variant="outlined"
              fullWidth
              size="small"
              value={filters.userId}
              onChange={handleFilterChange}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={filters.status}
                label="Status"
                onChange={handleFilterChange}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="submitted">Submitted</MenuItem>
                <MenuItem value="reviewed">Reviewed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              name="startDate"
              label="Start Date"
              type="date"
              fullWidth
              size="small"
              value={filters.startDate}
              onChange={handleFilterChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              name="endDate"
              label="End Date"
              type="date"
              fullWidth
              size="small"
              value={filters.endDate}
              onChange={handleFilterChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              fullWidth
            >
              Search
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleClearFilters}
              fullWidth
            >
              Clear Filters
            </Button>
          </Grid>
          {selectedAttempts.length > 0 && (
            <>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleBatchMarkReviewed}
                  fullWidth
                >
                  Mark {selectedAttempts.length} as Reviewed
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={handleBatchUnreview}
                  fullWidth
                >
                  Unreview {selectedAttempts.length} Selected
                </Button>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>
      
      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* Attempts table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedAttempts.length > 0 && selectedAttempts.length < attempts.length}
                    checked={attempts.length > 0 && selectedAttempts.length === attempts.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Quiz</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Start Time</TableCell>
                <TableCell>End Time</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : attempts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No attempts found
                  </TableCell>
                </TableRow>
              ) : (
                attempts.map((attempt) => (
                  <TableRow key={attempt._id}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedAttempts.includes(attempt._id)}
                        onChange={() => handleSelectAttempt(attempt._id)}
                      />
                    </TableCell>
                    <TableCell>{attempt.quizId?.title || attempt.quizId}</TableCell>
                    <TableCell>{attempt.userId?.username || attempt.userId}</TableCell>
                    <TableCell>{formatDate(attempt.startTime)}</TableCell>
                    <TableCell>{formatDate(attempt.endTime)}</TableCell>
                    <TableCell>{getStatusChip(attempt.status)}</TableCell>
                    <TableCell>
                      {attempt.totalScore !== undefined ? (
                        <Box>
                          <Typography variant="body2">
                            {attempt.totalScore}/{attempt.maxScore}
                          </Typography>
                          {attempt.negativeMarkingApplied && (
                            <Typography variant="caption" color="text.secondary">
                              (+{attempt.answers?.reduce((total, answer) => total + (answer.score || 0), 0) || 0} 
                              -{attempt.answers?.reduce((total, answer) => total + (answer.negativeScore || 0), 0) || 0})
                            </Typography>
                          )}
                        </Box>
                      ) : 'Not available'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton 
                          color="primary"
                          component={Link}
                          to={`/admin/attempts/${attempt._id}`}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      {attempt.status === 'submitted' && (
                        <Tooltip title="Review">
                          <IconButton 
                            color="secondary"
                            component={Link}
                            to={`/admin/attempts/${attempt._id}/review`}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {attempt.status === 'reviewed' && (
                        <Tooltip title="Unreview (Mark as Submitted)">
                          <IconButton 
                            color="warning"
                            onClick={() => handleIndividualUnreview(attempt._id)}
                            disabled={loading}
                          >
                            <UndoIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {attempt.status !== 'in-progress' && (
                        <Tooltip title="View Recordings">
                          <IconButton 
                            color="primary"
                            component={Link}
                            to={`/admin/attempts/${attempt._id}?tab=recordings`}
                          >
                            <VideocamIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
};

export default AttemptReview;