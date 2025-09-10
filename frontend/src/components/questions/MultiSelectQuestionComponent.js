import React from 'react';
import PropTypes from 'prop-types';
import { 
  FormControl, 
  FormControlLabel, 
  FormGroup, 
  Checkbox, 
  FormHelperText,
  Tooltip,
  Box,
  LinearProgress,
  Typography
} from '@mui/material';
import QuestionContainer from './QuestionContainer';
import { MultiSelectQuestion } from '../../models/Question';

/**
 * Multi Select Question Component
 * Renders a multi-select multiple choice question with checkboxes
 * Implements requirement 4.2 - When encountering a multi-select MCQ THEN the system SHALL allow selection of multiple options
 * Implements requirement 4.4 - When a user changes their answer THEN the system SHALL update the response accordingly
 * Implements requirement 4.5 - IF a multi-select MCQ has probability values THEN the system SHALL store these for admin evaluation
 */
const MultiSelectQuestionComponent = ({ 
  question, 
  onChange, 
  error = null,
  disabled = false,
  showFeedback = false
}) => {
  if (!(question instanceof MultiSelectQuestion)) {
    console.error('Invalid question type provided to MultiSelectQuestionComponent');
    return null;
  }

  // Get current response (array of selected option IDs)
  const currentResponse = question.getResponse() || [];
  
  // Check if this question uses probability values
  const usesProbability = question.usesProbabilityValues();
  
  // Get evaluation if showing feedback
  const evaluation = showFeedback && currentResponse.length > 0
    ? question.evaluateResponse(currentResponse) 
    : null;

  const handleChange = (optionId) => (event) => {
    if (disabled) return;
    
    const isChecked = event.target.checked;
    let newSelectedOptions;
    
    if (isChecked) {
      // Add option to selected options
      newSelectedOptions = [...currentResponse, optionId];
    } else {
      // Remove option from selected options
      newSelectedOptions = currentResponse.filter(id => id !== optionId);
    }
    
    if (onChange) {
      onChange(newSelectedOptions);
    }
  };

  return (
    <QuestionContainer question={question} error={error}>
      <FormControl component="fieldset" fullWidth error={Boolean(error)} disabled={disabled}>
        <FormGroup>
          {question.options.map((option) => {
            const optionId = option.id || option._id?.toString();
            const isSelected = currentResponse.includes(optionId);
            
            // Don't show correct/incorrect styling during quiz attempts
            const labelStyle = {};
            
            // Create the checkbox component
            const checkboxComponent = (
              <FormControlLabel
                key={optionId}
                control={
                  <Checkbox 
                    checked={isSelected} 
                    onChange={handleChange(optionId)} 
                  />
                }
                label={option.text}
                sx={labelStyle}
              />
            );
            
            // If using probability values and showing feedback, wrap in tooltip with probability bar
            if (usesProbability && showFeedback && option.probability !== undefined) {
              return (
                <Box key={optionId}>
                  <Tooltip 
                    title={
                      <Box sx={{ p: 1, width: 200 }}>
                        <Typography variant="caption">Probability: {option.probability}%</Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={option.probability} 
                          sx={{ 
                            mt: 0.5,
                            backgroundColor: 'grey.300',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: option.isCorrect ? 'success.main' : 'error.main'
                            }
                          }}
                        />
                      </Box>
                    }
                    arrow
                  >
                    {checkboxComponent}
                  </Tooltip>
                </Box>
              );
            }
            
            return checkboxComponent;
          })}
        </FormGroup>
        
        {showFeedback && evaluation && (
          <FormHelperText 
            sx={{ 
              color: evaluation.isFullyCorrect ? 'success.main' : 'warning.main',
              fontWeight: 'medium',
              mt: 1
            }}
          >
            {evaluation.feedback}
          </FormHelperText>
        )}
        
        {error && <FormHelperText error>{error}</FormHelperText>}
      </FormControl>
    </QuestionContainer>
  );
};

MultiSelectQuestionComponent.propTypes = {
  question: PropTypes.instanceOf(MultiSelectQuestion).isRequired,
  onChange: PropTypes.func,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  showFeedback: PropTypes.bool
};

export default MultiSelectQuestionComponent;