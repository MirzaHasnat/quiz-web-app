import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { keyframes } from '@emotion/react';

// Define the spin animation for the refresh icon

import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Snackbar,
  AppBar,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Paper,
  Divider,
  Chip,
  Tooltip,
  Fade
} from '@mui/material';
import {
  ExitToApp,
  Timer as TimerIcon,
  QuestionAnswer as QuestionIcon,
  Info as InfoIcon,
  PlayArrow as StartIcon,
  PlayCircleFilled as ResumeIcon,
  CheckCircle as CompletedIcon,
  Cancel as ExpiredIcon,
  SentimentDissatisfied as EmptyIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from '../utils/axiosConfig';

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const UserDashboard = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [quizStatuses, setQuizStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const { currentUser, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Check for access denied message from ProtectedRoute
  useEffect(() => {
    if (location.state?.accessDenied) {
      setNotification({
        message: location.state.message || 'Access denied',
        severity: 'warning'
      });

      // Clear the location state to prevent showing the message again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const fetchQuizzes = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);
      const response = await axios.get('/api/quizzes');
      const quizzesData = response.data.data || [];
      setQuizzes(quizzesData);

      // Fetch attempt status for each quiz
      const statusPromises = quizzesData.map(async (quiz) => {
        try {
          const statusResponse = await axios.get(`/api/attempts/check/${quiz._id}`);
          return {
            quizId: quiz._id,
            status: statusResponse.data.data
          };
        } catch (err) {
          console.error(`Error fetching status for quiz ${quiz._id}:`, err);
          return {
            quizId: quiz._id,
            status: { canStart: true, canResume: false, attemptStatus: null }
          };
        }
      });

      const statuses = await Promise.all(statusPromises);
      const statusMap = {};
      statuses.forEach(({ quizId, status }) => {
        statusMap[quizId] = status;
      });
      setQuizStatuses(statusMap);

      if (isRefreshing) {
        setNotification({
          message: 'Quiz list refreshed successfully',
          severity: 'success'
        });
      }
    } catch (err) {
      console.error('Error fetching quizzes:', err);
      setError('Failed to load quizzes. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchQuizzes(true);
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleQuizSelect = (quizId) => {
    navigate(`/quiz/${quizId}`);
  };

  const handleViewResults = (quizId) => {
    navigate(`/quiz/${quizId}/results`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCloseNotification = () => {
    setNotification(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress size={60} thickness={4} />
        <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
          Loading Your Quizzes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please wait while we fetch your available quizzes...
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Quiz Web App
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body1" sx={{ mr: 2 }}>
              {currentUser?.username}
            </Typography>
            <IconButton
              size="large"
              edge="end"
              color="inherit"
              aria-label="account menu"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenuOpen}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                {currentUser?.username?.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={handleLogout}>
                <ExitToApp fontSize="small" sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 4,
              borderRadius: 2,
              background: 'linear-gradient(45deg, #f3e5f5 30%, #e8eaf6 90%)',
              border: '1px solid #e1bee7'
            }}
          >
            <Typography variant="h4" component="h1" gutterBottom>
              Welcome, {currentUser?.username}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Your personalized dashboard shows all quizzes that have been activated for you.
              Select a quiz to begin your assessment.
            </Typography>
          </Paper>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" component="h2">
              Available Quizzes
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Tooltip title="Refresh quiz list">
                <IconButton
                  onClick={handleRefresh}
                  disabled={refreshing}
                  size="small"
                  color="primary"
                  sx={{ mr: 1 }}
                >
                  <RefreshIcon sx={{ animation: refreshing ? `${spin} 1s linear infinite` : 'none' }} />
                </IconButton>
              </Tooltip>
              <Chip
                label={`${quizzes.length} ${quizzes.length === 1 ? 'Quiz' : 'Quizzes'} Available`}
                color="primary"
                variant="outlined"
                size="small"
              />
            </Box>
          </Box>

          <Divider sx={{ mb: 4 }} />

          {quizzes.length === 0 ? (
            <Paper
              elevation={2}
              sx={{
                p: 4,
                borderRadius: 2,
                textAlign: 'center',
                backgroundColor: '#f5f5f5'
              }}
            >
              <EmptyIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No Quizzes Available
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                You don't have any quizzes activated for your account at the moment.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please contact your administrator if you believe this is an error.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {quizzes.map((quiz) => (
                <Grid item xs={12} sm={6} md={4} key={quiz._id || quiz.id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)'
                      }
                    }}
                  >
                    <Box
                      sx={{
                        height: 8,
                        backgroundColor: 'primary.main',
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8
                      }}
                    />
                    <CardContent sx={{ flexGrow: 1, pt: 3 }}>
                      <Typography variant="h6" component="div" gutterBottom>
                        {quiz.title}
                      </Typography>

                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <TimerIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                          {quiz.duration} minutes
                        </Typography>
                      </Box>

                      {quiz.questions && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <QuestionIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            {quiz.questions.length} {quiz.questions.length === 1 ? 'question' : 'questions'}
                          </Typography>
                        </Box>
                      )}

                      <Divider sx={{ my: 2 }} />

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {quiz.description}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Tooltip title={quiz.showResultsImmediately ? "Results shown immediately" : "Results after review"}>
                          <Chip
                            size="small"
                            label={quiz.showResultsImmediately ? "Instant Results" : "Manual Review"}
                            color={quiz.showResultsImmediately ? "success" : "info"}
                            variant="outlined"
                          />
                        </Tooltip>
                      </Box>
                    </CardContent>

                    <CardActions sx={{ p: 2, pt: 0 }}>
                      {(() => {
                        const status = quizStatuses[quiz._id];

                        if (!status) {
                          return (
                            <Button
                              fullWidth
                              variant="contained"
                              color="primary"
                              onClick={() => handleQuizSelect(quiz._id || quiz.id)}
                              startIcon={<StartIcon />}
                              sx={{ borderRadius: 2 }}
                            >
                              Start Quiz
                            </Button>
                          );
                        }

                        if (status.attemptStatus === 'submitted' || status.attemptStatus === 'reviewed') {
                          return (
                            <Button
                              fullWidth
                              variant="contained"
                              color="success"
                              onClick={() => handleViewResults(quiz._id || quiz.id)}
                              startIcon={<CompletedIcon />}
                              sx={{ borderRadius: 2 }}
                            >
                              View Results
                            </Button>
                          );
                        }

                        if (status.attemptStatus === 'time_up') {
                          return (
                            <Button
                              fullWidth
                              variant="outlined"
                              color="warning"
                              disabled
                              startIcon={<ExpiredIcon />}
                              sx={{ borderRadius: 2 }}
                            >
                              Time Up
                            </Button>
                          );
                        }

                        if (status.attemptStatus === 'expired') {
                          return (
                            <Button
                              fullWidth
                              variant="outlined"
                              color="error"
                              disabled
                              startIcon={<ExpiredIcon />}
                              sx={{ borderRadius: 2 }}
                            >
                              Expired
                            </Button>
                          );
                        }

                        if (status.canResume) {
                          return (
                            <Button
                              fullWidth
                              variant="contained"
                              color="warning"
                              onClick={() => handleQuizSelect(quiz._id || quiz.id)}
                              startIcon={<ResumeIcon />}
                              sx={{ borderRadius: 2 }}
                            >
                              Resume Quiz
                            </Button>
                          );
                        }

                        if (status.canStart) {
                          return (
                            <Button
                              fullWidth
                              variant="contained"
                              color="primary"
                              onClick={() => handleQuizSelect(quiz._id || quiz.id)}
                              startIcon={<StartIcon />}
                              sx={{ borderRadius: 2 }}
                            >
                              Start Quiz
                            </Button>
                          );
                        }

                        return (
                          <Button
                            fullWidth
                            variant="outlined"
                            disabled
                            sx={{ borderRadius: 2 }}
                          >
                            Not Available
                          </Button>
                        );
                      })()}
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Container>

      {notification && (
        <Snackbar
          open={!!notification}
          autoHideDuration={6000}
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleCloseNotification}
            severity={notification.severity || 'info'}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      )}
    </>
  );
};

export default UserDashboard;