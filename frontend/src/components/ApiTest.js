import React, { useState } from 'react';
import { Button, Box, Typography, Alert } from '@mui/material';
import axios from '../utils/axiosConfig';

const ApiTest = () => {
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const testApiConnection = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      // Test the health check endpoint
      const response = await axios.get('/api/auth/test');
      setTestResult({
        success: true,
        message: 'API connection successful!',
        data: response.data
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'API connection failed',
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
    } finally {
      setLoading(false);
    }
  };

  const testLoginEndpoint = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      // Test the login endpoint (should return validation error, not 404)
      const response = await axios.post('/api/auth/login', {});
    } catch (error) {
      setTestResult({
        success: error.response?.status === 400, // 400 is expected for validation error
        message: error.response?.status === 400 ? 'Login endpoint is working (validation error expected)' : 'Login endpoint failed',
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    } finally {
      setLoading(false);
    }
  };

  const testAdminCreation = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      // Test admin creation with sample credentials
      const response = await axios.post('/api/auth/login', {
        username: 'testadmin',
        password: 'testpassword123'
      });
      
      setTestResult({
        success: true,
        message: response.data.isFirstUser ? 'Admin user created successfully!' : 'Login successful (user already exists)',
        data: {
          user: response.data.user,
          isFirstUser: response.data.isFirstUser,
          message: response.data.message
        }
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Admin creation/login failed',
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    } finally {
      setLoading(false);
    }
  };

  const testQuizApi = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      // Test the quiz API endpoint
      const response = await axios.get('/api/quizzes');
      setTestResult({
        success: true,
        message: 'Quiz API working successfully!',
        data: {
          count: response.data.count,
          quizzes: response.data.data,
          pagination: response.data.pagination
        }
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Quiz API failed',
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    } finally {
      setLoading(false);
    }
  };

  const testQuizStart = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      // First get a quiz to test with
      const quizzesResponse = await axios.get('/api/quizzes');
      const quizzes = quizzesResponse.data.data;
      
      if (!quizzes || quizzes.length === 0) {
        setTestResult({
          success: false,
          message: 'No quizzes available to test quiz start',
          data: { quizzes: quizzes }
        });
        return;
      }
      
      const testQuizId = quizzes[0]._id;
      
      // Test starting a quiz attempt
      const attemptResponse = await axios.post(`/api/attempts/start/${testQuizId}`);
      
      setTestResult({
        success: true,
        message: 'Quiz start API working successfully!',
        data: {
          quizId: testQuizId,
          attempt: attemptResponse.data.data
        }
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Quiz start API failed',
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    } finally {
      setLoading(false);
    }
  };

  const testCreateQuizWithQuestions = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      // Create a test quiz
      const quizData = {
        title: 'Test Quiz with Questions',
        description: 'This is a test quiz created for testing purposes',
        duration: 30,
        isActive: true,
        showResultsImmediately: false
      };
      
      const quizResponse = await axios.post('/api/quizzes', quizData);
      const createdQuiz = quizResponse.data.data;
      
      // Add a single-select question
      const singleSelectQuestion = {
        type: 'single-select',
        text: 'What is the capital of France?',
        points: 1,
        options: [
          { text: 'London', isCorrect: false },
          { text: 'Berlin', isCorrect: false },
          { text: 'Paris', isCorrect: true },
          { text: 'Madrid', isCorrect: false }
        ]
      };
      
      await axios.post(`/api/quizzes/${createdQuiz._id}/questions`, singleSelectQuestion);
      
      // Add a multi-select question
      const multiSelectQuestion = {
        type: 'multi-select',
        text: 'Which of the following are programming languages?',
        points: 2,
        options: [
          { text: 'JavaScript', isCorrect: true },
          { text: 'HTML', isCorrect: false },
          { text: 'Python', isCorrect: true },
          { text: 'CSS', isCorrect: false }
        ]
      };
      
      await axios.post(`/api/quizzes/${createdQuiz._id}/questions`, multiSelectQuestion);
      
      // Add a free-text question
      const freeTextQuestion = {
        type: 'free-text',
        text: 'Explain the concept of object-oriented programming.',
        points: 3,
        correctAnswer: 'Object-oriented programming is a programming paradigm based on objects and classes.'
      };
      
      await axios.post(`/api/quizzes/${createdQuiz._id}/questions`, freeTextQuestion);
      
      setTestResult({
        success: true,
        message: 'Test quiz with questions created successfully!',
        data: {
          quiz: createdQuiz,
          questionsAdded: 3
        }
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to create test quiz with questions',
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, margin: '0 auto' }}>
      <Typography variant="h5" gutterBottom>
        API Connection Test
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <Button 
          variant="contained" 
          onClick={testApiConnection}
          disabled={loading}
          sx={{ mr: 2, mb: 1 }}
        >
          Test Health Check
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={testLoginEndpoint}
          disabled={loading}
          sx={{ mr: 2, mb: 1 }}
        >
          Test Login Endpoint
        </Button>
        
        <Button 
          variant="contained" 
          color="secondary"
          onClick={testAdminCreation}
          disabled={loading}
          sx={{ mb: 1 }}
        >
          Test Admin Creation
        </Button>
        
        <Button 
          variant="outlined" 
          color="primary"
          onClick={testQuizApi}
          disabled={loading}
          sx={{ mb: 1, ml: 2 }}
        >
          Test Quiz API
        </Button>
        
        <Button 
          variant="contained" 
          color="warning"
          onClick={testQuizStart}
          disabled={loading}
          sx={{ mb: 1, ml: 2 }}
        >
          Test Quiz Start
        </Button>
        
        <Button 
          variant="outlined" 
          color="secondary"
          onClick={testCreateQuizWithQuestions}
          disabled={loading}
          sx={{ mb: 1, ml: 2 }}
        >
          Create Test Quiz
        </Button>
      </Box>

      {loading && (
        <Alert severity="info">Testing API connection...</Alert>
      )}

      {testResult && (
        <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
          <Typography variant="h6">{testResult.message}</Typography>
          {testResult.error && (
            <Typography variant="body2">Error: {testResult.error}</Typography>
          )}
          {testResult.status && (
            <Typography variant="body2">Status: {testResult.status} {testResult.statusText}</Typography>
          )}
          {testResult.data && (
            <Typography variant="body2" component="pre" sx={{ mt: 1, fontSize: '0.8rem' }}>
              {JSON.stringify(testResult.data, null, 2)}
            </Typography>
          )}
        </Alert>
      )}
    </Box>
  );
};

export default ApiTest;