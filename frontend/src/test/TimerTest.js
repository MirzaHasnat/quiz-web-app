import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import TimerDisplay from '../components/TimerDisplay';
import TimerManagerService from '../services/timerManagerService';

/**
 * Test component to verify timer functionality
 */
const TimerTest = () => {
  const [timingMode, setTimingMode] = useState('total');
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState(60); // 1 minute
  const [overallTimeRemaining, setOverallTimeRemaining] = useState(600); // 10 minutes
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  
  // Mock quiz data
  const mockQuiz = {
    title: 'Test Quiz',
    duration: 5, // 5 minutes
    timingMode: timingMode,
    questions: [
      { _id: '1', timeLimit: 60, text: 'Question 1' },
      { _id: '2', timeLimit: 90, text: 'Question 2' },
      { _id: '3', timeLimit: 120, text: 'Question 3' }
    ]
  };
  
  // Timer manager reference
  const [timerManager, setTimerManager] = useState(null);
  
  useEffect(() => {
    if (timerManager) {
      timerManager.destroy();
    }
    
    const callbacks = {
      onTimeUpdate: (type, remaining, questionIndex) => {
        console.log(`[Test] Timer update: ${type}, remaining: ${remaining}s`);
        if (type === 'total') {
          setTimeRemaining(remaining);
        } else if (type === 'question') {
          setQuestionTimeRemaining(remaining);
        }
      },
      onTimeExpired: (type) => {
        console.log(`[Test] Timer expired: ${type}`);
        setIsRunning(false);
      },
      onQuestionTimeout: (questionIndex) => {
        console.log(`[Test] Question ${questionIndex + 1} timed out`);
        // Move to next question
        if (questionIndex + 1 < mockQuiz.questions.length) {
          setCurrentQuestionIndex(questionIndex + 1);
          setQuestionTimeRemaining(mockQuiz.questions[questionIndex + 1].timeLimit);
        }
      },
      onWarning: (type, remaining) => {
        console.log(`[Test] Warning: ${type} timer has ${remaining}s remaining`);
      },
      onCritical: (type, remaining) => {
        console.log(`[Test] Critical: ${type} timer has ${remaining}s remaining`);
      }
    };
    
    const newTimerManager = new TimerManagerService(
      timingMode,
      mockQuiz,
      { startTime: new Date() },
      callbacks
    );
    
    setTimerManager(newTimerManager);
    
    return () => {
      if (newTimerManager) {
        newTimerManager.destroy();
      }
    };
  }, [timingMode]);
  
  const handleStart = () => {
    if (timerManager && !isRunning) {
      setIsRunning(true);
      if (timingMode === 'total') {
        timerManager.start(timeRemaining);
      } else {
        timerManager.start(0, currentQuestionIndex);
      }
    }
  };
  
  const handleStop = () => {
    if (timerManager && isRunning) {
      setIsRunning(false);
      timerManager.stop();
    }
  };
  
  const handleModeChange = (mode) => {
    if (isRunning) {
      handleStop();
    }
    setTimingMode(mode);
    setCurrentQuestionIndex(0);
    setTimeRemaining(300);
    setQuestionTimeRemaining(60);
    setOverallTimeRemaining(600);
  };
  
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Timer Test Component
      </Typography>
      
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button 
          variant={timingMode === 'total' ? 'contained' : 'outlined'}
          onClick={() => handleModeChange('total')}
        >
          Total Mode
        </Button>
        <Button 
          variant={timingMode === 'per-question' ? 'contained' : 'outlined'}
          onClick={() => handleModeChange('per-question')}
        >
          Per-Question Mode
        </Button>
      </Box>
      
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button 
          variant="contained" 
          color="primary"
          onClick={handleStart}
          disabled={isRunning}
        >
          Start Timer
        </Button>
        <Button 
          variant="contained" 
          color="secondary"
          onClick={handleStop}
          disabled={!isRunning}
        >
          Stop Timer
        </Button>
      </Box>
      
      <Typography variant="h6" gutterBottom>
        Current Mode: {timingMode}
      </Typography>
      
      <Typography variant="body1" gutterBottom>
        Timer Status: {isRunning ? 'Running' : 'Stopped'}
      </Typography>
      
      {timingMode === 'per-question' && (
        <Typography variant="body1" gutterBottom>
          Current Question: {currentQuestionIndex + 1} / {mockQuiz.questions.length}
        </Typography>
      )}
      
      <Box sx={{ mt: 4 }}>
        <TimerDisplay
          timingMode={timingMode}
          // Total mode props
          totalTime={mockQuiz.duration * 60}
          remainingTime={timeRemaining}
          // Per-question mode props
          questionTimeLimit={mockQuiz.questions[currentQuestionIndex]?.timeLimit || 60}
          questionTimeRemaining={questionTimeRemaining}
          currentQuestionIndex={currentQuestionIndex}
          totalQuestions={mockQuiz.questions.length}
          overallTimeRemaining={overallTimeRemaining}
          overallTotalTime={mockQuiz.questions.reduce((total, q) => total + (q.timeLimit || 60), 0)}
        />
      </Box>
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>Debug Info:</Typography>
        <Typography variant="body2">Time Remaining: {timeRemaining}s</Typography>
        <Typography variant="body2">Question Time Remaining: {questionTimeRemaining}s</Typography>
        <Typography variant="body2">Overall Time Remaining: {overallTimeRemaining}s</Typography>
        <Typography variant="body2">Current Question Index: {currentQuestionIndex}</Typography>
        <Typography variant="body2">Timer Manager: {timerManager ? 'Initialized' : 'Not initialized'}</Typography>
      </Box>
    </Box>
  );
};

export default TimerTest;