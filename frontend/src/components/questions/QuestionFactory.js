import React from 'react';
import PropTypes from 'prop-types';
import { Question } from '../../models/Question';
import SingleSelectQuestionComponent from './SingleSelectQuestionComponent';
import MultiSelectQuestionComponent from './MultiSelectQuestionComponent';
import FreeTextQuestionComponent from './FreeTextQuestionComponent';
import { updateQuestionResponse } from '../../utils/questionValidator';

/**
 * Question Factory Component
 * Renders the appropriate question component based on question type
 * Handles answer change handling for all question types
 * 
 * Implements:
 * - Support for single-select MCQ (4.1)
 * - Support for multi-select MCQ (4.2)
 * - Support for free text questions (4.3)
 * - Support for answer changes (4.4)
 * - Support for probability values in multi-select MCQs (4.5)
 */
const QuestionFactory = ({ 
  question, 
  onResponseChange,
  error = null,
  disabled = false,
  showFeedback = false
}) => {
  // Handle response changes for any question type
  const handleResponseChange = (response) => {
    // Update the question's response
    const updated = updateQuestionResponse(question, response);
    
    // Call the parent component's callback if provided
    if (updated && onResponseChange) {
      onResponseChange(question.id || question._id, response, question.type);
    }
  };

  // Render the appropriate component based on question type
  switch (question.type) {
    case 'single-select':
      return (
        <SingleSelectQuestionComponent
          question={question}
          onChange={handleResponseChange}
          error={error}
          disabled={disabled}
          showFeedback={showFeedback}
        />
      );
    case 'multi-select':
      return (
        <MultiSelectQuestionComponent
          question={question}
          onChange={handleResponseChange}
          error={error}
          disabled={disabled}
          showFeedback={showFeedback}
        />
      );
    case 'free-text':
      return (
        <FreeTextQuestionComponent
          question={question}
          onChange={handleResponseChange}
          error={error}
          disabled={disabled}
          showFeedback={showFeedback}
        />
      );
    default:
      console.error(`Unsupported question type: ${question.type}`);
      return null;
  }
};

QuestionFactory.propTypes = {
  question: PropTypes.instanceOf(Question).isRequired,
  onResponseChange: PropTypes.func,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  showFeedback: PropTypes.bool
};

export default QuestionFactory;