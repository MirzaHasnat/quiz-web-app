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
import TimerDisplay from '../components/TimerDisplay';
import TimerManagerService from '../services/timerManagerService';
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
  
  // Timing state
  const [timingMode, setTimingMode] = useState('total');
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState(null);
  const [overallTimeRemaining, setOverallTimeRemaining] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [recordingIds, setRecordingIds] = useState(null);
  const [recordingRequirements, setRecordingRequirements] = useState(null);
  const [isResume, setIsResume] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [activityLogger, setActivityLogger] = useState(null);
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  const [attemptData, setAttemptData] = useState(null); // Store attempt data for timer calculations

  // Timer manager reference
  const timerManagerRef = useRef(null);

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
      setTimingMode(quizData.timingMode || 'total');

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
        const responseData = attemptResponse.data.data;
        
        // Handle the response structure properly
        const currentAttemptData = responseData.attempt || responseData;
        const timingData = responseData.timing || {};
        
        setAttemptData(currentAttemptData); // Store for timer calculations
        
        console.log(`[Quiz] Resume attempt data:`, {
          attemptId: currentAttemptData._id,
          status: currentAttemptData.status,
          answersCount: currentAttemptData.answers?.length || 0,
          timingMode: quizData.timingMode,
          remainingTime: timingData.remainingTime || currentAttemptData.remainingTime,
          startTime: currentAttemptData.startTime
        });

        // Set timing information based on timing mode
        if (quizData.timingMode === 'total') {
          // Use timing data from API response first, fallback to attempt data
          const remainingTime = timingData.remainingTime ?? currentAttemptData.remainingTime;
          console.log(`[Quiz] Setting total mode remainingTime: ${remainingTime}`);
          
          // Validate the remaining time
          if (typeof remainingTime === 'number' && remainingTime >= 0 && !isNaN(remainingTime)) {
            setTimeRemaining(remainingTime);
            console.log(`[Quiz] ✅ Using API provided remainingTime: ${remainingTime}s`);
          } else {
            // Fallback calculation if remainingTime is invalid
            const timeElapsed = (Date.now() - new Date(currentAttemptData.startTime).getTime()) / 1000;
            const totalTime = quizData.duration * 60;
            const calculatedRemaining = Math.max(0, totalTime - timeElapsed);
            console.log(`[Quiz] ⚠️ Invalid remainingTime, calculated: ${calculatedRemaining}s`);
            setTimeRemaining(calculatedRemaining);
          }
        } else if (quizData.timingMode === 'per-question') {
          // Use timing data from API response first
          const overallRemaining = timingData.remainingTime ?? (
            () => {
              // Fallback calculation
              const totalQuestionTime = quizData.questions?.reduce((total, q) => total + (q.timeLimit || 60), 0) || 0;
              const elapsedTime = (Date.now() - new Date(currentAttemptData.startTime).getTime()) / 1000;
              return Math.max(0, totalQuestionTime - elapsedTime);
            }
          )();
          
          console.log(`[Quiz] Setting per-question mode overallTimeRemaining: ${overallRemaining}s`);
          setOverallTimeRemaining(overallRemaining);
        }
          
        // Restore and LOCK answers, or handle fresh start
        if (currentAttemptData?.answers && currentAttemptData.answers.length > 0) {
          console.log(`[Quiz] 🔄 Restoring ${currentAttemptData.answers.length} existing answers`);
          const restoredAnswers = {};
          const locked = {};

          currentAttemptData.answers.forEach(answer => {
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

          // For per-question timing mode, calculate remaining time for current question
          if (quizData.timingMode === 'per-question') {
            // Use timing data from API response to get per-question timing
            let questionTimeRemaining = null;
            
            // Find which question we're on (first unlocked question)
            const currentQuestionIndex = questionInstances.findIndex(q => {
              const qId = q.id || q._id;
              return !locked[qId];
            });
            
            if (currentQuestionIndex >= 0 && currentQuestionIndex < questionInstances.length) {
              const currentQuestion = questionInstances[currentQuestionIndex];
              const questionId = currentQuestion.id || currentQuestion._id;
              const questionTimeLimit = currentQuestion.timeLimit || 60;
              
              // Check if we have stored timing data for this question
              if (timingData.questionTimeRemaining && timingData.questionTimeRemaining[questionId]) {
                // Use stored remaining time
                questionTimeRemaining = timingData.questionTimeRemaining[questionId];
                console.log(`[Quiz] Using stored remaining time for question ${currentQuestionIndex}: ${questionTimeRemaining}s`);
              } else if (timingData.questionTimeLimits) {
                // Look for this question in the timing limits data
                const questionTiming = timingData.questionTimeLimits.find(qt => qt.questionId.toString() === questionId.toString());
                if (questionTiming) {
                  questionTimeRemaining = questionTiming.timeRemaining;
                  console.log(`[Quiz] Using calculated remaining time for question ${currentQuestionIndex}: ${questionTimeRemaining}s`);
                }
              }
              
              // Fallback calculation if no stored data available
              if (questionTimeRemaining === null || questionTimeRemaining === undefined) {
                // Calculate based on overall elapsed time (fallback only)
                let timeUsedInPreviousQuestions = 0;
                for (let i = 0; i < currentQuestionIndex; i++) {
                  const prevQuestion = questionInstances[i];
                  timeUsedInPreviousQuestions += (prevQuestion.timeLimit || 60);
                }
                
                const totalElapsedTime = (Date.now() - new Date(currentAttemptData.startTime).getTime()) / 1000;
                const timeUsedInCurrentQuestion = Math.max(0, totalElapsedTime - timeUsedInPreviousQuestions);
                questionTimeRemaining = Math.max(0, questionTimeLimit - timeUsedInCurrentQuestion);
                console.log(`[Quiz] Fallback calculation for question ${currentQuestionIndex}: ${questionTimeRemaining}s`);
              }
              
              setQuestionTimeRemaining(questionTimeRemaining);
            } else {
              // Fallback for the first question
              const firstQuestion = questionInstances[0];
              if (firstQuestion) {
                const timeLimit = firstQuestion.timeLimit || 60;
                console.log(`[Quiz] Setting initial question time: ${timeLimit} seconds`);
                setQuestionTimeRemaining(timeLimit);
              }
            }
          }

          // ➤ Jump to first UNLOCKED question
          const firstUnansweredIndex = questionInstances.findIndex(q => {
            const qId = q.id || q._id;
            return !locked[qId];
          });
          
          console.log(`[Quiz] Question navigation analysis:`, {
            totalQuestions: questionInstances.length,
            answeredQuestions: Object.keys(locked).length,
            lockedQuestionIds: Object.keys(locked),
            firstUnansweredIndex: firstUnansweredIndex
          });

          // Determine the correct question index to resume at
          let newIndex;
          if (firstUnansweredIndex === -1) {
            // All questions are answered/locked
            console.log(`[Quiz] ℹ️ All questions are answered, staying at last question`);
            newIndex = questionInstances.length - 1;
          } else {
            // Found an unanswered question
            console.log(`[Quiz] ✅ Found first unanswered question at index: ${firstUnansweredIndex}`);
            newIndex = firstUnansweredIndex;
          }
          
          console.log(`[Quiz] Resuming at question index: ${newIndex} (Question ${newIndex + 1}/${questionInstances.length})`);
          setCurrentQuestionIndex(newIndex);

          // ➤ Set currentResponse for the target question if not locked
          if (newIndex < questionInstances.length) {
            const targetQ = questionInstances[newIndex];
            const targetQId = targetQ.id || targetQ._id;
            const existingResponse = restoredAnswers[targetQId];
            
            if (!locked[targetQId]) {
              setCurrentResponse(existingResponse || '');
              if (targetQ && existingResponse === undefined) {
                targetQ.setResponse('');
              }
            } else {
              // If somehow the target question is also locked, show its answer but disable editing
              setCurrentResponse(existingResponse || '');
            }
          }
        } else {
          // Fresh start - no previous answers
          console.log(`[Quiz] 🎆 Fresh start - no previous answers, starting at question 1`);
          
          // Ensure we have questions before setting index
          if (questionInstances.length > 0) {
            setCurrentQuestionIndex(0);
            setCurrentResponse('');
            
            // Initialize first question for per-question timing
            if (quizData.timingMode === 'per-question') {
              const firstQuestion = questionInstances[0];
              const timeLimit = firstQuestion.timeLimit || 60;
              console.log(`[Quiz] Setting initial question time: ${timeLimit} seconds`);
              setQuestionTimeRemaining(timeLimit);
            }
          } else {
            console.warn(`[Quiz] ⚠️ No questions found in quiz!`);
            setError('Quiz has no questions available.');
            return;
          }
        }

        // ✅ ✅ ✅ MOVE setIsResume HERE — inside try block, after setting time
        if (currentAttemptData.status === 'in-progress') {
          setIsResume(true);
        }

      } catch (attemptErr) {
        console.error('No existing attempt found or error fetching attempt:', attemptErr);
        // Set initial time based on timing mode
        if (quizData.timingMode === 'total') {
          const initialTime = quizData.duration * 60;
          console.log(`[Quiz] Setting initial total time: ${initialTime} seconds`);
          setTimeRemaining(initialTime);
        } else if (quizData.timingMode === 'per-question') {
          const totalQuestionTime = quizData.questions?.reduce((total, q) => total + (q.timeLimit || 60), 0) || 0;
          console.log(`[Quiz] Setting initial per-question total time: ${totalQuestionTime} seconds`);
          setOverallTimeRemaining(totalQuestionTime);
          
          // Set initial question time remaining
          const firstQuestion = questionInstances[0];
          if (firstQuestion) {
            const timeLimit = firstQuestion.timeLimit || 60;
            console.log(`[Quiz] Setting initial question time: ${timeLimit} seconds`);
            setQuestionTimeRemaining(timeLimit);
          }
        }
      }

      setLoading(false);
    } catch (err) {
      setError('Failed to load quiz data. Please try again later.');
      setLoading(false);
    }
  };

  fetchQuizData();
}, [quizId, attemptId]); // ✅ Dependencies correct

  // Initialize timer manager and start appropriate timer
  useEffect(() => {
    if (!quiz || !questions.length || submitting) return;
    
    // Clean up existing timer manager
    if (timerManagerRef.current) {
      timerManagerRef.current.destroy();
    }
    
    console.log(`[Quiz] Initializing timer manager for ${timingMode} mode`);
    console.log(`[Quiz] timeRemaining: ${timeRemaining}, questionTimeRemaining: ${questionTimeRemaining}`);
    
    // Create new timer manager with callbacks
    const timerCallbacks = {
      onTimeUpdate: (type, remaining, questionIndex) => {
        console.log(`[Timer] Update: ${type}, remaining: ${remaining}s`);
        if (type === 'total') {
          setTimeRemaining(remaining);
        } else if (type === 'question') {
          setQuestionTimeRemaining(remaining);
          
          // Save timing data for per-question mode
          if (timingMode === 'per-question' && questions[questionIndex]) {
            const currentQ = questions[questionIndex];
            const currentQId = currentQ?.id || currentQ?._id;
            if (currentQId) {
              // Debounce saves to avoid too frequent API calls
              clearTimeout(window.questionTimingSaveTimeout);
              window.questionTimingSaveTimeout = setTimeout(() => {
                saveQuestionTiming(currentQId, remaining);
              }, 1000);
            }
          }
          
          // Also update overall time remaining for per-question mode
          if (timingMode === 'per-question') {
            const currentQuestion = questions[questionIndex];
            if (currentQuestion) {
              // Calculate how much time has passed in total
              const totalQuestionTime = questions.reduce((total, q) => total + (q.timeLimit || 60), 0);
              const questionsPassed = questionIndex;
              const timeUsedInPreviousQuestions = questions.slice(0, questionsPassed).reduce((total, q) => total + (q.timeLimit || 60), 0);
              const timeUsedInCurrentQuestion = (currentQuestion.timeLimit || 60) - remaining;
              const totalTimeUsed = timeUsedInPreviousQuestions + timeUsedInCurrentQuestion;
              const overallRemaining = Math.max(0, totalQuestionTime - totalTimeUsed);
              setOverallTimeRemaining(overallRemaining);
            }
          }
        }
      },
      
      onTimeExpired: (type) => {
        console.log(`[Timer] ${type} timer expired`);
        handleTimeExpiration();
      },
      
      onQuestionTimeout: (questionIndex) => {
        console.log(`[Timer] Question ${questionIndex + 1} timed out`);
        handleQuestionTimeout();
      },
      
      onWarning: (type, remaining) => {
        console.log(`[Timer] Warning: ${type} timer has ${remaining}s remaining`);
        if (activityLogger) {
          activityLogger.logActivity('TIME_WARNING', `${type} timer warning: ${remaining}s remaining`);
        }
      },
      
      onCritical: (type, remaining) => {
        console.log(`[Timer] Critical: ${type} timer has ${remaining}s remaining`);
        if (activityLogger) {
          activityLogger.logActivity('TIME_CRITICAL', `${type} timer critical: ${remaining}s remaining`);
        }
      }
    };
    
    timerManagerRef.current = new TimerManagerService(
      timingMode,
      quiz,
      { startTime: new Date() }, // attempt info
      timerCallbacks
    );
    
    console.log(`[Quiz] Timer manager initialized for ${timingMode} mode`);
    
    return () => {
      if (timerManagerRef.current) {
        timerManagerRef.current.destroy();
      }
    };
  }, [quiz, questions, timingMode, submitting]); // Keep dependencies minimal
  
  // Handle timer start for TOTAL mode - with improved logic
  useEffect(() => {
    if (timingMode === 'total' && timerManagerRef.current && !submitting) {
      console.log(`[Timer] Checking total timer start conditions:`);
      console.log(`[Timer] - timeRemaining: ${timeRemaining}`);
      console.log(`[Timer] - timeRemaining type: ${typeof timeRemaining}`);
      console.log(`[Timer] - isRunning: ${timerManagerRef.current.getState().isRunning}`);
      
      // Enhanced validation with better error handling
      const isValidTimeRemaining = (
        timeRemaining !== null && 
        timeRemaining !== undefined && 
        typeof timeRemaining === 'number' && 
        !isNaN(timeRemaining) && 
        timeRemaining >= 0
      );
      
      if (isValidTimeRemaining) {
        const timerState = timerManagerRef.current.getState();
        if (!timerState.isRunning) {
          console.log(`[Timer] ✅ STARTING total timer with ${timeRemaining} seconds`);
          try {
            timerManagerRef.current.start(timeRemaining);
            console.log(`[Timer] ✅ Total timer started successfully`);
          } catch (error) {
            console.error(`[Timer] ❌ Error starting total timer:`, error);
            // Reset timeRemaining to quiz duration as fallback
            if (quiz?.duration) {
              const fallbackTime = quiz.duration * 60;
              console.log(`[Timer] 🔄 Falling back to quiz duration: ${fallbackTime} seconds`);
              setTimeRemaining(fallbackTime);
            }
          }
        } else {
          console.log(`[Timer] ℹ️ Total timer already running`);
        }
      } else {
        console.log(`[Timer] ❌ Cannot start total timer - invalid timeRemaining: ${timeRemaining}`);
        // If we have quiz data but invalid timeRemaining, reset it
        if (quiz?.duration && timeRemaining !== quiz.duration * 60) {
          const correctTime = quiz.duration * 60;
          console.log(`[Timer] 🔄 Resetting timeRemaining to correct value: ${correctTime} seconds`);
          setTimeRemaining(correctTime);
        }
      }
    }
  }, [timeRemaining, timingMode, submitting, quiz]);
  
  // Handle timer start for PER-QUESTION mode
  useEffect(() => {
    if (timingMode === 'per-question' && timerManagerRef.current && questions.length > 0 && !submitting) {
      console.log(`[Timer] Starting per-question timer for question ${currentQuestionIndex}`);
      
      const currentQuestion = questions[currentQuestionIndex];
      if (currentQuestion) {
        // Ensure question has a valid time limit
        const timeLimit = currentQuestion.timeLimit || 60; // Default to 60 seconds
        console.log(`[Timer] Question ${currentQuestionIndex} time limit: ${timeLimit} seconds`);
        
        // Use questionTimeRemaining if available, otherwise use full time limit
        const remainingTime = (typeof questionTimeRemaining === 'number' && questionTimeRemaining >= 0) ? questionTimeRemaining : timeLimit;
        console.log(`[Timer] Using remaining time: ${remainingTime} seconds`);
        
        // Validate and set question time remaining
        if (typeof remainingTime === 'number' && remainingTime >= 0) {
          setQuestionTimeRemaining(remainingTime);
          
          const timerState = timerManagerRef.current.getState();
          if (!timerState.isRunning) {
            console.log(`[Timer] ✅ STARTING per-question timer with ${remainingTime} seconds`);
            try {
              timerManagerRef.current.start(0, currentQuestionIndex, remainingTime);
              console.log(`[Timer] ✅ Per-question timer started successfully`);
            } catch (error) {
              console.error(`[Timer] ❌ Error starting per-question timer:`, error);
              // Fallback to default time
              setQuestionTimeRemaining(timeLimit);
            }
          }
        } else {
          console.warn(`[Timer] Invalid remaining time for question ${currentQuestionIndex}: ${remainingTime}`);
          setQuestionTimeRemaining(timeLimit); // Default fallback
        }
      }
    }
  }, [timingMode, currentQuestionIndex, questions, submitting, questionTimeRemaining]);
  
  // Handle question navigation for per-question mode
  useEffect(() => {
    if (timingMode === 'per-question' && timerManagerRef.current && !submitting) {
      // Calculate remaining time for the new question
      const currentQuestion = questions[currentQuestionIndex];
      if (currentQuestion) {
        const timeLimit = currentQuestion.timeLimit || 60;
        
        // If we have a specific questionTimeRemaining set, use it; otherwise use full time limit
        const remainingTime = (typeof questionTimeRemaining === 'number' && questionTimeRemaining >= 0) ? questionTimeRemaining : timeLimit;
        
        // Switch to the current question's timer with the correct remaining time
        timerManagerRef.current.switchToQuestion(currentQuestionIndex, remainingTime);
        
        // Update state
        setQuestionTimeRemaining(remainingTime);
        
        console.log(`[Timer] Switched to question ${currentQuestionIndex} with ${remainingTime}s remaining`);
      }
    }
  }, [currentQuestionIndex, timingMode, submitting, questionTimeRemaining]);
  
  // Periodically save question timing for per-question mode
  useEffect(() => {
    if (timingMode !== 'per-question' || submitting || !questions.length) return;
    
    const interval = setInterval(() => {
      const currentQ = questions[currentQuestionIndex];
      const currentQId = currentQ?.id || currentQ?._id;
      
      if (currentQId && typeof questionTimeRemaining === 'number' && questionTimeRemaining > 0) {
        // Save timing data every 5 seconds to maintain persistence
        saveQuestionTiming(currentQId, questionTimeRemaining);
      }
    }, 5000); // Save every 5 seconds
    
    return () => clearInterval(interval);
  }, [timingMode, submitting, questions, currentQuestionIndex, questionTimeRemaining]);

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
      
      // Set question time remaining for per-question mode
      if (timingMode === 'per-question' && nextQ && nextQ.timeLimit) {
        // For timeout navigation, start fresh with full time limit
        setQuestionTimeRemaining(nextQ.timeLimit);
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

  // Enhanced visibility change listener with better refresh detection
  useEffect(() => {
    let refreshDetected = false;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !submitting) {
        // User switched tabs or minimized browser
        if (activityLogger) {
          activityLogger.logActivity('TAB_HIDDEN', 'User switched tabs or minimized browser');
        }
        
        // Set a flag to detect if this was a refresh attempt
        refreshDetected = true;
        setTimeout(() => {
          refreshDetected = false; // Reset after 2 seconds
        }, 2000);
      } else if (document.visibilityState === 'visible' && refreshDetected && !submitting) {
        // Page became visible again after being hidden - likely a refresh attempt
        console.log('[Quiz] Potential refresh detected via visibility change');
        if (activityLogger) {
          activityLogger.logActivity('REFRESH_ATTEMPT', 'Page refresh attempt detected via visibility change');
        }
        setRefreshAttempted(true);
        // Give user a chance to see the warning, then handle refresh
        setTimeout(() => {
          if (!submitting) {
            handleForcedRefresh();
          }
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [submitting, activityLogger]);

  // Enhanced beforeunload handler with improved refresh detection
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!submitting) {
        console.log('[Quiz] Before unload event triggered - potential refresh or navigation');
        if (activityLogger) {
          activityLogger.logActivity('BEFORE_UNLOAD', 'User attempted to leave or refresh page');
        }
        
        setRefreshAttempted(true);
        
        // For modern browsers, setting returnValue triggers the confirmation dialog
        const message = 'Your quiz progress will be submitted if you leave this page. Are you sure?';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    const handleUnload = () => {
      if (!submitting) {
        console.log('[Quiz] Page unload detected - saving state');
        // Try to save current state before page unloads
        if (answers && Object.keys(answers).length > 0) {
          // Use sendBeacon for more reliable delivery
          navigator.sendBeacon && navigator.sendBeacon(
            `/api/attempts/save/${attemptId}`,
            JSON.stringify({ answers: Object.keys(answers).map(questionId => {
              const answer = answers[questionId];
              if (Array.isArray(answer)) {
                return { questionId, selectedOptions: answer, textAnswer: '' };
              } else if (typeof answer === 'string') {
                return { questionId, selectedOptions: [], textAnswer: answer };
              }
              return { questionId, selectedOptions: [], textAnswer: '' };
            })})
          );
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [submitting, answers, attemptId, activityLogger]);
  const formatTimeRemaining = () => {
    if (timingMode === 'total') {
      return TimerManagerService.formatTime(timeRemaining || 0, true);
    } else {
      return TimerManagerService.formatTime(overallTimeRemaining || 0, true);
    }
  };

  // Format per-question time
  const formatQuestionTimeRemaining = () => {
    return TimerManagerService.formatTime(questionTimeRemaining || 0, false);
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
  
  // Save question timing data for per-question mode
  const saveQuestionTiming = async (questionId, timeRemaining) => {
    if (timingMode !== 'per-question' || !attemptId) return;
    
    try {
      await axios.put(`/api/attempts/${attemptId}/question-timing`, {
        questionId: questionId.toString(),
        timeRemaining: Math.max(0, Math.floor(timeRemaining))
      });
      console.log(`[Frontend] Saved question ${questionId} timing: ${timeRemaining}s`);
    } catch (err) {
      console.error('Failed to save question timing:', err);
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
  const handleNextQuestion = async () => {
    const currentQ = questions[currentQuestionIndex];
    const currentQId = currentQ?.id || currentQ?._id;

    if (!currentQId) return;

    // Save current question timing data for per-question mode BEFORE moving
    if (timingMode === 'per-question' && typeof questionTimeRemaining === 'number') {
      await saveQuestionTiming(currentQId, questionTimeRemaining);
    }

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

    // ➡️ Now find next UNLOCKED question, skipping any locked ones
    let nextIndex = currentQuestionIndex + 1;
    while (nextIndex < questions.length) {
      const nextQ = questions[nextIndex];
      const nextQId = nextQ.id || nextQ._id;
      if (!lockedAnswers[nextQId]) break; // Found an unlocked question
      nextIndex++;
    }

    if (nextIndex < questions.length) {
      console.log(`[Navigation] Moving from question ${currentQuestionIndex + 1} to ${nextIndex + 1} (skipped ${nextIndex - currentQuestionIndex - 1} locked questions)`);
      
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
      
      // Set question time remaining for per-question mode
      if (timingMode === 'per-question' && nextQ) {
        const nextQId = nextQ.id || nextQ._id;
        const timeLimit = nextQ.timeLimit || 60;
        
        // First, try to get the remaining time from the stored timing data
        let nextQuestionTimeRemaining = timeLimit; // Default to full time limit
        
        // Check if we have timing data from the backend
        if (attemptData?.timing?.questionTimeRemaining && attemptData.timing.questionTimeRemaining[nextQId]) {
          nextQuestionTimeRemaining = attemptData.timing.questionTimeRemaining[nextQId];
          console.log(`[Navigation] Using stored timing for question ${nextIndex}: ${nextQuestionTimeRemaining}s`);
        } else {
          // This is likely a fresh question, use full time limit
          console.log(`[Navigation] Fresh question ${nextIndex}, using full time limit: ${timeLimit}s`);
          nextQuestionTimeRemaining = timeLimit;
        }
        
        setQuestionTimeRemaining(nextQuestionTimeRemaining);
        console.log(`[Navigation] Next question ${nextIndex} - limit: ${timeLimit}s, remaining: ${nextQuestionTimeRemaining}s`);
      }
    } else {
      console.log('[Navigation] No more unlocked questions available - reached end');
      // All remaining questions are locked, user is at the end
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
              <TimerDisplay
                timingMode={timingMode}
                // Total mode props
                totalTime={quiz?.duration ? quiz.duration * 60 : 0}
                remainingTime={timeRemaining}
                // Per-question mode props
                questionTimeLimit={questions[currentQuestionIndex]?.timeLimit || 60}
                questionTimeRemaining={questionTimeRemaining}
                currentQuestionIndex={currentQuestionIndex}
                totalQuestions={questions.length}
                overallTimeRemaining={overallTimeRemaining}
                overallTotalTime={quiz?.questions ? quiz.questions.reduce((total, q) => total + (q.timeLimit || 60), 0) : 0}
              />

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