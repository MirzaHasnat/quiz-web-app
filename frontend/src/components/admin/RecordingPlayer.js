import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Slider,
  Card,
  CardContent,
  CardActions,
  Button,
  CircularProgress,
  Alert,
  Tooltip,
  Paper,
  Chip
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as MuteIcon,
  FullscreenRounded as FullscreenIcon,
  GetApp as DownloadIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { getRecordingDetails, getRecordingActivityLogs } from '../../services/recordingService';

/**
 * Recording Player Component
 * Displays a video player for quiz recordings with controls and metadata
 */
const RecordingPlayer = ({ recordingId, type }) => {
  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const videoRef = useRef(null);

  // Load recording details
  useEffect(() => {
    const fetchRecordingDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const recordingData = await getRecordingDetails(recordingId);
        setRecording(recordingData);
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load recording. Please try again.');
        setLoading(false);
        console.error('Error fetching recording details:', err);
      }
    };

    fetchRecordingDetails();
  }, [recordingId]);

  // Load activity logs when info panel is opened
  useEffect(() => {
    if (showInfo && recordingId) {
      const fetchActivityLogs = async () => {
        try {
          setLoadingLogs(true);
          const logs = await getRecordingActivityLogs(recordingId);
          setActivityLogs(logs);
          setLoadingLogs(false);
        } catch (err) {
          console.error('Error fetching activity logs:', err);
          setLoadingLogs(false);
        }
      };

      fetchActivityLogs();
    }
  }, [showInfo, recordingId]);

  // Handle video events
  useEffect(() => {
    const videoElement = videoRef.current;
    
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(videoElement.duration);
    };

    const handleEnded = () => {
      setPlaying(false);
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('ended', handleEnded);

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('ended', handleEnded);
    };
  }, [videoRef.current]);

  // Handle play/pause
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  // Handle seek
  const handleSeek = (event, newValue) => {
    if (videoRef.current) {
      videoRef.current.currentTime = newValue;
      setCurrentTime(newValue);
    }
  };

  // Handle volume change
  const handleVolumeChange = (event, newValue) => {
    if (videoRef.current) {
      videoRef.current.volume = newValue;
      setVolume(newValue);
      
      if (newValue === 0) {
        setMuted(true);
      } else if (muted) {
        setMuted(false);
      }
    }
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  // Handle fullscreen
  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if (videoRef.current.webkitRequestFullscreen) {
        videoRef.current.webkitRequestFullscreen();
      } else if (videoRef.current.msRequestFullscreen) {
        videoRef.current.msRequestFullscreen();
      }
    }
  };

  // Format time (seconds to MM:SS)
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!recording) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Recording not found
      </Alert>
    );
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 0, position: 'relative' }}>
        {recording.status === 'available' ? (
          <Box sx={{ position: 'relative' }}>
            <video
              ref={videoRef}
              width="100%"
              height="auto"
              controls={false}
              style={{ display: 'block' }}
              src={`/api/recordings/${recordingId}/stream`}
            />
            
            {/* Custom controls */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                bgcolor: 'rgba(0, 0, 0, 0.7)',
                p: 1,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <IconButton onClick={handlePlayPause} size="small" sx={{ color: 'white' }}>
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </IconButton>
                
                <Typography variant="body2" sx={{ color: 'white', mx: 1, minWidth: 60 }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Typography>
                
                <Box sx={{ flex: 1, mx: 1 }}>
                  <Slider
                    size="small"
                    value={currentTime}
                    min={0}
                    max={duration || 100}
                    onChange={handleSeek}
                    sx={{ color: 'white' }}
                  />
                </Box>
                
                <IconButton onClick={handleMuteToggle} size="small" sx={{ color: 'white' }}>
                  {muted ? <MuteIcon /> : <VolumeIcon />}
                </IconButton>
                
                <Box sx={{ width: 80, mx: 1 }}>
                  <Slider
                    size="small"
                    value={muted ? 0 : volume}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={handleVolumeChange}
                    sx={{ color: 'white' }}
                  />
                </Box>
                
                <IconButton onClick={handleFullscreen} size="small" sx={{ color: 'white' }}>
                  <FullscreenIcon />
                </IconButton>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Alert severity="info">
              {recording.status === 'recording' && 'Recording in progress...'}
              {recording.status === 'processing' && 'Recording is being processed...'}
              {recording.status === 'error' && 'Error processing recording'}
            </Alert>
          </Box>
        )}
      </CardContent>
      
      <CardActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="subtitle1" component="span" sx={{ mr: 2 }}>
            {type === 'screen' ? 'Screen Recording' : 'Camera & Audio Recording'}
          </Typography>
          
          <Chip 
            label={recording.status} 
            color={
              recording.status === 'available' ? 'success' : 
              recording.status === 'processing' ? 'warning' : 
              recording.status === 'recording' ? 'info' : 'error'
            }
            size="small"
            sx={{ mr: 1 }}
          />
        </Box>
        
        <Box>
          <Tooltip title="Recording Information">
            <IconButton onClick={() => setShowInfo(!showInfo)} color="primary">
              <InfoIcon />
            </IconButton>
          </Tooltip>
          
          {recording.status === 'available' && (
            <Button
              startIcon={<DownloadIcon />}
              component="a"
              href={`/api/recordings/${recordingId}/download`}
              target="_blank"
              download
            >
              Download
            </Button>
          )}
        </Box>
      </CardActions>
      
      {showInfo && (
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recording Information
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <Typography variant="body2">
              <strong>Type:</strong> {recording.type}
            </Typography>
            <Typography variant="body2">
              <strong>Duration:</strong> {formatTime(recording.duration)}
            </Typography>
            <Typography variant="body2">
              <strong>Start Time:</strong> {formatDate(recording.startTime)}
            </Typography>
            <Typography variant="body2">
              <strong>End Time:</strong> {formatDate(recording.endTime)}
            </Typography>
            <Typography variant="body2">
              <strong>File Size:</strong> {recording.fileSize ? `${Math.round(recording.fileSize / 1024 / 1024)} MB` : 'N/A'}
            </Typography>
            <Typography variant="body2">
              <strong>Status:</strong> {recording.status}
            </Typography>
          </Box>
          
          <Typography variant="h6" gutterBottom>
            Activity Logs
          </Typography>
          
          {loadingLogs ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : activityLogs.length > 0 ? (
            <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', p: 1 }}>
              {activityLogs.map((log, index) => (
                <Box key={index} sx={{ mb: 1, p: 1, borderBottom: '1px solid #eee' }}>
                  <Typography variant="body2">
                    <strong>Time:</strong> {formatDate(log.timestamp)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Action:</strong> {log.action}
                  </Typography>
                  <Typography variant="body2">
                    <strong>User:</strong> {log.userId}
                  </Typography>
                </Box>
              ))}
            </Paper>
          ) : (
            <Alert severity="info">No activity logs available</Alert>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default RecordingPlayer;