import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  Stack,
  Divider,
  Avatar,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Stop as StopIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Quiz as QuizIcon,
  PlayArrow as PlayArrowIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import {
  getActivationMatrix,
  toggleQuizActivation,
  bulkQuizActivation,
  getActiveSessions,
  terminateUserSessions,
  terminateSession
} from '../../services/activationService';
import { useDebounce } from '../../hooks/useDebounce';

const QuizActivation = () => {
  const [activationData, setActivationData] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null
  });
  const [pagination, setPagination] = useState({
    page: 0,
    rowsPerPage: 10
  });

  // Debounce search term for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch activation matrix and active sessions on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [matrixResponse, sessionsResponse] = await Promise.all([
        getActivationMatrix(),
        getActiveSessions()
      ]);

      setActivationData(matrixResponse.data);
      setActiveSessions(sessionsResponse.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
      showSnackbar('Failed to fetch data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuizSelect = (quiz) => {
    setSelectedQuiz(selectedQuiz?.quizId === quiz.quizId ? null : quiz);
  };

  const handleToggleActivation = async (quizId, userId, currentStatus) => {
    try {
      await toggleQuizActivation(quizId, userId, !currentStatus);

      // Update local state
      setActivationData(prevData => {
        const updatedMatrix = prevData.activationMatrix.map(user => {
          if (user.userId === userId) {
            const updatedActivations = user.activations.map(quiz => {
              if (quiz.quizId === quizId) {
                return { ...quiz, isActivatedForUser: !currentStatus };
              }
              return quiz;
            });
            return { ...user, activations: updatedActivations };
          }
          return user;
        });

        return { ...prevData, activationMatrix: updatedMatrix };
      });

      showSnackbar(`Quiz ${!currentStatus ? 'activated' : 'deactivated'} successfully`, 'success');
    } catch (err) {
      showSnackbar(err.message || 'Failed to update activation status', 'error');
    }
  };

  const handleBulkActivation = async (quizId, activate) => {
    const users = getUsersForQuiz(quizId).filter(u => !u.isBlocked);
    const actionText = activate ? 'activate' : 'deactivate';

    setConfirmDialog({
      open: true,
      title: `${activate ? 'Activate' : 'Deactivate'} Quiz for All Users`,
      message: `Are you sure you want to ${actionText} this quiz for all ${users.length} active users?`,
      onConfirm: async () => {
        try {
          // Use efficient bulk activation API - single request instead of multiple
          await bulkQuizActivation(quizId, activate);

          // Update local state
          setActivationData(prevData => {
            const updatedMatrix = prevData.activationMatrix.map(user => {
              if (!user.isBlocked) {
                const updatedActivations = user.activations.map(quiz => {
                  if (quiz.quizId === quizId) {
                    return { ...quiz, isActivatedForUser: activate };
                  }
                  return quiz;
                });
                return { ...user, activations: updatedActivations };
              }
              return user;
            });

            return { ...prevData, activationMatrix: updatedMatrix };
          });

          showSnackbar(`Quiz ${actionText}d for all users successfully`, 'success');
        } catch (err) {
          showSnackbar(err.message || `Failed to ${actionText} quiz for all users`, 'error');
        } finally {
          setConfirmDialog({ open: false });
        }
      }
    });
  };

  const handleTerminateSession = async (attemptId) => {
    setConfirmDialog({
      open: true,
      title: 'Terminate Session',
      message: 'Are you sure you want to terminate this session? This will end the quiz attempt immediately.',
      onConfirm: async () => {
        try {
          await terminateSession(attemptId);

          // Update active sessions list
          setActiveSessions(prevSessions =>
            prevSessions.filter(session => session._id !== attemptId)
          );

          showSnackbar('Session terminated successfully', 'success');
        } catch (err) {
          showSnackbar(err.message || 'Failed to terminate session', 'error');
        } finally {
          setConfirmDialog({ open: false });
        }
      }
    });
  };

  const handleTerminateUserSessions = async (userId, username) => {
    setConfirmDialog({
      open: true,
      title: 'Terminate All User Sessions',
      message: `Are you sure you want to terminate all active sessions for ${username}? This will end all quiz attempts immediately.`,
      onConfirm: async () => {
        try {
          await terminateUserSessions(userId);

          // Update active sessions list
          setActiveSessions(prevSessions =>
            prevSessions.filter(session => session.userId._id !== userId)
          );

          showSnackbar(`All sessions for ${username} terminated successfully`, 'success');
        } catch (err) {
          showSnackbar(err.message || 'Failed to terminate user sessions', 'error');
        } finally {
          setConfirmDialog({ open: false });
        }
      }
    });
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleCloseDialog = () => {
    setConfirmDialog({ open: false });
  };

  const handleConfirmDialog = () => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm();
    }
    setConfirmDialog({ open: false });
  };

  // Helper functions
  const getFilteredQuizzes = () => {
    if (!activationData?.activationMatrix?.[0]?.activations) return [];

    let quizzes = activationData.activationMatrix[0].activations;

    // Use debounced search term for filtering
    if (debouncedSearchTerm.trim()) {
      quizzes = quizzes.filter(quiz =>
        quiz.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
    }

    return quizzes;
  };

  const getUsersForQuiz = (quizId) => {
    if (!activationData?.activationMatrix) return [];

    return activationData.activationMatrix.map(user => {
      const quizActivation = user.activations.find(q => q.quizId === quizId);
      return {
        ...user,
        quizActivation
      };
    }).filter(user => {
      // Use debounced search term for filtering users by username (text-based)
      if (!debouncedSearchTerm.trim()) return true;
      return user.username.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    });
  };

  const getQuizActiveSessions = (quizId) => {
    return activeSessions.filter(session => session.quizId._id === quizId);
  };

  const getQuizStats = (quizId) => {
    const users = getUsersForQuiz(quizId);
    const activatedCount = users.filter(u => u.quizActivation?.isActivatedForUser).length;
    const totalUsers = users.filter(u => !u.isBlocked).length;
    const sessions = getQuizActiveSessions(quizId);

    return {
      activatedCount,
      totalUsers,
      activeSessions: sessions.length
    };
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
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
            Quiz Access Control
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage user access to quizzes and monitor active sessions
          </Typography>
        </Box>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          onClick={fetchData}
          sx={{ height: 'fit-content' }}
        >
          Refresh
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label={selectedQuiz ? "Search Users by Name" : "Search Quizzes by Title"}
          placeholder={selectedQuiz ? "Type username to search..." : "Type quiz title to search..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          helperText={debouncedSearchTerm !== searchTerm ? "Searching..." : ""}
          sx={{ maxWidth: 400 }}
        />
      </Box>

      {activationData && activationData.activationMatrix.length > 0 ? (
        <Grid container spacing={3}>
          {/* Quizzes List */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: 'fit-content', maxHeight: '70vh', overflow: 'auto' }}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <QuizIcon />
                Quizzes ({getFilteredQuizzes().length})
              </Typography>
              <Stack spacing={1}>
                {getFilteredQuizzes().map(quiz => {
                  const stats = getQuizStats(quiz.quizId);
                  const isSelected = selectedQuiz?.quizId === quiz.quizId;

                  return (
                    <Card
                      key={quiz.quizId}
                      variant={isSelected ? "elevation" : "outlined"}
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        bgcolor: isSelected ? 'primary.50' : 'inherit',
                        borderColor: isSelected ? 'primary.main' : 'inherit',
                        '&:hover': {
                          bgcolor: isSelected ? 'primary.100' : 'grey.50',
                          transform: 'translateY(-1px)'
                        }
                      }}
                      onClick={() => handleQuizSelect(quiz)}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Badge
                              badgeContent={stats.activeSessions}
                              color="error"
                              invisible={stats.activeSessions === 0}
                            >
                              <Avatar sx={{ width: 32, height: 32, bgcolor: quiz.isActive ? 'success.main' : 'grey.500' }}>
                                <QuizIcon />
                              </Avatar>
                            </Badge>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {quiz.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {stats.activatedCount}/{stats.totalUsers} users activated
                              </Typography>
                            </Box>
                          </Box>
                          <Chip
                            label={quiz.isActive ? 'Active' : 'Inactive'}
                            color={quiz.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </Box>
                        {stats.activeSessions > 0 && (
                          <Typography variant="caption" color="error.main">
                            {stats.activeSessions} active session{stats.activeSessions > 1 ? 's' : ''}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Paper>
          </Grid>

          {/* User Access Panel */}
          <Grid item xs={12} md={8}>
            {selectedQuiz ? (
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Avatar sx={{ bgcolor: selectedQuiz.isActive ? 'success.main' : 'grey.500', width: 48, height: 48 }}>
                    <QuizIcon />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {selectedQuiz.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                      <Chip
                        label={selectedQuiz.isActive ? 'Quiz Active' : 'Quiz Inactive'}
                        color={selectedQuiz.isActive ? 'success' : 'default'}
                        size="small"
                      />
                      {(() => {
                        const stats = getQuizStats(selectedQuiz.quizId);
                        return (
                          <>
                            <Chip
                              label={`${stats.activatedCount}/${stats.totalUsers} Users`}
                              color="primary"
                              size="small"
                              icon={<GroupIcon />}
                            />
                            {stats.activeSessions > 0 && (
                              <Chip
                                label={`${stats.activeSessions} Active Sessions`}
                                color="warning"
                                size="small"
                                icon={<PlayArrowIcon />}
                              />
                            )}
                          </>
                        );
                      })()}
                    </Box>
                  </Box>
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Bulk Actions */}
                <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => handleBulkActivation(selectedQuiz.quizId, true)}
                    disabled={!selectedQuiz.isActive}
                  >
                    Activate for All Users
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<CancelIcon />}
                    onClick={() => handleBulkActivation(selectedQuiz.quizId, false)}
                  >
                    Deactivate for All Users
                  </Button>
                  {(() => {
                    const sessions = getQuizActiveSessions(selectedQuiz.quizId);
                    return sessions.length > 0 && (
                      <Button
                        variant="outlined"
                        color="warning"
                        startIcon={<StopIcon />}
                        onClick={() => {
                          setConfirmDialog({
                            open: true,
                            title: 'Terminate All Quiz Sessions',
                            message: `Are you sure you want to terminate all ${sessions.length} active sessions for this quiz?`,
                            onConfirm: async () => {
                              try {
                                const promises = sessions.map(session => terminateSession(session._id));
                                await Promise.all(promises);

                                setActiveSessions(prevSessions =>
                                  prevSessions.filter(session => session.quizId._id !== selectedQuiz.quizId)
                                );

                                showSnackbar('All quiz sessions terminated successfully', 'success');
                              } catch (err) {
                                showSnackbar(err.message || 'Failed to terminate quiz sessions', 'error');
                              } finally {
                                setConfirmDialog({ open: false });
                              }
                            }
                          });
                        }}
                      >
                        Terminate All Sessions ({sessions.length})
                      </Button>
                    );
                  })()}
                </Box>

                {/* User Access Controls */}
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon />
                  User Access ({getUsersForQuiz(selectedQuiz.quizId).length} users)
                </Typography>

                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>User</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Quiz Access</TableCell>
                        <TableCell>Active Sessions</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {getUsersForQuiz(selectedQuiz.quizId)
                        .slice(pagination.page * pagination.rowsPerPage, pagination.page * pagination.rowsPerPage + pagination.rowsPerPage)
                        .map(user => {
                          const userSessions = getQuizActiveSessions(selectedQuiz.quizId).filter(s => s.userId._id === user.userId);

                          return (
                            <TableRow key={user.userId} hover>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <Badge
                                    badgeContent={userSessions.length}
                                    color="error"
                                    invisible={userSessions.length === 0}
                                  >
                                    <Avatar sx={{ width: 32, height: 32, bgcolor: user.isBlocked ? 'error.main' : 'primary.main' }}>
                                      {user.isBlocked ? <BlockIcon /> : user.username.charAt(0).toUpperCase()}
                                    </Avatar>
                                  </Badge>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                    {user.username}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={user.isBlocked ? 'Blocked' : 'Active'}
                                  color={user.isBlocked ? 'error' : 'success'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Switch
                                    checked={user.quizActivation?.isActivatedForUser || false}
                                    onChange={() => handleToggleActivation(selectedQuiz.quizId, user.userId, user.quizActivation?.isActivatedForUser || false)}
                                    disabled={user.isBlocked || !selectedQuiz.isActive}
                                    color="primary"
                                    size="small"
                                  />
                                  <Typography variant="body2" color="text.secondary">
                                    {user.quizActivation?.isActivatedForUser ? 'Enabled' : 'Disabled'}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                {userSessions.length > 0 ? (
                                  <Box>
                                    <Chip
                                      label={`${userSessions.length} Session${userSessions.length > 1 ? 's' : ''}`}
                                      color="warning"
                                      size="small"
                                    />
                                    <Box sx={{ mt: 1 }}>
                                      {userSessions.map(session => {
                                        const duration = Math.floor((Date.now() - new Date(session.startTime)) / (1000 * 60));
                                        return (
                                          <Typography key={session._id} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                            Started {duration} min ago
                                          </Typography>
                                        );
                                      })}
                                    </Box>
                                  </Box>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No active sessions
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">
                                {userSessions.length > 0 && (
                                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                    {userSessions.map(session => (
                                      <Tooltip key={session._id} title="Terminate Session">
                                        <IconButton
                                          size="small"
                                          color="error"
                                          onClick={() => handleTerminateSession(session._id)}
                                        >
                                          <StopIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    ))}
                                    {userSessions.length > 1 && (
                                      <Tooltip title="Terminate All User Sessions">
                                        <IconButton
                                          size="small"
                                          color="error"
                                          onClick={() => handleTerminateUserSessions(user.userId, user.username)}
                                        >
                                          <BlockIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                  </Box>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      {getUsersForQuiz(selectedQuiz.quizId).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                              No users found
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={getUsersForQuiz(selectedQuiz.quizId).length}
                    rowsPerPage={pagination.rowsPerPage}
                    page={pagination.page}
                    onPageChange={(event, newPage) => setPagination(prev => ({ ...prev, page: newPage }))}
                    onRowsPerPageChange={(event) => setPagination({ page: 0, rowsPerPage: parseInt(event.target.value, 10) })}
                  />
                </TableContainer>
              </Paper>
            ) : (
              <Paper sx={{ p: 4, textAlign: 'center', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box>
                  <QuizIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                    Select a Quiz
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Choose a quiz from the list to manage user access and view active sessions
                  </Typography>
                </Box>
              </Paper>
            )}
          </Grid>
        </Grid>
      ) : (
        <Alert severity="info">No users or quizzes found.</Alert>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={handleCloseDialog}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmDialog.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDialog} color="error" autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default QuizActivation;