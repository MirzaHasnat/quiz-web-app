import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
  Paper
} from '@mui/material';
import {
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';

const NotFound = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/dashboard');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '80vh',
        textAlign: 'center'
      }}>
        <Paper elevation={2} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h1" component="h1" sx={{ 
            fontSize: '6rem', 
            fontWeight: 'bold', 
            color: 'primary.main',
            mb: 2
          }}>
            404
          </Typography>
          
          <Typography variant="h4" component="h2" gutterBottom>
            Page Not Found
          </Typography>
          
          <Typography variant="body1" color="text.secondary" paragraph>
            The page you're looking for doesn't exist or has been moved.
          </Typography>
          
          <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<HomeIcon />}
              onClick={handleGoHome}
            >
              Go to Dashboard
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={handleGoBack}
            >
              Go Back
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default NotFound;