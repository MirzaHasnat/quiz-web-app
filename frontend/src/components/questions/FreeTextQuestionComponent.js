import React from 'react';
import PropTypes from 'prop-types';
import { 
  FormControl, 
  TextField, 
  FormHelperText,
  Box,
  Typography,
  Chip
} from '@mui/material';
import QuestionContainer from './QuestionContainer';
import { FreeTextQuestion } from '../../models/Question';

/**
 * Free Text Question Component
 * Renders a free text question with a text input field
 * Implements requirement 4.3 - When encountering a free text question THEN the system SHALL provide a text input field for typed responses
 * Implements requirement 4.4 - When a user changes their answer THEN the system SHALL update the response accordingly
 */
const FreeTextQuestionComponent = ({ 
  question, 
  onChange, 
  error = null,
  disabled = false,
  showFeedback = false
}) => {
  if (!(question instanceof FreeTextQuestion)) {
    console.error('Invalid question type provided to FreeTextQuestionComponent');
    return null;
  }

  // Get current response
  const currentResponse = question.getResponse() || '';
  
  // Get evaluation if showing feedback
  const evaluation = showFeedback && currentResponse 
    ? question.evaluateResponse(currentResponse) 
    : null;

  const handleChange = (event) => {
    const textValue = event.target.value;
    if (onChange && !disabled) {
      onChange(textValue);
    }
  };

  // Calculate remaining characters if maxLength is set
  const remainingChars = question.maxLength > 0 
    ? question.maxLength - (currentResponse?.length || 0)
    : null;

  return (
    <QuestionContainer question={question} error={error}>
      <FormControl component="fieldset" fullWidth error={Boolean(error)} disabled={disabled}>
        <TextField
          multiline
          rows={4}
          value={currentResponse}
          onChange={handleChange}
          placeholder="Type your answer here..."
          variant="outlined"
          fullWidth
          error={Boolean(error)}
          disabled={disabled}
          inputProps={{ 
            maxLength: question.maxLength > 0 ? question.maxLength : undefined 
          }}
          helperText={
            question.maxLength > 0 
              ? `${remainingChars} characters remaining`
              : undefined
          }
        />
        
        {showFeedback && evaluation && (
          <Box sx={{ mt: 2 }}>
            <FormHelperText 
              sx={{ 
                color: evaluation.isCorrect ? 'success.main' : 'info.main',
                fontWeight: 'medium'
              }}
            >
              {evaluation.feedback}
            </FormHelperText>
            
            {/* Show matched keywords if available */}
            {evaluation.matchedKeywords && evaluation.matchedKeywords.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Matched keywords:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {evaluation.matchedKeywords.map((keyword, index) => (
                    <Chip 
                      key={index} 
                      label={keyword} 
                      size="small" 
                      color="success" 
                      variant="outlined" 
                    />
                  ))}
                </Box>
              </Box>
            )}
            
            {evaluation.requiresManualReview && (
              <FormHelperText sx={{ mt: 1 }}>
                Your answer requires manual review for final scoring.
              </FormHelperText>
            )}
          </Box>
        )}
        
        {error && <FormHelperText error>{error}</FormHelperText>}
      </FormControl>
    </QuestionContainer>
  );
};

FreeTextQuestionComponent.propTypes = {
  question: PropTypes.instanceOf(FreeTextQuestion).isRequired,
  onChange: PropTypes.func,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  showFeedback: PropTypes.bool
};

export default FreeTextQuestionComponent;