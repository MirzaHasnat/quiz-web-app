/**
 * Permission Validator Utility
 * Provides functions to check browser media permission status
 */

/**
 * Check if the browser supports the required media APIs
 * @returns {boolean} True if browser supports required APIs
 */
export const checkBrowserSupport = () => {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    navigator.mediaDevices.getDisplayMedia
  );
};

/**
 * Check if a specific permission is granted
 * @param {string} permissionName - Name of the permission to check
 * @returns {Promise<PermissionStatus>} Permission status
 */
export const checkPermissionStatus = async (permissionName) => {
  try {
    // This only works for camera and microphone, not screen sharing
    if (navigator.permissions && navigator.permissions.query) {
      if (permissionName === 'camera' || permissionName === 'microphone') {
        return await navigator.permissions.query({ name: permissionName });
      }
    }
    return null;
  } catch (error) {
    console.error(`Error checking ${permissionName} permission:`, error);
    return null;
  }
};

/**
 * Verify if all required permissions are granted
 * @param {Object} permissions - Object containing permission states
 * @returns {Object} Object with validation result and missing permissions
 */
export const verifyRequiredPermissions = (permissions) => {
  const missingPermissions = [];
  
  if (!permissions.screen) missingPermissions.push('screen sharing');
  if (!permissions.camera) missingPermissions.push('camera');
  if (!permissions.microphone) missingPermissions.push('microphone');
  
  return {
    isValid: missingPermissions.length === 0,
    missingPermissions
  };
};

/**
 * Get a user-friendly error message for permission denial
 * @param {string} permissionType - Type of permission that was denied
 * @returns {string} User-friendly error message
 */
export const getPermissionErrorMessage = (permissionType) => {
  const messages = {
    screen: 'Screen sharing permission is required to monitor quiz integrity. Please allow screen sharing to continue.',
    camera: 'Camera access is required to verify your identity during the quiz. Please allow camera access to continue.',
    microphone: 'Microphone access is required to record audio during the quiz. Please allow microphone access to continue.',
    generic: 'All permissions (screen sharing, camera, and microphone) are required to take the quiz. Please grant all permissions to continue.'
  };
  
  return messages[permissionType] || messages.generic;
};

/**
 * Check if permissions need to be requested again (e.g., after a page refresh)
 * @param {Object} streams - Object containing media streams
 * @returns {boolean} True if permissions need to be requested again
 */
export const needsPermissionRefresh = (streams) => {
  // Check if any stream is inactive or null
  return !streams.screen || 
         !streams.camera || 
         !streams.microphone ||
         streams.screen.getTracks().some(track => !track.enabled) ||
         streams.camera.getTracks().some(track => !track.enabled) ||
         streams.microphone.getTracks().some(track => !track.enabled);
};