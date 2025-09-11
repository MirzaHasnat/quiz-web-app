import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  Paper,
  Alert,
  Card,
  CardContent,
  Fade,
  useTheme,
  Badge
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  Warning as WarningIcon,
  Timer as TimerIcon,
  Schedule as ScheduleIcon,
  Alarm as AlarmIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon
} from '@mui/icons-material';
import { keyframes, styled } from '@mui/system';
import TimingService from '../services/timingService';

// Define pulse animation for critical state
const pulse = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.7);
  }
  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(244, 67, 54, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0);
  }
`;

// Define glow animation for warning state
const glow = keyframes`
  0% {
    box-shadow: 0 0 5px rgba(255, 193, 7, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 193, 7, 0.8), 0 0 30px rgba(255, 193, 7, 0.6);
  }
  100% {
    box-shadow: 0 0 5px rgba(255, 193, 7, 0.5);
  }
`;

// Define smooth counting animation
const digitFlip = keyframes`
  0% {
    transform: rotateX(0deg);
  }
  50% {
    transform: rotateX(-90deg);
  }
  100% {
    transform: rotateX(0deg);
  }
`;

// Styled components for enhanced design
const StyledTimerCard = styled(Card)(({ theme, variant = 'default' }) => ({
  background: variant === 'critical'
    ? 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 50%, #ef9a9a 100%)'
    : variant === 'warning'
    ? 'linear-gradient(135deg, #fff8e1 0%, #ffecb3 50%, #fff176 100%)'
    : 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #64b5f6 100%)',
  borderRadius: 16,
  overflow: 'hidden',
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: variant === 'critical'
      ? 'radial-gradient(circle at 30% 30%, rgba(244, 67, 54, 0.1), transparent 70%)'
      : variant === 'warning'
      ? 'radial-gradient(circle at 30% 30%, rgba(255, 193, 7, 0.1), transparent 70%)'
      : 'radial-gradient(circle at 30% 30%, rgba(33, 150, 243, 0.1), transparent 70%)',
    pointerEvents: 'none'
  },
  animation: variant === 'critical' ? `${pulse} 2s infinite` : variant === 'warning' ? `${glow} 2.5s infinite` : 'none',
  transform: 'translateZ(0)', // Force hardware acceleration
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
}));

const StyledTimeDisplay = styled(Typography)(({ theme, variant = 'default' }) => ({
  fontFamily: '"Roboto Mono", "Monaco", "Consolas", monospace',
  fontWeight: 800,
  background: variant === 'critical'
    ? 'linear-gradient(45deg, #d32f2f, #f44336)'
    : variant === 'warning'
    ? 'linear-gradient(45deg, #f57c00, #ff9800)'
    : 'linear-gradient(45deg, #1976d2, #2196f3)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  textShadow: variant === 'critical'
    ? '2px 2px 4px rgba(244, 67, 54, 0.3)'
    : variant === 'warning'
    ? '2px 2px 4px rgba(255, 152, 0, 0.3)'
    : '2px 2px 4px rgba(33, 150, 243, 0.3)',
  letterSpacing: '0.1em',
  position: 'relative',
  '&::after': {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100%',
    height: '2px',
    background: variant === 'critical'
      ? 'rgba(244, 67, 54, 0.2)'
      : variant === 'warning'
      ? 'rgba(255, 152, 0, 0.2)'
      : 'rgba(33, 150, 243, 0.2)',
    borderRadius: '1px'
  }
}));

const IconWrapper = styled(Box)(({ theme, variant = 'default' }) => ({
  width: 48,
  height: 48,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: variant === 'critical'
    ? 'linear-gradient(135deg, #f44336, #d32f2f)'
    : variant === 'warning'
    ? 'linear-gradient(135deg, #ff9800, #f57c00)'
    : 'linear-gradient(135deg, #2196f3, #1976d2)',
  color: 'white',
  boxShadow: variant === 'critical'
    ? '0 4px 20px rgba(244, 67, 54, 0.4)'
    : variant === 'warning'
    ? '0 4px 20px rgba(255, 152, 0, 0.4)'
    : '0 4px 20px rgba(33, 150, 243, 0.4)',
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: '-2px',
    borderRadius: '50%',
    background: variant === 'critical'
      ? 'conic-gradient(from 0deg, #f44336, #d32f2f, #f44336)'
      : variant === 'warning'
      ? 'conic-gradient(from 0deg, #ff9800, #f57c00, #ff9800)'
      : 'conic-gradient(from 0deg, #2196f3, #1976d2, #2196f3)',
    zIndex: -1,
    animation: variant !== 'default' ? 'spin 3s linear infinite' : 'none'
  },
  '@keyframes spin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' }
  }
}));

/**
 * Timer Display Component for Total Quiz Duration Mode
 * Shows overall quiz progress and remaining time in a single horizontal line
 */
const TotalTimerDisplay = ({ 
  totalTime, 
  remainingTime, 
  isWarning = false, 
  isCritical = false,
  showProgress = true 
}) => {
  const theme = useTheme();
  
  // Validate and sanitize inputs
  const validTotalTime = (typeof totalTime === 'number' && !isNaN(totalTime) && totalTime > 0) ? totalTime : 0;
  const validRemainingTime = (typeof remainingTime === 'number' && !isNaN(remainingTime) && remainingTime >= 0) ? remainingTime : 0;
  
  const elapsedTime = validTotalTime - validRemainingTime;
  const progressPercent = validTotalTime > 0 ? (elapsedTime / validTotalTime) * 100 : 0;
  
  const getColor = () => {
    if (isCritical) return theme.palette.error.main;
    if (isWarning) return theme.palette.warning.main;
    return theme.palette.primary.main;
  };

  return (
    <Paper 
      elevation={1}
      sx={{ 
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 0.8,
        borderRadius: 3,
        background: isCritical
          ? 'linear-gradient(90deg, #ffebee, #ffcdd2)'
          : isWarning
          ? 'linear-gradient(90deg, #fff8e1, #ffecb3)'
          : 'linear-gradient(90deg, #e3f2fd, #bbdefb)',
        animation: isCritical ? `${pulse} 2s infinite` : isWarning ? `${glow} 2.5s infinite` : 'none',
        minWidth: 300,
        maxWidth: 400
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: getColor(),
          color: 'white',
          flexShrink: 0
        }}
      >
        {isCritical ? <AlarmIcon sx={{ fontSize: 14 }} /> : <ScheduleIcon sx={{ fontSize: 14 }} />}
      </Box>
      
      {/* Timer text */}
      <Typography 
        variant="body2" 
        sx={{ 
          fontFamily: '"Roboto Mono", monospace',
          fontWeight: 600,
          color: getColor(),
          fontSize: '0.9rem',
          flexShrink: 0
        }}
      >
        {TimingService.formatTimeWithHours(validRemainingTime)}
      </Typography>
      
      {/* Progress bar */}
      {showProgress && (
        <Box sx={{ flex: 1, minWidth: 80 }}>
          <LinearProgress 
            variant="determinate" 
            value={Math.min(100, progressPercent)}
            sx={{ 
              height: 4, 
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.5)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 2,
                bgcolor: getColor()
              }
            }}
          />
        </Box>
      )}
      
      {/* Status */}
      <Typography 
        variant="caption" 
        sx={{ 
          color: 'text.secondary',
          fontSize: '0.7rem',
          flexShrink: 0
        }}
      >
        {Math.round(progressPercent)}%
      </Typography>
      
      {/* Warning icon */}
      {(isWarning || isCritical) && (
        <WarningIcon 
          sx={{ 
            color: getColor(),
            fontSize: 16,
            flexShrink: 0
          }} 
        />
      )}
    </Paper>
  );
};

/**
 * Timer Display Component for Per-Question Duration Mode
 * Shows only current question timer (overall timer removed per requirements)
 */
const QuestionTimerDisplay = ({ 
  questionTimeLimit,
  questionTimeRemaining,
  currentQuestionIndex,
  totalQuestions,
  isWarning = false,
  isCritical = false
}) => {
  const theme = useTheme();
  
  // Validate and sanitize inputs
  const validQuestionTimeLimit = (typeof questionTimeLimit === 'number' && !isNaN(questionTimeLimit) && questionTimeLimit > 0) ? questionTimeLimit : 60;
  const validQuestionTimeRemaining = (typeof questionTimeRemaining === 'number' && !isNaN(questionTimeRemaining) && questionTimeRemaining >= 0) ? questionTimeRemaining : validQuestionTimeLimit;
  const validCurrentQuestionIndex = (typeof currentQuestionIndex === 'number' && !isNaN(currentQuestionIndex) && currentQuestionIndex >= 0) ? currentQuestionIndex : 0;
  const validTotalQuestions = (typeof totalQuestions === 'number' && !isNaN(totalQuestions) && totalQuestions > 0) ? totalQuestions : 1;
  
  const questionElapsed = validQuestionTimeLimit - validQuestionTimeRemaining;
  const questionProgressPercent = validQuestionTimeLimit > 0 ? (questionElapsed / validQuestionTimeLimit) * 100 : 0;
  
  const getColor = () => {
    if (isCritical) return theme.palette.error.main;
    if (isWarning) return theme.palette.warning.main;
    return theme.palette.secondary.main;
  };

  return (
    <Paper 
      elevation={1}
      sx={{ 
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 0.8,
        borderRadius: 3,
        background: isCritical
          ? 'linear-gradient(90deg, #ffebee, #ffcdd2)'
          : isWarning
          ? 'linear-gradient(90deg, #fff8e1, #ffecb3)'
          : 'linear-gradient(90deg, #f3e5f5, #e1bee7)',
        animation: isCritical ? `${pulse} 2s infinite` : isWarning ? `${glow} 2.5s infinite` : 'none',
        minWidth: 300,
        maxWidth: 450
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: getColor(),
          color: 'white',
          flexShrink: 0
        }}
      >
        {isCritical ? <AlarmIcon sx={{ fontSize: 14 }} /> : <TimerIcon sx={{ fontSize: 14 }} />}
      </Box>
      
      {/* Question label */}
      <Typography 
        variant="body2" 
        sx={{ 
          fontWeight: 600,
          color: getColor(),
          fontSize: '0.85rem',
          flexShrink: 0
        }}
      >
        Q{validCurrentQuestionIndex + 1}/{validTotalQuestions}
      </Typography>
      
      {/* Timer text */}
      <Typography 
        variant="body2" 
        sx={{ 
          fontFamily: '"Roboto Mono", monospace',
          fontWeight: 600,
          color: getColor(),
          fontSize: '0.9rem',
          flexShrink: 0
        }}
      >
        {TimingService.formatTime(validQuestionTimeRemaining)}
      </Typography>
      
      {/* Progress bar */}
      <Box sx={{ flex: 1, minWidth: 60 }}>
        <LinearProgress 
          variant="determinate" 
          value={Math.min(100, questionProgressPercent)}
          sx={{ 
            height: 4, 
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.5)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 2,
              bgcolor: getColor()
            }
          }}
        />
      </Box>
      
      {/* Percentage */}
      <Typography 
        variant="caption" 
        sx={{ 
          color: 'text.secondary',
          fontSize: '0.7rem',
          flexShrink: 0
        }}
      >
        {Math.round(questionProgressPercent)}%
      </Typography>
      
      {/* Warning icon */}
      {(isWarning || isCritical) && (
        <WarningIcon 
          sx={{ 
            color: getColor(),
            fontSize: 16,
            flexShrink: 0
          }} 
        />
      )}
    </Paper>
  );
};

/**
 * Main Timer Display Component
 * Routes to appropriate timer based on timing mode
 */
const TimerDisplay = ({ 
  timingMode,
  // Total mode props
  totalTime,
  remainingTime,
  // Per-question mode props
  questionTimeLimit,
  questionTimeRemaining,
  currentQuestionIndex,
  totalQuestions,
  overallTimeRemaining,
  overallTotalTime
}) => {
  // Calculate warning states
  const calculateWarningStates = () => {
    if (timingMode === 'total') {
      const validTotalTime = (typeof totalTime === 'number' && !isNaN(totalTime) && totalTime > 0) ? totalTime : 0;
      const validRemainingTime = (typeof remainingTime === 'number' && !isNaN(remainingTime) && remainingTime >= 0) ? remainingTime : 0;
      
      if (validTotalTime === 0) {
        return { isWarning: false, isCritical: false };
      }
      
      const progressPercent = ((validTotalTime - validRemainingTime) / validTotalTime) * 100;
      const remainingPercent = 100 - progressPercent;
      return {
        isWarning: remainingPercent <= 25 && remainingPercent > 10,
        isCritical: remainingPercent <= 10
      };
    } else {
      const validQuestionTimeLimit = (typeof questionTimeLimit === 'number' && !isNaN(questionTimeLimit) && questionTimeLimit > 0) ? questionTimeLimit : 0;
      const validQuestionTimeRemaining = (typeof questionTimeRemaining === 'number' && !isNaN(questionTimeRemaining) && questionTimeRemaining >= 0) ? questionTimeRemaining : 0;
      
      if (validQuestionTimeLimit === 0) {
        return { isWarning: false, isCritical: false };
      }
      
      const questionProgressPercent = ((validQuestionTimeLimit - validQuestionTimeRemaining) / validQuestionTimeLimit) * 100;
      const questionRemainingPercent = 100 - questionProgressPercent;
      return {
        isWarning: questionRemainingPercent <= 25 && questionRemainingPercent > 10,
        isCritical: questionRemainingPercent <= 10
      };
    }
  };

  const { isWarning, isCritical } = calculateWarningStates();

  if (timingMode === 'total') {
    return (
      <TotalTimerDisplay
        totalTime={totalTime}
        remainingTime={remainingTime}
        isWarning={isWarning}
        isCritical={isCritical}
        showProgress={true}
      />
    );
  } else if (timingMode === 'per-question') {
    return (
      <QuestionTimerDisplay
        questionTimeLimit={questionTimeLimit}
        questionTimeRemaining={questionTimeRemaining}
        currentQuestionIndex={currentQuestionIndex}
        totalQuestions={totalQuestions}
        isWarning={isWarning}
        isCritical={isCritical}
      />
    );
  }

  return null;
};

export { TotalTimerDisplay, QuestionTimerDisplay };
export default TimerDisplay;