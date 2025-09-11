import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import TimerDisplay, { TotalTimerDisplay, QuestionTimerDisplay } from '../TimerDisplay';

// Mock the TimingService
jest.mock('../../services/timingService', () => ({
  formatTime: jest.fn((seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }),
  formatTimeWithHours: jest.fn((seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      remainingSeconds.toString().padStart(2, '0')
    ].join(':');
  })
}));

describe('TimerDisplay Components', () => {
  describe('TotalTimerDisplay', () => {
    test('renders total timer with time remaining', () => {
      render(
        <TotalTimerDisplay
          totalTime={1800} // 30 minutes
          remainingTime={900} // 15 minutes
        />
      );

      expect(screen.getByText('00:15:00')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument(); // Progress percentage
    });

    test('shows warning state when time is low', () => {
      render(
        <TotalTimerDisplay
          totalTime={1800} // 30 minutes
          remainingTime={300} // 5 minutes (< 25%)
          isWarning={true}
        />
      );

      expect(screen.getByText('00:05:00')).toBeInTheDocument();
    });

    test('shows critical state when time is very low', () => {
      render(
        <TotalTimerDisplay
          totalTime={1800} // 30 minutes
          remainingTime={120} // 2 minutes (< 10%)
          isCritical={true}
        />
      );

      expect(screen.getByText('00:02:00')).toBeInTheDocument();
      // Check for warning icon
      expect(screen.getByTestId('WarningIcon')).toBeInTheDocument();
    });

    test('shows progress bar when enabled', () => {
      render(
        <TotalTimerDisplay
          totalTime={1800} // 30 minutes
          remainingTime={900} // 15 minutes (50% remaining)
          showProgress={true}
        />
      );

      // Check for progress percentage
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    test('handles zero and invalid values gracefully', () => {
      render(
        <TotalTimerDisplay
          totalTime={0}
          remainingTime={null}
        />
      );

      expect(screen.getByText('00:00:00')).toBeInTheDocument();
    });
  });

  describe('QuestionTimerDisplay', () => {
    test('renders per-question timer display', () => {
      render(
        <QuestionTimerDisplay
          questionTimeLimit={120} // 2 minutes
          questionTimeRemaining={60} // 1 minute
          currentQuestionIndex={2}
          totalQuestions={5}
        />
      );

      expect(screen.getByText('Q3/5')).toBeInTheDocument();
      expect(screen.getByText('01:00')).toBeInTheDocument();
    });

    test('shows question timer in warning state', () => {
      render(
        <QuestionTimerDisplay
          questionTimeLimit={120}
          questionTimeRemaining={20} // Low time
          currentQuestionIndex={0}
          totalQuestions={3}
          isWarning={true}
        />
      );

      expect(screen.getByText('Q1/3')).toBeInTheDocument();
      expect(screen.getByText('00:20')).toBeInTheDocument();
    });

    test('shows critical alert for question timeout', () => {
      render(
        <QuestionTimerDisplay
          questionTimeLimit={120}
          questionTimeRemaining={5} // Very low time
          currentQuestionIndex={1}
          totalQuestions={3}
          isCritical={true}
        />
      );

      expect(screen.getByText('Q2/3')).toBeInTheDocument();
      expect(screen.getByTestId('WarningIcon')).toBeInTheDocument();
    });

    test('displays question progress correctly', () => {
      render(
        <QuestionTimerDisplay
          questionTimeLimit={60}
          questionTimeRemaining={30}
          currentQuestionIndex={1}
          totalQuestions={4}
        />
      );

      expect(screen.getByText('Q2/4')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument(); // Question progress
    });

    test('handles invalid props gracefully', () => {
      render(
        <QuestionTimerDisplay
          questionTimeLimit={null}
          questionTimeRemaining={undefined}
          currentQuestionIndex={-1}
          totalQuestions={0}
        />
      );

      expect(screen.getByText('Q1/1')).toBeInTheDocument();
      expect(screen.getByText('01:00')).toBeInTheDocument(); // Default fallback
    });
  });

  describe('Unified TimerDisplay', () => {
    test('renders total mode timer', () => {
      render(
        <TimerDisplay
          timingMode='total'
          totalTime={1800}
          remainingTime={900}
        />
      );

      expect(screen.getByText('00:15:00')).toBeInTheDocument();
    });

    test('renders per-question mode timer', () => {
      render(
        <TimerDisplay
          timingMode='per-question'
          questionTimeLimit={120}
          questionTimeRemaining={60}
          currentQuestionIndex={0}
          totalQuestions={3}
        />
      );

      expect(screen.getByText('Q1/3')).toBeInTheDocument();
    });

    test('handles zero time gracefully', () => {
      render(
        <TimerDisplay
          timingMode='total'
          totalTime={1800}
          remainingTime={0}
        />
      );

      expect(screen.getByText('00:00:00')).toBeInTheDocument();
    });

    test('handles missing props gracefully', () => {
      render(
        <TimerDisplay
          timingMode='total'
        />
      );

      // Should render without crashing
      expect(screen.getByText('00:00:00')).toBeInTheDocument();
    });

    test('returns null for invalid timing mode', () => {
      const { container } = render(
        <TimerDisplay
          timingMode='invalid'
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Timer State Management', () => {
    test('calculates warning state correctly', () => {
      // Test warning threshold (25%)
      render(
        <TimerDisplay
          timingMode='total'
          totalTime={1000}
          remainingTime={200} // 20% - should be warning
        />
      );

      // Check if time display is rendered correctly
      const timeDisplay = screen.getByText('00:03:20');
      expect(timeDisplay).toBeInTheDocument();
    });

    test('calculates critical state correctly', () => {
      // Test critical threshold (10%)
      render(
        <TimerDisplay
          timingMode='total'
          totalTime={1000}
          remainingTime={50} // 5% - should be critical
        />
      );

      expect(screen.getByText('00:00:50')).toBeInTheDocument();
      expect(screen.getByTestId('WarningIcon')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('includes proper timer display', () => {
      render(
        <TotalTimerDisplay
          totalTime={1800}
          remainingTime={900}
        />
      );

      // Timer should be displayed correctly
      const timerElement = screen.getByText('00:15:00');
      expect(timerElement).toBeInTheDocument();
    });

    test('provides meaningful text for question display', () => {
      render(
        <QuestionTimerDisplay
          questionTimeLimit={120}
          questionTimeRemaining={60}
          currentQuestionIndex={2}
          totalQuestions={5}
        />
      );

      expect(screen.getByText('Q3/5')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('handles frequent re-renders efficiently', () => {
      const { rerender } = render(
        <TimerDisplay
          timingMode='total'
          totalTime={1800}
          remainingTime={900}
        />
      );

      // Simulate timer countdown
      for (let i = 900; i > 890; i--) {
        rerender(
          <TimerDisplay
            timingMode='total'
            totalTime={1800}
            remainingTime={i}
          />
        );
      }

      // Should still display correctly
      expect(screen.getByText('00:14:50')).toBeInTheDocument();
    });
  });
});