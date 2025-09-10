import React from 'react';
import { render, screen } from '@testing-library/react';
import RecordingStatusIndicator from '../RecordingStatusIndicator';
import { isRecordingActive, getRecordingErrors } from '../../services/recordingService';

// Mock the recording service
jest.mock('../../services/recordingService', () => ({
  isRecordingActive: jest.fn(),
  getRecordingErrors: jest.fn()
}));

describe('RecordingStatusIndicator', () => {
  beforeEach(() => {
    // Reset mocks before each test
    isRecordingActive.mockReset();
    getRecordingErrors.mockReset();
  });
  
  test('renders active recording status when recording is active', () => {
    // Mock active recording with no errors
    isRecordingActive.mockReturnValue(true);
    getRecordingErrors.mockReturnValue(null);
    
    render(<RecordingStatusIndicator recordingIds={{ screen: 'id1', cameraAudio: 'id2' }} />);
    
    // Check if the component renders recording status text
    expect(screen.getByText(/Recording:/i)).toBeInTheDocument();
    
    // Check if all three icons are present (screen, camera, mic)
    const icons = document.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThanOrEqual(3);
  });
  
  test('renders error indicator when recording has errors', () => {
    // Mock recording with errors
    isRecordingActive.mockReturnValue(false);
    getRecordingErrors.mockReturnValue({
      screen: 'Screen recording error'
    });
    
    render(<RecordingStatusIndicator recordingIds={{ screen: 'id1', cameraAudio: 'id2' }} />);
    
    // Check if error message is displayed
    expect(screen.getByText(/Recording Error/i)).toBeInTheDocument();
  });
});