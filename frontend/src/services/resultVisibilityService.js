import axios from '../utils/axiosConfig';

// Update result visibility settings for a quiz
export const updateResultVisibility = async (quizId, showResultsImmediately) => {
  const response = await axios.put(`/api/quizzes/${quizId}/result-visibility`, {
    showResultsImmediately
  });
  return response.data;
};

// Get result visibility status for a quiz
export const getResultVisibility = async (quizId) => {
  const response = await axios.get(`/api/quizzes/${quizId}/result-visibility`);
  return response.data;
};

// Complete manual review for an attempt
export const completeReview = async (attemptId) => {
  const response = await axios.put(`/api/attempts/${attemptId}/complete-review`);
  return response.data;
};

// Unreview an attempt (mark as submitted)
export const unreviewAttempt = async (attemptId) => {
  const response = await axios.put(`/api/attempts/${attemptId}/unreview`);
  return response.data;
};

// Check if results are visible for a specific attempt
export const checkResultVisibility = async (attemptId) => {
  const response = await axios.get(`/api/attempts/${attemptId}/result-visibility`);
  return response.data;
};

// Get attempts requiring review
export const getPendingReviews = async (page = 1, limit = 10) => {
  const response = await axios.get(`/api/attempts/pending-review?page=${page}&limit=${limit}`);
  return response.data;
};

export default {
  updateResultVisibility,
  getResultVisibility,
  completeReview,
  unreviewAttempt,
  checkResultVisibility,
  getPendingReviews
};