import React from 'react';
import PropTypes from 'prop-types';
import { 
  FormControl, 
  FormControlLabel, 
  RadioGroup, 
  Radio, 
  FormHelperText 
} from '@mui/material';
import QuestionContainer from './QuestionContainer';
import { SingleSelectQuestion } from '../../models/Question';

/**
 * Single Select Question Component
 * Renders a single-select multiple choice question with radio buttons
 * Implements requirement 4.1 - When encountering a single-select MCQ THEN the system SHALL allow selection of exactly one option
 * Implements requirement 4.4 - When a user changes their answer THEN the system SHALL update the response accordingly
 */
const SingleSelectQuestionComponent = ({ 
  question, 
  onChange, 
  error = null,
  disabled = false,
  showFeedback = false
}) => {
  if (!(question instanceof SingleSelectQuestion)) {
    console.error('Invalid question type provided to SingleSelectQuestionComponent');
    return null;
  }

  const handleChange = (event) => {
    const selectedOptionId = event.target.value;
    if (onChange && !disabled) {
      onChange(selectedOptionId);
    }
  };

  // Get current response from props or question instance
  const currentResponse = question.getResponse();
  
  // Get evaluation if showing feedback
  const evaluation = showFeedback && currentResponse 
    ? question.evaluateResponse(currentResponse) 
    : null;

  return (
    <QuestionContainer question={question} error={error}>
      <FormControl component="fieldset" fullWidth error={Boolean(error)} disabled={disabled}>
        <RadioGroup
          value={currentResponse || ''}
          onChange={handleChange}
        >
          {question.options.map((option) => {
            const optionId = option.id || option._id?.toString();
            const isSelected = currentResponse === optionId;
            
            // Don't show correct/incorrect styling during quiz attempts
            const labelStyle = {};
            
            return (
              <FormControlLabel
                key={optionId}
                value={optionId}
                control={<Radio />}
                label={option.text}
                sx={labelStyle}
              />
            );
          })}
        </RadioGroup>
        
        {showFeedback && evaluation && (
          <FormHelperText 
            sx={{ 
              color: evaluation.isCorrect ? 'success.main' : 'error.main',
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

SingleSelectQuestionComponent.propTypes = {
  question: PropTypes.instanceOf(SingleSelectQuestion).isRequired,
  onChange: PropTypes.func,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  showFeedback: PropTypes.bool
};

export default SingleSelectQuestionComponent;