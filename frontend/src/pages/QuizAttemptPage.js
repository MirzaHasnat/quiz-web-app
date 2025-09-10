import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Stepper,
  Step,
  StepLabel,
  LinearProgress
} from '@mui/material';
import axios from '../utils/axiosConfig';
import RecordingStatusIndicator from '../components/RecordingStatusIndicator';
import RecordingErrorHandler from '../components/RecordingErrorHandler';
import RecordingMonitor from '../components/RecordingMonitor';
import QuestionFactory from '../components/questions/QuestionFactory';
import QuizSubmission from '../components/QuizSubmission';
import { Question } from '../models/Question';
import ActivityLogger from '../services/activityLogger';
import RecordingDebugInfo from '../components/RecordingDebugInfo';

const QuizAttemptPage = () => {
  const { quizId, attemptId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [lockedAnswers, setLockedAnswers] = useState({});
  const [currentResponse, setCurrentResponse] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(null); // Global quiz time
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState(0); // Per-question time
  const [submitting, setSubmitting] = useState(false);
  const [recordingIds, setRecordingIds] = useState(null);
  const [recordingRequirements, setRecordingRequirements] = useState(null);
  const [isResume, setIsResume] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [activityLogger, setActivityLogger] = useState(null);
  const [refreshAttempted, setRefreshAttempted] = useState(false);

  // Refs to manage timers
  const globalTimerRef = useRef(null);
  const questionTimerRef = useRef(null);

  // Get recording IDs and resume status from location state
  useEffect(() => {
    if (location.state?.recordingIds) {
      setRecordingIds(location.state.recordingIds);
    }
    if (location.state?.isResume) {
      setIsResume(true);
    }

    if (!location.state?.recordingIds) {
      console.log('No recording IDs provided through navigation, but recording should be active from permissions');
      setRecordingIds({
        screen: 'active-screen-recording',
        cameraAudio: 'active-camera-audio-recording'
      });
    }
  }, [location]);

  // Initialize activity logger
  useEffect(() => {
    if (attemptId) {
      const logger = new ActivityLogger(attemptId);
      logger.startLogging();
      setActivityLogger(logger);

      return () => {
        if (logger) {
          logger.stopLogging();
        }
      };
    }
  }, [attemptId]);

  // Cleanup recordings only when leaving quiz
  useEffect(() => {
    let isQuizActive = true;

    const handleBeforeUnload = async (event) => {
      if (isQuizActive) {
        try {
          console.log('Browser/tab is being closed, stopping recordings...');
          const { stopAllRecordings, disconnectAllMediaDevices } = await import('../services/recordingService');
          await stopAllRecordings();
          disconnectAllMediaDevices();
        } catch (error) {
          console.error('Error stopping recordings on page unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (isQuizActive && !submitting) {
        console.log('QuizAttemptPage unmounting, but keeping recordings active for quiz continuation');
      }
      isQuizActive = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [submitting]);

  // Fetch quiz and questions, handle resume
// Fetch quiz and questions, handle resume
useEffect(() => {
  const fetchQuizData = async () => {
    try {
      const quizResponse = await axios.get(`/api/quizzes/${quizId}`);
      const quizData = quizResponse.data.data;
      setQuiz(quizData);

      const recordingResponse = await axios.get(`/api/quizzes/${quizId}/recording-requirements`);
      setRecordingRequirements(recordingResponse.data.data.recordingRequirements);

      const questionsResponse = await axios.get(`/api/quizzes/${quizId}/questions`);
      const questionsData = questionsResponse.data.data;

      const questionInstances = questionsData.map(questionData =>
        Question.fromData(questionData)
      );

      setQuestions(questionInstances);

      // Always check for existing attempt
      try {
        const attemptResponse = await axios.get(`/api/attempts/${attemptId}`);
        const attemptData = attemptResponse.data.data;

        // ✅ SET REMAINING TIME FROM SERVER
        setTimeRemaining(attemptData.remainingTime);

        // Restore and LOCK answers
        if (attemptData?.answers && attemptData.answers.length > 0) {
          const restoredAnswers = {};
          const locked = {};

          attemptData.answers.forEach(answer => {
            if (answer.selectedOptions && answer.selectedOptions.length > 0) {
              restoredAnswers[answer.questionId] = answer.selectedOptions.length === 1
                ? answer.selectedOptions[0]
                : answer.selectedOptions;
              locked[answer.questionId] = true;
            } else if (answer.textAnswer) {
              restoredAnswers[answer.questionId] = answer.textAnswer;
              locked[answer.questionId] = true;
            }
          });

          setAnswers(restoredAnswers);
          setLockedAnswers(locked);

          questionInstances.forEach(question => {
            const questionId = question.id || question._id;
            if (restoredAnswers[questionId]) {
              question.setResponse(restoredAnswers[questionId]);
            }
          });

          // ➤ Jump to first UNLOCKED question
          const firstUnansweredIndex = questionInstances.findIndex(q => {
            const qId = q.id || q._id;
            return !locked[qId];
          });

          const newIndex = firstUnansweredIndex === -1 ? questionInstances.length - 1 : firstUnansweredIndex;
          setCurrentQuestionIndex(newIndex);

          // ➤ Set currentResponse for first question if not locked
          if (newIndex < questionInstances.length) {
            const firstQ = questionInstances[newIndex];
            const firstQId = firstQ.id || firstQ._id;
            const existingResponse = restoredAnswers[firstQId];
            setCurrentResponse(existingResponse || '');
            if (firstQ && existingResponse === undefined) {
              firstQ.setResponse('');
            }
          }
        }

        // ✅ ✅ ✅ MOVE setIsResume HERE — inside try block, after setting time
        if (attemptData.status === 'in-progress') {
          setIsResume(true);
        }

      } catch (attemptErr) {
        console.error('No existing attempt found or error fetching attempt:', attemptErr);
        // ✅ Only set full duration if NO existing attempt
        setTimeRemaining(quizData.duration * 60);
      }

      setLoading(false);
    } catch (err) {
      setError('Failed to load quiz data. Please try again later.');
      setLoading(false);
    }
  };

  fetchQuizData();
}, [quizId, attemptId]); // ✅ Dependencies correct

  // Calculate and start per-question timer when currentQuestionIndex changes
// Calculate and start per-question timer when currentQuestionIndex changes
useEffect(() => {
  if (!questions.length || !timeRemaining) return;

  // Clear previous question timer
  if (questionTimerRef.current) {
    clearInterval(questionTimerRef.current);
  }

  const totalQuestions = questions.length;
  const perQuestionTime = Math.floor(timeRemaining / totalQuestions);

  setQuestionTimeRemaining(perQuestionTime);

  // DEBUG: Log timer start
  console.log(`[Timer] Starting Q${currentQuestionIndex + 1} with ${perQuestionTime}s (global: ${timeRemaining}s)`);

  // Start per-question countdown
  questionTimerRef.current = setInterval(() => {
    setQuestionTimeRemaining(prev => {
      if (prev <= 1) {
        clearInterval(questionTimerRef.current);
        handleQuestionTimeout();
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => {
    if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current);
    }
  };
}, [currentQuestionIndex, questions.length]); // ✅ timeRemaining REMOVED from dependencies

  // Handle per-question timeout
  const handleQuestionTimeout = () => {
    const currentQ = questions[currentQuestionIndex];
    const currentQId = currentQ?.id || currentQ?._id;

    if (!currentQId) return;

    // If user has entered something, lock and save it
    if (currentResponse !== '' && currentResponse !== null && currentResponse !== undefined) {
      if (!lockedAnswers[currentQId]) {
        setLockedAnswers(prev => ({ ...prev, [currentQId]: true }));
        setAnswers(prev => ({
          ...prev,
          [currentQId]: currentResponse
        }));

        if (activityLogger) {
          activityLogger.logAnswerChange(currentQId, answers[currentQId], currentResponse);
        }

        // Auto-save to backend
        autoSaveAnswers({
          ...answers,
          [currentQId]: currentResponse
        });
      }
    }

    // ➡️ Move to next UNLOCKED question
    let nextIndex = currentQuestionIndex + 1;
    while (nextIndex < questions.length) {
      const nextQ = questions[nextIndex];
      const nextQId = nextQ.id || nextQ._id;
      if (!lockedAnswers[nextQId]) break;
      nextIndex++;
    }

    if (nextIndex < questions.length) {
      if (activityLogger) {
        activityLogger.logNavigation(currentQuestionIndex + 1, nextIndex + 1, 'next');
      }
      setCurrentQuestionIndex(nextIndex);

      // Reset currentResponse for new question
      const nextQ = questions[nextIndex];
      const nextQId = nextQ.id || nextQ._id;
      const existingAnswer = answers[nextQId];
      setCurrentResponse(existingAnswer || '');
      if (nextQ && existingAnswer === undefined) {
        nextQ.setResponse('');
      }
    }
  };

  // Handle global time expiration (quiz-level)
  const handleTimeExpiration = async () => {
    try {
      setSubmitting(true);
      setError('Time expired! Your quiz is being submitted automatically.');

      const { stopAllRecordings, uploadAllRecordings } = await import('../services/recordingService');
      const recordingBlobs = await stopAllRecordings();

      const formattedAnswers = Object.keys(answers).map(questionId => {
        const answer = answers[questionId];
        if (Array.isArray(answer)) {
          return { questionId, selectedOptions: answer, textAnswer: '' };
        } else if (typeof answer === 'string') {
          const question = questions.find(q => (q.id || q._id) === questionId);
          if (question && question.type === 'free-text') {
            return { questionId, selectedOptions: [], textAnswer: answer };
          } else {
            return { questionId, selectedOptions: [answer], textAnswer: '' };
          }
        }
        return { questionId, selectedOptions: [], textAnswer: '' };
      });

      await axios.put(`/api/attempts/submit/${quizId}/${attemptId}`, {
        answers: formattedAnswers,
        timeExpired: true
      });

      await uploadAllRecordings(recordingBlobs);

      const { disconnectAllMediaDevices } = await import('../services/recordingService');
      disconnectAllMediaDevices();

      setTimeout(() => {
        navigate('/dashboard', {
          state: {
            message: 'Quiz time expired. Your answers have been submitted automatically.',
            severity: 'warning'
          }
        });
      }, 3000);

    } catch (err) {
      console.error('Error submitting expired quiz:', err);
      setTimeout(() => {
        navigate('/dashboard', {
          state: {
            message: 'Quiz time expired. There was an error submitting your answers.',
            severity: 'error'
          }
        });
      }, 3000);
    }
  };

  // Global quiz timer countdown
  useEffect(() => {
    if (!timeRemaining || timeRemaining <= 0) return;

    if (globalTimerRef.current) {
      clearInterval(globalTimerRef.current);
    }

    globalTimerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(globalTimerRef.current);
          handleTimeExpiration();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (globalTimerRef.current) {
        clearInterval(globalTimerRef.current);
      }
    };
  }, [timeRemaining, navigate, answers, questions, quizId, attemptId]);

  // Handle forced refresh
  const handleForcedRefresh = async () => {
    try {
      setSubmitting(true);
      setError('Page refresh detected! Your quiz is being submitted automatically with current progress.');

      const { stopAllRecordings, uploadAllRecordings } = await import('../services/recordingService');
      const recordingBlobs = await stopAllRecordings();

      const formattedAnswers = Object.keys(answers).map(questionId => {
        const answer = answers[questionId];
        if (Array.isArray(answer)) {
          return { questionId, selectedOptions: answer, textAnswer: '' };
        } else if (typeof answer === 'string') {
          const question = questions.find(q => (q.id || q._id) === questionId);
          if (question && question.type === 'free-text') {
            return { questionId, selectedOptions: [], textAnswer: answer };
          } else {
            return { questionId, selectedOptions: [answer], textAnswer: '' };
          }
        }
        return { questionId, selectedOptions: [], textAnswer: '' };
      });

      await axios.put(`/api/attempts/submit/${quizId}/${attemptId}`, {
        answers: formattedAnswers,
        forcedRefresh: true
      });

      await uploadAllRecordings(recordingBlobs);

      const { disconnectAllMediaDevices } = await import('../services/recordingService');
      disconnectAllMediaDevices();

      setTimeout(() => {
        navigate('/dashboard', {
          state: {
            message: 'Quiz was submitted due to page refresh attempt.',
            severity: 'warning'
          }
        });
      }, 3000);

    } catch (err) {
      console.error('Error submitting quiz due to refresh:', err);
      setTimeout(() => {
        navigate('/dashboard', {
          state: {
            message: 'There was an error submitting your quiz after refresh attempt.',
            severity: 'error'
          }
        });
      }, 3000);
    }
  };

  // Visibility change listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !submitting) {
        if (activityLogger) {
          activityLogger.logActivity('TAB_HIDDEN', 'User switched tabs or minimized browser');
        }
      } else if (document.visibilityState === 'visible' && refreshAttempted) {
        handleForcedRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshAttempted, submitting]);

  // Beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!submitting) {
        setRefreshAttempted(true);
        e.preventDefault();
        e.returnValue = 'Your answers are final once submitted. Leaving may auto-submit your quiz.';
        return 'Your answers are final once submitted. Leaving may auto-submit your quiz.';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [submitting]);

  // Format time remaining (global)
  const formatTimeRemaining = () => {
    if (!timeRemaining) return '00:00:00';
    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    const seconds = Math.floor(timeRemaining % 60);
    return [hours, minutes, seconds].map(v => v.toString().padStart(2, '0')).join(':');
  };

  // Format per-question time
  const formatQuestionTimeRemaining = () => {
    if (!questionTimeRemaining) return '00:00';
    const minutes = Math.floor(questionTimeRemaining / 60);
    const seconds = Math.floor(questionTimeRemaining % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Auto-save functionality (only called manually after locking)
  const autoSaveAnswers = async (currentAnswers) => {
    if (!attemptId || autoSaving) return;
    try {
      setAutoSaving(true);
      const formattedAnswers = Object.keys(currentAnswers).map(questionId => {
        const answer = currentAnswers[questionId];
        if (Array.isArray(answer)) {
          return { questionId, selectedOptions: answer, textAnswer: '' };
        } else if (typeof answer === 'string') {
          const question = questions.find(q => (q.id || q._id) === questionId);
          if (question && question.type === 'free-text') {
            return { questionId, selectedOptions: [], textAnswer: answer };
          } else {
            return { questionId, selectedOptions: [answer], textAnswer: '' };
          }
        }
        return { questionId, selectedOptions: [], textAnswer: '' };
      });

      await axios.put(`/api/attempts/save/${attemptId}`, { answers: formattedAnswers });
      console.log('Answers auto-saved successfully');
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setAutoSaving(false);
    }
  };

  // Handle response change — store in local state, NOT locked yet
  const handleResponseChange = (questionId, response) => {
    const currentQuestionId = questions[currentQuestionIndex]?.id || questions[currentQuestionIndex]?._id;
    if (questionId !== currentQuestionId) return;

    setCurrentResponse(response);

    const questionIndex = questions.findIndex(q => q.id === questionId || q._id === questionId);
    if (questionIndex !== -1) {
      questions[questionIndex].setResponse(response);
    }
  };

  // Handle “Next” — lock, save, advance
  const handleNextQuestion = () => {
    const currentQ = questions[currentQuestionIndex];
    const currentQId = currentQ?.id || currentQ?._id;

    if (!currentQId) return;

    // If not locked yet, lock and save it
    if (!lockedAnswers[currentQId]) {
      setLockedAnswers(prev => ({ ...prev, [currentQId]: true }));
      setAnswers(prev => ({
        ...prev,
        [currentQId]: currentResponse
      }));

      if (activityLogger) {
        activityLogger.logAnswerChange(currentQId, answers[currentQId], currentResponse);
      }

      autoSaveAnswers({
        ...answers,
        [currentQId]: currentResponse
      });
    }

    // ➡️ Now find next UNLOCKED question
    let nextIndex = currentQuestionIndex + 1;
    while (nextIndex < questions.length) {
      const nextQ = questions[nextIndex];
      const nextQId = nextQ.id || nextQ._id;
      if (!lockedAnswers[nextQId]) break;
      nextIndex++;
    }

    if (nextIndex < questions.length) {
      if (activityLogger) {
        activityLogger.logNavigation(currentQuestionIndex + 1, nextIndex + 1, 'next');
      }
      setCurrentQuestionIndex(nextIndex);

      const nextQ = questions[nextIndex];
      const nextQId = nextQ.id || nextQ._id;
      const existingAnswer = answers[nextQId];
      setCurrentResponse(existingAnswer || '');
      if (nextQ && existingAnswer === undefined) {
        nextQ.setResponse('');
      }
    }
  };

  // Handle recording restart
  const handleRecordingRestart = (newRecordingIds) => {
    setRecordingIds(newRecordingIds);
    if (activityLogger) {
      activityLogger.logActivity('RECORDING_RESTART', 'Recording was restarted during quiz', { newRecordingIds });
    }
  };

  // Handle recording failure
  const handleRecordingFailure = (error) => {
    if (activityLogger) {
      activityLogger.logActivity('RECORDING_FAILURE', 'Recording failed during quiz', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    console.error('Recording failed:', error);
  };

  // Handle recording error
  const handleRecordingError = (errors) => {
    console.error('Recording errors detected:', errors);
  };

  // Handle retry recording
  const handleRetryRecording = () => {
    console.log('Attempting to restart recordings');
  };

  // Handle cancel quiz due to recording error
  const handleCancelQuiz = () => {
    navigate('/dashboard', {
      state: {
        message: 'Quiz was cancelled due to recording errors. Please contact your administrator.'
      }
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Box sx={{ my: 4 }}>
          <Alert severity="error">{error}</Alert>
          <Button variant="contained" onClick={() => navigate('/dashboard')} sx={{ mt: 2 }}>
            Back to Dashboard
          </Button>
        </Box>
      </Container>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentQuestionId = currentQuestion?.id || currentQuestion?._id;
  const isCurrentQuestionLocked = lockedAnswers[currentQuestionId];

  return (
    <Container maxWidth="lg">
      {refreshAttempted && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Refresh attempt detected! Your quiz will be submitted automatically with current progress.
        </Alert>
      )}

      <RecordingErrorHandler
        onError={handleRecordingError}
        onRetry={handleRetryRecording}
        onCancel={handleCancelQuiz}
      />

      <Box sx={{ my: 4 }}>
        {process.env.NODE_ENV === 'development' && <RecordingDebugInfo />}

        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" component="h1">
              {quiz?.title}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Quiz Time:
              </Typography>
              <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
                {formatTimeRemaining()}
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Question Time:
              </Typography>
              <Typography variant="h6" sx={{ fontFamily: 'monospace', color: questionTimeRemaining <= 10 ? 'error.main' : 'inherit' }}>
                {formatQuestionTimeRemaining()}
              </Typography>

              {recordingIds && (
                <>
                  <RecordingStatusIndicator
                    recordingIds={recordingIds}
                    recordingRequirements={recordingRequirements}
                  />
                  <RecordingMonitor
                    recordingIds={recordingIds}
                    attemptId={attemptId}
                    onRecordingRestart={handleRecordingRestart}
                    onRecordingFailure={handleRecordingFailure}
                  />
                </>
              )}
            </Box>
          </Box>

          <LinearProgress
            variant="determinate"
            value={(currentQuestionIndex + 1) / questions.length * 100}
            sx={{ mb: 2 }}
          />

          <Box sx={{ mb: 3 }}>
            <Stepper activeStep={currentQuestionIndex} alternativeLabel>
              {questions.map((question, index) => {
                const qId = question.id || question._id;
                const isLocked = lockedAnswers[qId];
                return (
                  <Step key={qId} completed={!!answers[qId]} disabled={isLocked}>
                    <StepLabel
                      onClick={(e) => {
                        e.preventDefault();
                        return false;
                      }}
                    >
                      Q{index + 1}
                    </StepLabel>
                  </Step>
                );
              })}
            </Stepper>
          </Box>

          {questions.length === 0 ? (
            <Alert severity="warning" sx={{ mb: 3 }}>
              This quiz has no questions. Please contact your administrator.
            </Alert>
          ) : currentQuestion ? (
            <QuestionFactory
              question={currentQuestion}
              onResponseChange={handleResponseChange}
              isLocked={isCurrentQuestionLocked}
            />
          ) : (
            <Alert severity="info" sx={{ mb: 3 }}>
              Loading question...
            </Alert>
          )}

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            {currentQuestionIndex < questions.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleNextQuestion}
                disabled={submitting || isCurrentQuestionLocked}
              >
                Next (Locks your answer)
              </Button>
            ) : (
              <QuizSubmission
                quizId={quizId}
                attemptId={attemptId}
                questions={questions}
                answers={answers}
                disabled={submitting}
              />
            )}
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default QuizAttemptPage;