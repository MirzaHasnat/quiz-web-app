/**
 * Media Permissions Service
 * Handles requesting and validating media permissions for screen sharing, camera, and microphone
 */

/**
 * Request screen sharing permission
 * @returns {Promise<MediaStream>} The screen sharing stream if permission granted
 * @throws {Error} If permission denied or error occurs
 */
export const requestScreenPermission = async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ 
      video: { 
        cursor: "always" 
      },
      audio: false
    });
    return stream;
  } catch (error) {
    console.error('Screen permission error:', error);
    throw new Error('Screen sharing permission denied');
  }
};

/**
 * Request camera permission
 * @returns {Promise<MediaStream>} The camera stream if permission granted
 * @throws {Error} If permission denied or error occurs
 */
export const requestCameraPermission = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: true,
      audio: false
    });
    return stream;
  } catch (error) {
    console.error('Camera permission error:', error);
    throw new Error('Camera permission denied');
  }
};

/**
 * Request microphone permission
 * @returns {Promise<MediaStream>} The microphone stream if permission granted
 * @throws {Error} If permission denied or error occurs
 */
export const requestMicrophonePermission = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: false,
      audio: true
    });
    return stream;
  } catch (error) {
    console.error('Microphone permission error:', error);
    throw new Error('Microphone permission denied');
  }
};

/**
 * Check if all required permissions are granted
 * @param {Object} permissions - Object containing permission states
 * @returns {boolean} True if all permissions are granted
 */
export const validateAllPermissions = (permissions) => {
  return permissions.screen && permissions.camera && permissions.microphone;
};

/**
 * Stop all media streams
 * @param {Object} streams - Object containing media streams
 */
export const stopAllStreams = (streams) => {
  Object.values(streams).forEach(stream => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    }
  });
};

/**
 * Stop specific media streams based on requirements
 * @param {Object} streams - Object containing media streams
 * @param {Object} requirements - Recording requirements object
 */
export const stopRequiredStreams = (streams, requirements) => {
  if (requirements.enableScreen && streams.screen) {
    streams.screen.getTracks().forEach(track => {
      track.stop();
      console.log('Stopped screen sharing track');
    });
  }
  
  if (requirements.enableCamera && streams.camera) {
    streams.camera.getTracks().forEach(track => {
      track.stop();
      console.log('Stopped camera track');
    });
  }
  
  if (requirements.enableMicrophone && streams.microphone) {
    streams.microphone.getTracks().forEach(track => {
      track.stop();
      console.log('Stopped microphone track');
    });
  }
};