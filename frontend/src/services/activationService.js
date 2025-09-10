import axios from '../utils/axiosConfig';

const API_URL = '/api';

// Get activation matrix (all users and their quiz activations)
export const getActivationMatrix = async () => {
  try {
    const response = await axios.get(`${API_URL}/activation`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch activation matrix' };
  }
};

// Toggle quiz activation for a user
export const toggleQuizActivation = async (quizId, userId, activate) => {
  try {
    const response = await axios.put(`${API_URL}/activation/quiz/${quizId}/user/${userId}`, { activate });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to update quiz activation' };
  }
};

// Bulk activate/deactivate quizzes for users
export const bulkActivation = async (activations) => {
  try {
    const response = await axios.post(`${API_URL}/activation/bulk`, { activations });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to perform bulk activation' };
  }
};

// Get active quiz sessions
export const getActiveSessions = async () => {
  try {
    const response = await axios.get(`${API_URL}/activation/sessions`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch active sessions' };
  }
};

// Terminate all active sessions for a user
export const terminateUserSessions = async (userId) => {
  try {
    const response = await axios.post(`${API_URL}/activation/terminate/${userId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to terminate user sessions' };
  }
};

// Bulk activate/deactivate a quiz for all users (efficient single request)
export const bulkQuizActivation = async (quizId, activate) => {
  try {
    const response = await axios.post(`${API_URL}/activation/quiz/${quizId}/bulk`, { activate });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to perform bulk quiz activation' };
  }
};

// Terminate a specific session
export const terminateSession = async (attemptId) => {
  try {
    const response = await axios.post(`${API_URL}/activation/terminate-session/${attemptId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to terminate session' };
  }
};