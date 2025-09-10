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
    Chip,
    Grid,
    Divider
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    VolumeUp as VolumeIcon,
    VolumeOff as MuteIcon,
    FullscreenRounded as FullscreenIcon,
    GetApp as DownloadIcon,
    Info as InfoIcon,
    Videocam as VideocamIcon,
    ScreenShare as ScreenShareIcon
} from '@mui/icons-material';
import { getRecordingDetails, getRecordingActivityLogs } from '../../services/recordingService';

/**
 * Combined Recording Player Component
 * Displays camera recording above screen recording in a stacked layout
 */
const CombinedRecordingPlayer = ({ recordings }) => {
    const [recordingDetails, setRecordingDetails] = useState({});
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

    const screenVideoRef = useRef(null);
    const cameraVideoRef = useRef(null);
    const microphoneAudioRef = useRef(null);

    // Separate recordings by type - handle both old and new formats
    const screenRecording = recordings.find(r => r.type === 'screen');
    const cameraRecording = recordings.find(r => r.type === 'camera');
    const microphoneRecording = recordings.find(r => r.type === 'microphone');
    // Fallback to old format if new format not available
    const cameraAudioRecording = recordings.find(r => r.type === 'camera-audio');

    // Load recording details for all recordings
    useEffect(() => {
        const fetchAllRecordingDetails = async () => {
            try {
                setLoading(true);
                setError(null);

                const details = {};

                for (const recording of recordings) {
                    try {
                        const recordingData = await getRecordingDetails(recording.id);
                        details[recording.id] = recordingData;
                    } catch (err) {
                        console.error(`Error fetching details for recording ${recording.id}:`, err);
                        details[recording.id] = { error: 'Failed to load recording details' };
                    }
                }

                setRecordingDetails(details);
                setLoading(false);
            } catch (err) {
                setError('Failed to load recordings. Please try again.');
                setLoading(false);
                console.error('Error fetching recording details:', err);
            }
        };

        if (recordings && recordings.length > 0) {
            fetchAllRecordingDetails();
        } else {
            setLoading(false);
        }
    }, [recordings]);

    // Load activity logs when info panel is opened
    useEffect(() => {
        if (showInfo && recordings.length > 0) {
            const fetchActivityLogs = async () => {
                try {
                    setLoadingLogs(true);
                    const allLogs = [];

                    for (const recording of recordings) {
                        try {
                            const logs = await getRecordingActivityLogs(recording.id);
                            allLogs.push(...logs.map(log => ({ ...log, recordingType: recording.type })));
                        } catch (err) {
                            console.error(`Error fetching logs for recording ${recording.id}:`, err);
                        }
                    }

                    // Sort logs by timestamp
                    allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    setActivityLogs(allLogs);
                    setLoadingLogs(false);
                } catch (err) {
                    console.error('Error fetching activity logs:', err);
                    setLoadingLogs(false);
                }
            };

            fetchActivityLogs();
        }
    }, [showInfo, recordings]);

    // Handle video events - use screen recording as the main timeline controller
    useEffect(() => {
        const videoElement = screenVideoRef.current;
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
    }, []);

    // Synchronize video and audio playback
    const syncMedia = (action, value = null) => {
        const mediaElements = [screenVideoRef.current, cameraVideoRef.current, microphoneAudioRef.current].filter(Boolean);

        mediaElements.forEach(element => {
            try {
                switch (action) {
                    case 'play':
                        element.play();
                        break;
                    case 'pause':
                        element.pause();
                        break;
                    case 'seek':
                        element.currentTime = value;
                        break;
                }
            } catch (err) {
                console.error('Error syncing media:', err);
            }
        });
    };

    // Handle play/pause
    const handlePlayPause = () => {
        if (playing) {
            syncMedia('pause');
        } else {
            syncMedia('play');
        }
        setPlaying(!playing);
    };

    // Handle seek
    const handleSeek = (_, newValue) => {
        syncMedia('seek', newValue);
        setCurrentTime(newValue);
    };

    // Handle volume change - only affects microphone recording (audio source)
    const handleVolumeChange = (_, newValue) => {
        if (microphoneAudioRef.current) {
            microphoneAudioRef.current.volume = newValue;
        }
        setVolume(newValue);

        if (newValue === 0) {
            setMuted(true);
        } else if (muted) {
            setMuted(false);
        }
    };

    // Handle mute toggle - only affects microphone recording (audio source)
    const handleMuteToggle = () => {
        const newMuted = !muted;
        if (microphoneAudioRef.current) {
            microphoneAudioRef.current.muted = newMuted;
        }
        setMuted(newMuted);
    };

    // Handle fullscreen for the entire container
    const handleFullscreen = () => {
        const container = document.querySelector('.recording-container');
        if (container) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
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

    // Get recording details by type
    const getRecordingByType = (type) => {
        const recording = recordings.find(r => r.type === type);
        return recording ? recordingDetails[recording.id] : null;
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

    if (!recordings || recordings.length === 0) {
        return (
            <Alert severity="info" sx={{ mb: 2 }}>
                No recordings available for this attempt
            </Alert>
        );
    }

    const screenDetails = getRecordingByType('screen');
    const cameraDetails = getRecordingByType('camera');
    const microphoneDetails = getRecordingByType('microphone');
    // Fallback to old format
    const cameraAudioDetails = getRecordingByType('camera-audio');

    return (
        <Card sx={{ mb: 3 }} className="recording-container">
            <CardContent sx={{ p: 0, position: 'relative' }}>
                {/* Main Video Display with PiP */}
                <Box sx={{ position: 'relative', bgcolor: 'black' }}>
                    {/* Hidden Audio Element for Microphone Recording or Camera-Audio fallback */}
                    {(microphoneDetails && microphoneDetails.status === 'available') ? (
                        <audio
                            ref={microphoneAudioRef}
                            controls={false}
                            style={{ display: 'none' }}
                            src={`/api/recordings/${microphoneRecording?.id}/stream`}
                        />
                    ) : (cameraAudioDetails && cameraAudioDetails.status === 'available') && (
                        <audio
                            ref={microphoneAudioRef}
                            controls={false}
                            style={{ display: 'none' }}
                            src={`/api/recordings/${cameraAudioRecording?.id}/stream`}
                        />
                    )}

                    {/* Screen Recording (Main View) */}
                    {screenDetails && screenDetails.status === 'available' ? (
                        <video
                            ref={screenVideoRef}
                            width="100%"
                            height="auto"
                            controls={false}
                            muted // Screen recording is muted since audio comes from microphone
                            style={{ display: 'block' }}
                            src={`/api/recordings/${screenRecording?.id}/stream`}
                        />
                    ) : (
                        <Box sx={{ p: 3, textAlign: 'center', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Alert severity="info">
                                {!screenDetails && 'Screen recording not available'}
                                {screenDetails?.status === 'recording' && 'Screen recording in progress...'}
                                {screenDetails?.status === 'processing' && 'Screen recording is being processed...'}
                                {screenDetails?.status === 'error' && 'Error processing screen recording'}
                            </Alert>
                        </Box>
                    )}

                    {/* Camera Recording (Picture-in-Picture) - use camera or fallback to camera-audio */}
                    {((cameraDetails && cameraDetails.status === 'available') || (cameraAudioDetails && cameraAudioDetails.status === 'available')) && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 16,
                                right: 16,
                                width: '25%',
                                maxWidth: 300,
                                minWidth: 200,
                                border: '2px solid white',
                                borderRadius: 2,
                                overflow: 'hidden',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                                bgcolor: 'black'
                            }}
                        >
                            <video
                                ref={cameraVideoRef}
                                width="100%"
                                height="auto"
                                controls={false}
                                muted // Camera video is muted since audio comes from separate microphone recording
                                style={{ display: 'block' }}
                                src={`/api/recordings/${(cameraRecording?.id || cameraAudioRecording?.id)}/stream`}
                            />
                            <Box
                                sx={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    bgcolor: 'rgba(0, 0, 0, 0.8)',
                                    color: 'white',
                                    p: 0.5,
                                    textAlign: 'center'
                                }}
                            >
                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                                    <VideocamIcon sx={{ mr: 0.5, fontSize: 12 }} />
                                    Camera
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {/* Camera Recording Status (when not available) */}
                    {(!cameraDetails || cameraDetails.status !== 'available') && (!cameraAudioDetails || cameraAudioDetails.status !== 'available') && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 16,
                                right: 16,
                                width: '25%',
                                maxWidth: 300,
                                minWidth: 200,
                                border: '2px solid rgba(255, 255, 255, 0.3)',
                                borderRadius: 2,
                                overflow: 'hidden',
                                bgcolor: 'rgba(0, 0, 0, 0.7)',
                                p: 2,
                                textAlign: 'center'
                            }}
                        >
                            <VideocamIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 32, mb: 1 }} />
                            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block' }}>
                                {!cameraDetails && 'Camera recording not available'}
                                {cameraDetails?.status === 'recording' && 'Recording in progress...'}
                                {cameraDetails?.status === 'processing' && 'Processing...'}
                                {cameraDetails?.status === 'error' && 'Recording error'}
                            </Typography>
                        </Box>
                    )}

                    {/* Custom Controls - Only show if at least one recording is available */}
                    {(screenDetails?.status === 'available' || cameraDetails?.status === 'available' || microphoneDetails?.status === 'available' || cameraAudioDetails?.status === 'available') && (
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                bgcolor: 'rgba(0, 0, 0, 0.8)',
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
                    )}
                </Box>
            </CardContent>

            <CardActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <Box>
                    <Typography variant="subtitle1" component="span" sx={{ mr: 2 }}>
                        Combined Recording View
                    </Typography>

                    {screenDetails && (
                        <Chip
                            label={`Screen: ${screenDetails.status}`}
                            color={
                                screenDetails.status === 'available' ? 'success' :
                                    screenDetails.status === 'processing' ? 'warning' :
                                        screenDetails.status === 'recording' ? 'info' : 'error'
                            }
                            size="small"
                            sx={{ mr: 1 }}
                        />
                    )}

                    {cameraDetails && (
                        <Chip
                            label={`Camera: ${cameraDetails.status}`}
                            color={
                                cameraDetails.status === 'available' ? 'success' :
                                    cameraDetails.status === 'processing' ? 'warning' :
                                        cameraDetails.status === 'recording' ? 'info' : 'error'
                            }
                            size="small"
                            sx={{ mr: 1 }}
                        />
                    )}

                    {microphoneDetails && (
                        <Chip
                            label={`Audio: ${microphoneDetails.status}`}
                            color={
                                microphoneDetails.status === 'available' ? 'success' :
                                    microphoneDetails.status === 'processing' ? 'warning' :
                                        microphoneDetails.status === 'recording' ? 'info' : 'error'
                            }
                            size="small"
                            sx={{ mr: 1 }}
                        />
                    )}
                </Box>

                <Box>
                    <Tooltip title="Recording Information">
                        <IconButton onClick={() => setShowInfo(!showInfo)} color="primary">
                            <InfoIcon />
                        </IconButton>
                    </Tooltip>

                    {screenDetails?.status === 'available' && (
                        <Button
                            startIcon={<DownloadIcon />}
                            component="a"
                            href={`/api/recordings/${screenRecording?.id}/download`}
                            target="_blank"
                            download
                            sx={{ mr: 1 }}
                        >
                            Screen
                        </Button>
                    )}

                    {cameraDetails?.status === 'available' && (
                        <Button
                            startIcon={<DownloadIcon />}
                            component="a"
                            href={`/api/recordings/${cameraRecording?.id}/download`}
                            target="_blank"
                            download
                            sx={{ mr: 1 }}
                        >
                            Camera
                        </Button>
                    )}

                    {microphoneDetails?.status === 'available' && (
                        <Button
                            startIcon={<DownloadIcon />}
                            component="a"
                            href={`/api/recordings/${microphoneRecording?.id}/download`}
                            target="_blank"
                            download
                        >
                            Audio
                        </Button>
                    )}
                </Box>
            </CardActions>

            {showInfo && (
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Recording Information
                    </Typography>

                    <Grid container spacing={3}>
                        {/* Screen Recording Info */}
                        {screenDetails && (
                            <Grid item xs={12} md={4}>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle1" gutterBottom>
                                        <ScreenShareIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                        Screen Recording
                                    </Typography>

                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1 }}>
                                        <Typography variant="body2">
                                            <strong>Status:</strong> {screenDetails.status}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Duration:</strong> {formatTime(screenDetails.duration)}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Start Time:</strong> {formatDate(screenDetails.startTime)}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>End Time:</strong> {formatDate(screenDetails.endTime)}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>File Size:</strong> {screenDetails.fileSize ? `${Math.round(screenDetails.fileSize / 1024 / 1024)} MB` : 'N/A'}
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Grid>
                        )}

                        {/* Camera Recording Info */}
                        {cameraDetails && (
                            <Grid item xs={12} md={4}>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle1" gutterBottom>
                                        <VideocamIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                        Camera Recording
                                    </Typography>

                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1 }}>
                                        <Typography variant="body2">
                                            <strong>Status:</strong> {cameraDetails.status}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Duration:</strong> {formatTime(cameraDetails.duration)}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Start Time:</strong> {formatDate(cameraDetails.startTime)}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>End Time:</strong> {formatDate(cameraDetails.endTime)}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>File Size:</strong> {cameraDetails.fileSize ? `${Math.round(cameraDetails.fileSize / 1024 / 1024)} MB` : 'N/A'}
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Grid>
                        )}

                        {/* Microphone Recording Info */}
                        {microphoneDetails && (
                            <Grid item xs={12} md={4}>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle1" gutterBottom>
                                        <VolumeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                        Audio Recording
                                    </Typography>

                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1 }}>
                                        <Typography variant="body2">
                                            <strong>Status:</strong> {microphoneDetails.status}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Duration:</strong> {formatTime(microphoneDetails.duration)}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Start Time:</strong> {formatDate(microphoneDetails.startTime)}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>End Time:</strong> {formatDate(microphoneDetails.endTime)}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>File Size:</strong> {microphoneDetails.fileSize ? `${Math.round(microphoneDetails.fileSize / 1024 / 1024)} MB` : 'N/A'}
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Grid>
                        )}
                    </Grid>

                    <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
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
                                        <strong>Recording Type:</strong> {log.recordingType}
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

export default CombinedRecordingPlayer;