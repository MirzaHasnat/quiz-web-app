import React, { useState, useContext, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Paper,
  Divider
} from '@mui/material';

// Import admin components
import UserManagement from '../components/admin/UserManagement';
import QuizManagement from '../components/admin/QuizManagement';
import QuizActivation from '../components/admin/QuizActivation';
import AttemptReview from '../components/admin/AttemptReview';
import AttemptReviewDetail from '../components/admin/AttemptReviewDetail';

const AdminDashboard = () => {
  const [tabValue, setTabValue] = useState(0);
  const { currentUser, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Set active tab based on current path
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/admin/quizzes')) {
      setTabValue(1);
    } else if (path.includes('/admin/activation')) {
      setTabValue(2);
    } else if (path.includes('/admin/attempts')) {
      setTabValue(3);
    } else {
      setTabValue(0);
    }
  }, [location.pathname]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    
    switch(newValue) {
      case 0:
        navigate('/admin/users');
        break;
      case 1:
        navigate('/admin/quizzes');
        break;
      case 2:
        navigate('/admin/activation');
        break;
      case 3:
        navigate('/admin/attempts');
        break;
      default:
        navigate('/admin');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Admin Dashboard
          </Typography>
          <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mr: 2, display: 'inline' }}>
              Logged in as: <strong>{currentUser?.username}</strong>
            </Typography>
            <Button variant="outlined" color="primary" onClick={handleLogout}>
              Logout
            </Button>
          </Box>
        </Box>

        <Paper sx={{ width: '100%', mb: 2 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            centered
          >
            <Tab label="User Management" />
            <Tab label="Quiz Management" />
            <Tab label="Quiz Activation" />
            <Tab label="Attempt Review" />
          </Tabs>
        </Paper>

        <Box sx={{ mt: 3 }}>
          <Routes>
            <Route path="/" element={<UserManagement />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/quizzes" element={<QuizManagement />} />
            <Route path="/activation" element={<QuizActivation />} />
            <Route path="/attempts" element={<AttemptReview />} />
            <Route path="/attempts/:attemptId" element={<AttemptReviewDetail />} />
            <Route path="/attempts/:attemptId/review" element={<AttemptReviewDetail />} />
          </Routes>
        </Box>
      </Box>
    </Container>
  );
};

export default AdminDashboard;