import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  SingleSelectQuestion, 
  MultiSelectQuestion, 
  FreeTextQuestion 
} from '../../../models/Question';
import SingleSelectQuestionComponent from '../SingleSelectQuestionComponent';
import MultiSelectQuestionComponent from '../MultiSelectQuestionComponent';
import FreeTextQuestionComponent from '../FreeTextQuestionComponent';
import QuestionFactory from '../QuestionFactory';

// Mock data for testing
const singleSelectQuestion = new SingleSelectQuestion(
  'q1',
  'What is the capital of France?',
  [
    { id: 'o1', text: 'Paris', isCorrect: true },
    { id: 'o2', text: 'London', isCorrect: false },
    { id: 'o3', text: 'Berlin', isCorrect: false }
  ],
  1
);

const multiSelectQuestion = new MultiSelectQuestion(
  'q2',
  'Which of the following are mammals?',
  [
    { id: 'o1', text: 'Dog', isCorrect: true },
    { id: 'o2', text: 'Cat', isCorrect: true },
    { id: 'o3', text: 'Shark', isCorrect: false },
    { id: 'o4', text: 'Dolphin', isCorrect: true }
  ],
  2
);

const multiSelectWithProbabilityQuestion = new MultiSelectQuestion(
  'q3',
  'Which programming languages are object-oriented?',
  [
    { id: 'o1', text: 'Java', isCorrect: true, probability: 100 },
    { id: 'o2', text: 'C++', isCorrect: true, probability: 100 },
    { id: 'o3', text: 'C', isCorrect: false, probability: 0 },
    { id: 'o4', text: 'JavaScript', isCorrect: true, probability: 80 }
  ],
  2
);

const freeTextQuestion = new FreeTextQuestion(
  'q4',
  'Explain the concept of inheritance in OOP.',
  null,
  3,
  500
);

describe('SingleSelectQuestionComponent', () => {
  test('renders question text and options', () => {
    render(<SingleSelectQuestionComponent question={singleSelectQuestion} />);
    
    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('London')).toBeInTheDocument();
    expect(screen.getByText('Berlin')).toBeInTheDocument();
  });
  
  test('handles option selection', () => {
    const handleChange = jest.fn();
    render(<SingleSelectQuestionComponent question={singleSelectQuestion} onChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Paris'));
    expect(handleChange).toHaveBeenCalledWith('o1');
  });
  
  test('displays error message when provided', () => {
    render(<SingleSelectQuestionComponent question={singleSelectQuestion} error="Please select an option" />);
    expect(screen.getByText('Please select an option')).toBeInTheDocument();
  });
});

describe('MultiSelectQuestionComponent', () => {
  test('renders question text and options', () => {
    render(<MultiSelectQuestionComponent question={multiSelectQuestion} />);
    
    expect(screen.getByText('Which of the following are mammals?')).toBeInTheDocument();
    expect(screen.getByText('Dog')).toBeInTheDocument();
    expect(screen.getByText('Cat')).toBeInTheDocument();
    expect(screen.getByText('Shark')).toBeInTheDocument();
    expect(screen.getByText('Dolphin')).toBeInTheDocument();
  });
  
  test('handles option selection', () => {
    const handleChange = jest.fn();
    render(<MultiSelectQuestionComponent question={multiSelectQuestion} onChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Dog'));
    expect(handleChange).toHaveBeenCalledWith(['o1']);
    
    // Reset mock and set initial response
    handleChange.mockReset();
    multiSelectQuestion.setResponse(['o1']);
    
    render(<MultiSelectQuestionComponent question={multiSelectQuestion} onChange={handleChange} />);
    fireEvent.click(screen.getByText('Cat'));
    expect(handleChange).toHaveBeenCalledWith(['o1', 'o2']);
  });
  
  test('displays error message when provided', () => {
    render(<MultiSelectQuestionComponent question={multiSelectQuestion} error="Please select at least one option" />);
    expect(screen.getByText('Please select at least one option')).toBeInTheDocument();
  });
});

describe('FreeTextQuestionComponent', () => {
  test('renders question text and textarea', () => {
    render(<FreeTextQuestionComponent question={freeTextQuestion} />);
    
    expect(screen.getByText('Explain the concept of inheritance in OOP.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your answer here...')).toBeInTheDocument();
  });
  
  test('handles text input', () => {
    const handleChange = jest.fn();
    render(<FreeTextQuestionComponent question={freeTextQuestion} onChange={handleChange} />);
    
    fireEvent.change(screen.getByPlaceholderText('Type your answer here...'), {
      target: { value: 'Inheritance is a mechanism where a new class inherits properties and behaviors from an existing class.' }
    });
    
    expect(handleChange).toHaveBeenCalledWith('Inheritance is a mechanism where a new class inherits properties and behaviors from an existing class.');
  });
  
  test('displays character count when maxLength is set', () => {
    render(<FreeTextQuestionComponent question={freeTextQuestion} />);
    expect(screen.getByText('500 characters remaining')).toBeInTheDocument();
  });
  
  test('displays error message when provided', () => {
    render(<FreeTextQuestionComponent question={freeTextQuestion} error="Please provide an answer" />);
    expect(screen.getByText('Please provide an answer')).toBeInTheDocument();
  });
});

describe('QuestionFactory', () => {
  test('renders SingleSelectQuestionComponent for single-select questions', () => {
    render(<QuestionFactory question={singleSelectQuestion} />);
    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
    expect(screen.getByText('Paris')).toBeInTheDocument();
  });
  
  test('renders MultiSelectQuestionComponent for multi-select questions', () => {
    render(<QuestionFactory question={multiSelectQuestion} />);
    expect(screen.getByText('Which of the following are mammals?')).toBeInTheDocument();
    expect(screen.getByText('Dog')).toBeInTheDocument();
  });
  
  test('renders FreeTextQuestionComponent for free-text questions', () => {
    render(<QuestionFactory question={freeTextQuestion} />);
    expect(screen.getByText('Explain the concept of inheritance in OOP.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your answer here...')).toBeInTheDocument();
  });
  
  test('handles response changes and calls onResponseChange callback', () => {
    const handleResponseChange = jest.fn();
    render(<QuestionFactory question={singleSelectQuestion} onResponseChange={handleResponseChange} />);
    
    fireEvent.click(screen.getByText('Paris'));
    expect(handleResponseChange).toHaveBeenCalledWith('q1', 'o1', 'single-select');
  });
});