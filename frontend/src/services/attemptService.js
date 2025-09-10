import axios from '../utils/axiosConfig';

const API_URL = '/api/attempts';

// Get all attempts with filtering
export const getAttempts = async (filters = {}) => {
  const { quizId, userId, status, startDate, endDate, page, limit, sort } = filters;
  
  let queryParams = new URLSearchParams();
  
  if (quizId) queryParams.append('quizId', quizId);
  if (userId) queryParams.append('userId', userId);
  if (status) queryParams.append('status', status);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  if (page) queryParams.append('page', page);
  if (limit) queryParams.append('limit', limit);
  if (sort) queryParams.append('sort', sort);
  
  const response = await axios.get(`${API_URL}?${queryParams.toString()}`);
  return response.data;
};

// Get attempt details
export const getAttemptDetails = async (attemptId) => {
  const response = await axios.get(`${API_URL}/${attemptId}`);
  return response.data;
};

// Review attempt
export const reviewAttempt = async (attemptId, reviewData) => {
  const response = await axios.put(`${API_URL}/${attemptId}/review`, reviewData);
  return response.data;
};

// Update answer feedback
export const updateAnswerFeedback = async (attemptId, answerId, feedbackData) => {
  const response = await axios.put(
    `${API_URL}/${attemptId}/answers/${answerId}/feedback`, 
    feedbackData
  );
  return response.data;
};

// Get attempt statistics
export const getAttemptStats = async (quizId) => {
  let url = `${API_URL}/stats`;
  if (quizId) {
    url += `?quizId=${quizId}`;
  }
  const response = await axios.get(url);
  return response.data;
};

// Batch update attempts
export const batchUpdateAttempts = async (attemptIds, action) => {
  const response = await axios.put(`${API_URL}/batch`, { attemptIds, action });
  return response.data;
};

export default {
  getAttempts,
  getAttemptDetails,
  reviewAttempt,
  updateAnswerFeedback,
  getAttemptStats,
  batchUpdateAttempts
};