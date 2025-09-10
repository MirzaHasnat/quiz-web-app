import React, { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import QuizPage from './pages/QuizPage';
import QuizAttemptPage from './pages/QuizAttemptPage';
import QuizResults from './components/QuizResults';
import NotFound from './pages/NotFound';

function App() {
  // Create a theme instance with better color palette
  const theme = useMemo(() => createTheme({
    palette: {
      mode: 'light',
      primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
      },
      secondary: {
        main: '#9c27b0',
        light: '#ba68c8',
        dark: '#7b1fa2',
      },
      error: {
        main: '#d32f2f',
      },
      warning: {
        main: '#ed6c02',
      },
      info: {
        main: '#0288d1',
      },
      success: {
        main: '#2e7d32',
      },
      background: {
        default: '#f5f5f5',
        paper: '#ffffff',
      },
    },
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            textTransform: 'none',
            fontWeight: 500,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
  }), []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* User Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <UserDashboard />
            </ProtectedRoute>
          } />

          <Route path="/quiz/:quizId" element={
            <ProtectedRoute>
              <QuizPage />
            </ProtectedRoute>
          } />

          <Route path="/quiz/:quizId/attempt/:attemptId" element={
            <ProtectedRoute>
              <QuizAttemptPage />
            </ProtectedRoute>
          } />

          <Route path="/quiz/:quizId/results" element={
            <ProtectedRoute>
              <QuizResults />
            </ProtectedRoute>
          } />

          {/* Admin Protected Routes */}
          <Route path="/admin/*" element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;