import React, { createContext, useState, useEffect, useCallback } from 'react';
import jwt_decode from 'jwt-decode';
import axios from '../utils/axiosConfig';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Verify token function that can be reused
  const verifyToken = useCallback(async () => {
    try {
      setLoading(true);
      // Try to verify token with the backend
      const response = await axios.get('/api/auth/verify');
      
      if (response.data.status === 'success') {
        setCurrentUser(response.data.user);
        setIsAuthenticated(true);
        
        // Also ensure the token is in localStorage and axios headers
        const token = localStorage.getItem('token');
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
      } else {
        // If verification fails, clear auth state
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    } catch (err) {
      // If verification request fails, check localStorage token as fallback
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const decoded = jwt_decode(token);
          const currentTime = Date.now() / 1000;
          
          if (decoded.exp < currentTime) {
            // Token expired
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
            setIsAuthenticated(false);
            setCurrentUser(null);
          } else {
            // Valid token
            setCurrentUser({
              id: decoded.id,
              username: decoded.username,
              role: decoded.role
            });
            setIsAuthenticated(true);
            // Set axios default header
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          }
        } catch (tokenErr) {
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  const login = async (username, password) => {
    try {
      setError(null);
      setSuccessMessage(null);
      const response = await axios.post('/api/auth/login', { username, password });
      const { token, user, isFirstUser, message } = response.data;
      
      // Store token in localStorage as backup
      localStorage.setItem('token', token);
      
      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Update auth state
      setCurrentUser(user);
      setIsAuthenticated(true);
      
      // Show success message for first-time admin creation
      if (isFirstUser) {
        setSuccessMessage(message || 'Admin account created successfully! Welcome to Quiz Web App.');
      }
      
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      return false;
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint to clear cookies
      await axios.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear local storage and state regardless of API success
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setCurrentUser(null);
      setIsAuthenticated(false);
    }
  };

  const value = {
    currentUser,
    isAuthenticated,
    loading,
    error,
    successMessage,
    login,
    logout,
    verifyToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};