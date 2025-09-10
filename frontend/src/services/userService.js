import axios from '../utils/axiosConfig';

/**
 * Get all users with optional filtering, sorting, and pagination
 * @param {Object} params - Query parameters
 * @returns {Promise} - Promise with user data
 */
export const getUsers = async (params = {}) => {
  try {
    const response = await axios.get('/api/users', { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Get a single user by ID
 * @param {string} userId - User ID
 * @returns {Promise} - Promise with user data
 */
export const getUser = async (userId) => {
  try {
    const response = await axios.get(`/api/users/${userId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Promise} - Promise with created user data
 */
export const createUser = async (userData) => {
  try {
    const response = await axios.post('/api/users', userData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Update a user
 * @param {string} userId - User ID
 * @param {Object} userData - User data to update
 * @returns {Promise} - Promise with updated user data
 */
export const updateUser = async (userId, userData) => {
  try {
    const response = await axios.put(`/api/users/${userId}`, userData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Delete a user
 * @param {string} userId - User ID
 * @returns {Promise} - Promise with deletion status
 */
export const deleteUser = async (userId) => {
  try {
    const response = await axios.delete(`/api/users/${userId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Block or unblock a user
 * @param {string} userId - User ID
 * @param {boolean} isBlocked - Block status
 * @returns {Promise} - Promise with updated user data
 */
export const toggleBlockUser = async (userId, isBlocked) => {
  try {
    const response = await axios.put(`/api/users/${userId}/block`, { isBlocked });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Reset a user's password
 * @param {string} userId - User ID
 * @param {string} newPassword - New password
 * @returns {Promise} - Promise with updated user data
 */
export const resetPassword = async (userId, newPassword) => {
  try {
    const response = await axios.put(`/api/users/${userId}/password`, { newPassword });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Get user statistics
 * @returns {Promise} - Promise with user statistics
 */
export const getUserStats = async () => {
  try {
    const response = await axios.get('/api/users/count/stats');
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};