/**
 * Question Validator Utility
 * Provides validation functions for question responses
 * 
 * Requirements:
 * - Support for single-select MCQ (4.1)
 * - Support for multi-select MCQ (4.2)
 * - Support for free text questions (4.3)
 * - Support for answer changes (4.4)
 * - Support for probability values in multi-select MCQs (4.5)
 */

import { Question, SingleSelectQuestion, MultiSelectQuestion, FreeTextQuestion } from '../models/Question';

/**
 * Validates a response for a given question
 * @param {Question} question - The question object
 * @param {any} response - The user's response (format depends on question type)
 * @returns {boolean} True if the response is valid for the question type
 */
export const validateQuestionResponse = (question, response) => {
  if (!question) return false;
  
  switch (question.type) {
    case 'single-select':
      return validateSingleSelectResponse(question, response);
    case 'multi-select':
      return validateMultiSelectResponse(question, response);
    case 'free-text':
      return validateFreeTextResponse(question, response);
    default:
      return false;
  }
};

/**
 * Validates a single select question response
 * @param {SingleSelectQuestion} question - The single select question
 * @param {string} selectedOptionId - The ID of the selected option
 * @returns {boolean} True if valid
 */
export const validateSingleSelectResponse = (question, selectedOptionId) => {
  if (!(question instanceof SingleSelectQuestion)) return false;
  return question.validateResponse(selectedOptionId);
};

/**
 * Validates a multi select question response
 * @param {MultiSelectQuestion} question - The multi select question
 * @param {string[]} selectedOptionIds - Array of selected option IDs
 * @returns {boolean} True if valid
 */
export const validateMultiSelectResponse = (question, selectedOptionIds) => {
  if (!(question instanceof MultiSelectQuestion)) return false;
  return question.validateResponse(selectedOptionIds);
};

/**
 * Validates a free text question response
 * @param {FreeTextQuestion} question - The free text question
 * @param {string} textAnswer - The text answer provided
 * @returns {boolean} True if valid
 */
export const validateFreeTextResponse = (question, textAnswer) => {
  if (!(question instanceof FreeTextQuestion)) return false;
  return question.validateResponse(textAnswer);
};

/**
 * Updates a question with a user response
 * Supports requirement 4.4 - When a user changes their answer
 * @param {Question} question - The question object
 * @param {any} response - The user's response (format depends on question type)
 * @returns {boolean} True if the response was valid and set successfully
 */
export const updateQuestionResponse = (question, response) => {
  if (!question) return false;
  return question.setResponse(response);
};

/**
 * Evaluates a response for a given question and returns the score and evaluation details
 * @param {Question} question - The question object
 * @param {any} response - The user's response (format depends on question type)
 * @returns {Object} Evaluation result with score and other details
 */
export const evaluateQuestionResponse = (question, response) => {
  if (!question) return { score: 0, isCorrect: false, requiresManualReview: true };
  
  // If no response is provided, use the stored response in the question if available
  const responseToEvaluate = response !== undefined ? response : question.getResponse();
  
  if (responseToEvaluate === null || responseToEvaluate === undefined) {
    return { score: 0, isCorrect: false, requiresManualReview: true };
  }
  
  return question.evaluateResponse(responseToEvaluate);
};

/**
 * Formats a response for submission to the API
 * @param {string} questionId - The question ID
 * @param {string} questionType - The question type
 * @param {any} response - The user's response
 * @returns {Object} Formatted response object for API submission
 */
export const formatResponseForSubmission = (questionId, questionType, response) => {
  switch (questionType) {
    case 'single-select':
      return {
        questionId,
        selectedOptions: [response],
        textAnswer: null
      };
    case 'multi-select':
      return {
        questionId,
        selectedOptions: Array.isArray(response) ? response : [],
        textAnswer: null
      };
    case 'free-text':
      return {
        questionId,
        selectedOptions: [],
        textAnswer: response
      };
    default:
      return {
        questionId,
        selectedOptions: [],
        textAnswer: null
      };
  }
};

/**
 * Validates if all required questions have responses
 * @param {Question[]} questions - Array of question objects
 * @returns {boolean} True if all questions have valid responses
 */
export const validateAllResponses = (questions) => {
  if (!Array.isArray(questions) || questions.length === 0) return false;
  
  return questions.every(question => {
    const response = question.getResponse();
    return response !== null && question.validateResponse(response);
  });
};

/**
 * Calculates the total score for a set of questions based on current responses
 * @param {Question[]} questions - Array of question objects
 * @returns {Object} Object containing total score and max possible score
 */
export const calculateTotalScore = (questions) => {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { score: 0, maxScore: 0, requiresManualReview: false };
  }
  
  let totalScore = 0;
  let maxScore = 0;
  let requiresManualReview = false;
  
  questions.forEach(question => {
    const response = question.getResponse();
    maxScore += question.points;
    
    if (response !== null) {
      const evaluation = question.evaluateResponse(response);
      totalScore += evaluation.score;
      requiresManualReview = requiresManualReview || evaluation.requiresManualReview;
    }
  });
  
  return {
    score: parseFloat(totalScore.toFixed(2)),
    maxScore,
    requiresManualReview
  };
};