import React, { useContext, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { CircularProgress, Box, Typography } from '@mui/material';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, currentUser, loading, verifyToken } = useContext(AuthContext);
  const location = useLocation();

  // Re-verify token on protected route access for enhanced security
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      verifyToken();
    }
  }, [verifyToken, loading, isAuthenticated]);

  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh' 
        }}
      >
        <CircularProgress size={40} />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Verifying your session...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && currentUser.role !== requiredRole) {
    // Redirect to dashboard if user doesn't have required role
    return (
      <Navigate 
        to="/dashboard" 
        state={{ 
          accessDenied: true, 
          message: `You need ${requiredRole} privileges to access this page` 
        }} 
        replace 
      />
    );
  }

  return children;
};

export default ProtectedRoute;