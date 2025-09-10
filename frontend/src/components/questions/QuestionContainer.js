import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * Container component for all question types
 * Provides consistent styling and structure for question components
 */
const QuestionContainer = ({ 
  question, 
  children, 
  error = null,
  showPoints = true
}) => {
  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 3, 
        mb: 3, 
        border: error ? '1px solid #f44336' : 'none' 
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          {question.text}
        </Typography>
        {showPoints && (
          <Typography variant="subtitle2" color="text.secondary">
            {question.points} {question.points === 1 ? 'point' : 'points'}
          </Typography>
        )}
      </Box>
      
      {children}
      
      {error && (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}
    </Paper>
  );
};

QuestionContainer.propTypes = {
  question: PropTypes.object.isRequired,
  children: PropTypes.node.isRequired,
  error: PropTypes.string,
  showPoints: PropTypes.bool
};

export default QuestionContainer;