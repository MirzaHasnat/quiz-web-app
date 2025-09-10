import axios from 'axios';
import {
  startScreenRecording,
  startCameraAudioRecording,
  stopScreenRecording,
  stopCameraAudioRecording,
  uploadRecording,
  getRecordingStatus,
  startAllRecordings,
  stopAllRecordings,
  uploadAllRecordings,
  isRecordingActive
} from '../recordingService';

// Mock axios
jest.mock('axios');

// Mock MediaRecorder
global.MediaRecorder = class {
  constructor() {
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
  }
  
  start() {
    this.state = 'recording';
    // Simulate data available event
    setTimeout(() => {
      if (this.ondataavailable) {
        this.ondataavailable({ data: new Blob(['test'], { type: 'video/webm' }) });
      }
    }, 100);
  }
  
  stop() {
    this.state = 'inactive';
    // Simulate stop event
    setTimeout(() => {
      if (this.onstop) {
        this.onstop();
      }
    }, 100);
  }
};

// Mock MediaStream
class MockMediaStream {
  constructor(tracks = []) {
    this.tracks = tracks;
  }
  
  getTracks() {
    return this.tracks;
  }
  
  getVideoTracks() {
    return this.tracks.filter(track => track.kind === 'video');
  }
  
  getAudioTracks() {
    return this.tracks.filter(track => track.kind === 'audio');
  }
  
  addTrack(track) {
    this.tracks.push(track);
  }
}

// Mock track
class MockTrack {
  constructor(kind) {
    this.kind = kind;
    this.enabled = true;
  }
  
  stop() {
    this.enabled = false;
  }
}

global.MediaStream = MockMediaStream;

describe('Recording Service', () => {
  let mockScreenStream;
  let mockCameraStream;
  let mockAudioStream;
  const mockAttemptId = 'test-attempt-id';
  
  beforeEach(() => {
    // Create mock streams
    mockScreenStream = new MockMediaStream([new MockTrack('video')]);
    mockCameraStream = new MockMediaStream([new MockTrack('video')]);
    mockAudioStream = new MockMediaStream([new MockTrack('audio')]);
    
    // Reset axios mock
    axios.post.mockReset();
    axios.put.mockReset();
    axios.get.mockReset();
    
    // Mock successful API responses
    axios.post.mockImplementation((url) => {
      if (url === '/api/recordings') {
        return Promise.resolve({
          data: {
            data: {
              _id: 'test-recording-id',
              type: url.includes('screen') ? 'screen' : 'camera-audio',
              status: 'recording'
            }
          }
        });
      }
      return Promise.resolve({ data: {} });
    });
    
    axios.put.mockResolvedValue({
      data: {
        data: {
          _id: 'test-recording-id',
          status: 'processing'
        }
      }
    });
    
    axios.get.mockResolvedValue({
      data: {
        data: {
          _id: 'test-recording-id',
          status: 'available'
        }
      }
    });
  });
  
  test('startScreenRecording should initialize recorder and create backend entry', async () => {
    const result = await startScreenRecording(mockScreenStream, mockAttemptId);
    
    expect(axios.post).toHaveBeenCalledWith('/api/recordings', {
      attemptId: mockAttemptId,
      type: 'screen'
    });
    
    expect(result).toEqual({
      _id: 'test-recording-id',
      type: 'screen',
      status: 'recording'
    });
  });
  
  test('startCameraAudioRecording should initialize recorder and create backend entry', async () => {
    const result = await startCameraAudioRecording(mockCameraStream, mockAudioStream, mockAttemptId);
    
    expect(axios.post).toHaveBeenCalledWith('/api/recordings', {
      attemptId: mockAttemptId,
      type: 'camera-audio'
    });
    
    expect(result).toEqual({
      _id: 'test-recording-id',
      type: 'camera-audio',
      status: 'recording'
    });
  });
  
  test('stopScreenRecording should stop recorder and update backend', async () => {
    // First start recording
    await startScreenRecording(mockScreenStream, mockAttemptId);
    
    // Then stop it
    const blob = await stopScreenRecording();
    
    expect(blob).toBeInstanceOf(Blob);
    expect(axios.put).toHaveBeenCalled();
  });
  
  test('stopCameraAudioRecording should stop recorder and update backend', async () => {
    // First start recording
    await startCameraAudioRecording(mockCameraStream, mockAudioStream, mockAttemptId);
    
    // Then stop it
    const blob = await stopCameraAudioRecording();
    
    expect(blob).toBeInstanceOf(Blob);
    expect(axios.put).toHaveBeenCalled();
  });
  
  test('uploadRecording should send blob to server', async () => {
    const mockBlob = new Blob(['test'], { type: 'video/webm' });
    const mockRecordingId = 'test-recording-id';
    
    axios.post.mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          fileUrl: '/uploads/test.webm'
        }
      }
    });
    
    const result = await uploadRecording(mockBlob, mockRecordingId);
    
    expect(axios.post).toHaveBeenCalled();
    expect(result).toEqual({
      status: 'success',
      data: {
        fileUrl: '/uploads/test.webm'
      }
    });
  });
  
  test('getRecordingStatus should fetch status from server', async () => {
    const mockRecordingId = 'test-recording-id';
    
    const result = await getRecordingStatus(mockRecordingId);
    
    expect(axios.get).toHaveBeenCalledWith(`/api/recordings/${mockRecordingId}`);
    expect(result).toEqual({
      _id: 'test-recording-id',
      status: 'available'
    });
  });
  
  test('startAllRecordings should start both screen and camera-audio recordings', async () => {
    const streams = {
      screen: mockScreenStream,
      camera: mockCameraStream,
      microphone: mockAudioStream
    };
    
    const result = await startAllRecordings(streams, mockAttemptId);
    
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(result).toHaveProperty('screen');
    expect(result).toHaveProperty('cameraAudio');
  });
  
  test('stopAllRecordings should stop both recordings', async () => {
    // First start recordings
    const streams = {
      screen: mockScreenStream,
      camera: mockCameraStream,
      microphone: mockAudioStream
    };
    
    await startAllRecordings(streams, mockAttemptId);
    
    // Then stop them
    const result = await stopAllRecordings();
    
    expect(result).toHaveProperty('screen');
    expect(result).toHaveProperty('cameraAudio');
    expect(result.screen).toBeInstanceOf(Blob);
    expect(result.cameraAudio).toBeInstanceOf(Blob);
  });
  
  test('isRecordingActive should return correct status', async () => {
    // Initially no active recordings
    expect(isRecordingActive()).toBe(false);
    
    // Start recording
    await startScreenRecording(mockScreenStream, mockAttemptId);
    
    // Now should be active
    expect(isRecordingActive()).toBe(true);
  });
});