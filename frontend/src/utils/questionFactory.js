/**
 * Question Factory Utility
 * Provides helper functions for creating and managing question instances
 * 
 * Requirements:
 * - Support for single-select MCQ (4.1)
 * - Support for multi-select MCQ (4.2)
 * - Support for free text questions (4.3)
 * - Support for answer changes (4.4)
 * - Support for probability values in multi-select MCQs (4.5)
 */

import { Question, SingleSelectQuestion, MultiSelectQuestion, FreeTextQuestion } from '../models/Question';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a new single select question
 * @param {string} text - The question text
 * @param {Array} options - Array of options with text and isCorrect properties
 * @param {number} points - Points for the question
 * @returns {SingleSelectQuestion} A new single select question instance
 */
export const createSingleSelectQuestion = (text, options, points = 1) => {
  // Generate IDs for options if they don't have them
  const optionsWithIds = options.map(option => ({
    id: option.id || uuidv4(),
    text: option.text,
    isCorrect: option.isCorrect
  }));
  
  return new SingleSelectQuestion(uuidv4(), text, optionsWithIds, points);
};

/**
 * Creates a new multi select question
 * @param {string} text - The question text
 * @param {Array} options - Array of options with text, isCorrect and optional probability properties
 * @param {number} points - Points for the question
 * @returns {MultiSelectQuestion} A new multi select question instance
 */
export const createMultiSelectQuestion = (text, options, points = 1) => {
  // Generate IDs for options if they don't have them
  const optionsWithIds = options.map(option => ({
    id: option.id || uuidv4(),
    text: option.text,
    isCorrect: option.isCorrect,
    probability: option.probability
  }));
  
  return new MultiSelectQuestion(uuidv4(), text, optionsWithIds, points);
};

/**
 * Creates a new free text question
 * @param {string} text - The question text
 * @param {string} correctAnswer - Optional correct answer
 * @param {Array} keywords - Optional array of keywords for partial matching
 * @param {number} points - Points for the question
 * @param {number} maxLength - Optional maximum length for the answer
 * @returns {FreeTextQuestion} A new free text question instance
 */
export const createFreeTextQuestion = (text, correctAnswer = null, keywords = [], points = 1, maxLength = 1000) => {
  const question = new FreeTextQuestion(uuidv4(), text, correctAnswer, points, maxLength);
  
  if (keywords.length > 0) {
    question.setKeywords(keywords);
  }
  
  return question;
};

/**
 * Creates a question from API data
 * @param {Object} data - Question data from API
 * @returns {Question} A question instance of the appropriate type
 */
export const createQuestionFromData = (data) => {
  return Question.fromData(data);
};

/**
 * Validates a collection of questions
 * @param {Array} questions - Array of question instances
 * @returns {boolean} True if all questions are valid
 */
export const validateQuestions = (questions) => {
  if (!Array.isArray(questions) || questions.length === 0) {
    return false;
  }
  
  return questions.every(question => question.isValid());
};

/**
 * Converts questions to format suitable for API submission
 * @param {Array} questions - Array of question instances
 * @returns {Array} Array of plain objects for API submission
 */
export const questionsToApiFormat = (questions) => {
  if (!Array.isArray(questions)) {
    return [];
  }
  
  return questions.map(question => question.toJSON());
};

/**
 * Creates questions from API data
 * @param {Array} questionsData - Array of question data from API
 * @returns {Array} Array of question instances
 */
export const createQuestionsFromData = (questionsData) => {
  if (!Array.isArray(questionsData)) {
    return [];
  }
  
  return questionsData.map(data => createQuestionFromData(data));
};