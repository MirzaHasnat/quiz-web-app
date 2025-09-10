/**
 * Tests for Question model classes
 * Verifies that the question models meet all requirements:
 * - Support for single-select MCQ (4.1)
 * - Support for multi-select MCQ (4.2)
 * - Support for free text questions (4.3)
 * - Support for answer changes (4.4)
 * - Support for probability values in multi-select MCQs (4.5)
 */

import { Question, SingleSelectQuestion, MultiSelectQuestion, FreeTextQuestion } from '../Question';

describe('Question Base Class', () => {
  test('should create a base question with correct properties', () => {
    const question = new Question('q1', 'test-type', 'Test question?', 2);
    expect(question.id).toBe('q1');
    expect(question.type).toBe('test-type');
    expect(question.text).toBe('Test question?');
    expect(question.points).toBe(2);
    expect(question.userResponse).toBeNull();
  });

  test('should validate basic question properties', () => {
    const validQuestion = new Question('q1', 'test-type', 'Test question?');
    const invalidQuestion1 = new Question('', 'test-type', 'Test question?');
    const invalidQuestion2 = new Question('q1', '', 'Test question?');
    const invalidQuestion3 = new Question('q1', 'test-type', '');

    expect(validQuestion.isValid()).toBe(true);
    expect(invalidQuestion1.isValid()).toBe(false);
    expect(invalidQuestion2.isValid()).toBe(false);
    expect(invalidQuestion3.isValid()).toBe(false);
  });

  test('should create appropriate question type from data', () => {
    const singleSelectData = {
      id: 'q1',
      type: 'single-select',
      text: 'Single select question?',
      options: [
        { id: 'o1', text: 'Option 1', isCorrect: true },
        { id: 'o2', text: 'Option 2', isCorrect: false }
      ]
    };

    const multiSelectData = {
      id: 'q2',
      type: 'multi-select',
      text: 'Multi select question?',
      options: [
        { id: 'o1', text: 'Option 1', isCorrect: true },
        { id: 'o2', text: 'Option 2', isCorrect: true },
        { id: 'o3', text: 'Option 3', isCorrect: false }
      ]
    };

    const freeTextData = {
      id: 'q3',
      type: 'free-text',
      text: 'Free text question?',
      correctAnswer: 'correct answer'
    };

    const singleSelectQuestion = Question.fromData(singleSelectData);
    const multiSelectQuestion = Question.fromData(multiSelectData);
    const freeTextQuestion = Question.fromData(freeTextData);

    expect(singleSelectQuestion).toBeInstanceOf(SingleSelectQuestion);
    expect(multiSelectQuestion).toBeInstanceOf(MultiSelectQuestion);
    expect(freeTextQuestion).toBeInstanceOf(FreeTextQuestion);
  });

  test('should throw error for unknown question type', () => {
    const unknownTypeData = {
      id: 'q4',
      type: 'unknown-type',
      text: 'Unknown type question?'
    };

    expect(() => Question.fromData(unknownTypeData)).toThrow('Unknown question type');
  });

  test('should clone a question correctly', () => {
    const original = new SingleSelectQuestion('q1', 'Test question?', [
      { id: 'o1', text: 'Option 1', isCorrect: true },
      { id: 'o2', text: 'Option 2', isCorrect: false }
    ]);
    original.setResponse('o1');

    const cloned = original.clone();
    
    expect(cloned).toBeInstanceOf(SingleSelectQuestion);
    expect(cloned.id).toBe(original.id);
    expect(cloned.text).toBe(original.text);
    expect(cloned.userResponse).toBe(original.userResponse);
    expect(cloned.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'o1', text: 'Option 1', isCorrect: true }),
      expect.objectContaining({ id: 'o2', text: 'Option 2', isCorrect: false })
    ]));
  });
});

describe('SingleSelectQuestion', () => {
  // Test data
  const options = [
    { id: 'o1', text: 'Option 1', isCorrect: true },
    { id: 'o2', text: 'Option 2', isCorrect: false },
    { id: 'o3', text: 'Option 3', isCorrect: false }
  ];

  test('should create a single select question with correct properties', () => {
    const question = new SingleSelectQuestion('q1', 'Single select question?', options, 2);
    expect(question.id).toBe('q1');
    expect(question.type).toBe('single-select');
    expect(question.text).toBe('Single select question?');
    expect(question.points).toBe(2);
    expect(question.options).toEqual(options);
  });

  test('should validate single select question structure', () => {
    const validQuestion = new SingleSelectQuestion('q1', 'Valid question?', options);
    const invalidOptions1 = []; // Empty options
    const invalidOptions2 = [{ id: 'o1', text: 'Option 1', isCorrect: false }]; // No correct option
    const invalidOptions3 = [ // Multiple correct options
      { id: 'o1', text: 'Option 1', isCorrect: true },
      { id: 'o2', text: 'Option 2', isCorrect: true }
    ];

    const invalidQuestion1 = new SingleSelectQuestion('q1', 'Invalid question?', invalidOptions1);
    const invalidQuestion2 = new SingleSelectQuestion('q1', 'Invalid question?', invalidOptions2);
    const invalidQuestion3 = new SingleSelectQuestion('q1', 'Invalid question?', invalidOptions3);

    expect(validQuestion.isValid()).toBe(true);
    expect(invalidQuestion1.isValid()).toBe(false);
    expect(invalidQuestion2.isValid()).toBe(false);
    expect(invalidQuestion3.isValid()).toBe(false);
  });

  test('should validate response correctly', () => {
    const question = new SingleSelectQuestion('q1', 'Test question?', options);
    
    expect(question.validateResponse('o1')).toBe(true);
    expect(question.validateResponse('o2')).toBe(true);
    expect(question.validateResponse('o4')).toBe(false); // Non-existent option
    expect(question.validateResponse('')).toBe(false);
    expect(question.validateResponse(null)).toBe(false);
    expect(question.validateResponse(undefined)).toBe(false);
  });

  test('should evaluate response correctly', () => {
    const question = new SingleSelectQuestion('q1', 'Test question?', options, 2);
    
    const correctResult = question.evaluateResponse('o1');
    const incorrectResult = question.evaluateResponse('o2');
    
    expect(correctResult.score).toBe(2);
    expect(correctResult.isCorrect).toBe(true);
    expect(correctResult.requiresManualReview).toBe(false);
    
    expect(incorrectResult.score).toBe(0);
    expect(incorrectResult.isCorrect).toBe(false);
    expect(incorrectResult.requiresManualReview).toBe(false);
  });

  test('should set and get response correctly', () => {
    const question = new SingleSelectQuestion('q1', 'Test question?', options);
    
    expect(question.setResponse('o1')).toBe(true);
    expect(question.getResponse()).toBe('o1');
    
    expect(question.setResponse('o4')).toBe(false); // Invalid option
    expect(question.getResponse()).toBe('o1'); // Should not change
    
    question.clearResponse();
    expect(question.getResponse()).toBeNull();
  });

  test('should get selected option text', () => {
    const question = new SingleSelectQuestion('q1', 'Test question?', options);
    
    expect(question.getSelectedOptionText('o1')).toBe('Option 1');
    expect(question.getSelectedOptionText('o2')).toBe('Option 2');
    expect(question.getSelectedOptionText('o4')).toBeNull(); // Non-existent option
  });
});

describe('MultiSelectQuestion', () => {
  // Test data
  const options = [
    { id: 'o1', text: 'Option 1', isCorrect: true },
    { id: 'o2', text: 'Option 2', isCorrect: true },
    { id: 'o3', text: 'Option 3', isCorrect: false }
  ];

  const optionsWithProbability = [
    { id: 'o1', text: 'Option 1', isCorrect: true, probability: 80 },
    { id: 'o2', text: 'Option 2', isCorrect: true, probability: 60 },
    { id: 'o3', text: 'Option 3', isCorrect: false, probability: 0 }
  ];

  test('should create a multi select question with correct properties', () => {
    const question = new MultiSelectQuestion('q1', 'Multi select question?', options, 3);
    expect(question.id).toBe('q1');
    expect(question.type).toBe('multi-select');
    expect(question.text).toBe('Multi select question?');
    expect(question.points).toBe(3);
    expect(question.options).toEqual(options);
  });

  test('should validate multi select question structure', () => {
    const validQuestion = new MultiSelectQuestion('q1', 'Valid question?', options);
    const invalidOptions1 = []; // Empty options
    const invalidOptions2 = [ // No correct options
      { id: 'o1', text: 'Option 1', isCorrect: false },
      { id: 'o2', text: 'Option 2', isCorrect: false }
    ];

    const invalidQuestion1 = new MultiSelectQuestion('q1', 'Invalid question?', invalidOptions1);
    const invalidQuestion2 = new MultiSelectQuestion('q1', 'Invalid question?', invalidOptions2);

    expect(validQuestion.isValid()).toBe(true);
    expect(invalidQuestion1.isValid()).toBe(false);
    expect(invalidQuestion2.isValid()).toBe(false);
  });

  test('should validate response correctly', () => {
    const question = new MultiSelectQuestion('q1', 'Test question?', options);
    
    expect(question.validateResponse(['o1'])).toBe(true);
    expect(question.validateResponse(['o1', 'o2'])).toBe(true);
    expect(question.validateResponse([])).toBe(true); // Empty selection is valid
    expect(question.validateResponse(['o1', 'o4'])).toBe(false); // Contains non-existent option
    expect(question.validateResponse('o1')).toBe(false); // Not an array
    expect(question.validateResponse(null)).toBe(false);
    expect(question.validateResponse(undefined)).toBe(false);
  });

  test('should evaluate standard response correctly', () => {
    const question = new MultiSelectQuestion('q1', 'Test question?', options, 2);
    
    // All correct options selected
    const perfectResult = question.evaluateResponse(['o1', 'o2']);
    // Partial correct selection
    const partialResult = question.evaluateResponse(['o1']);
    // Incorrect selection
    const incorrectResult = question.evaluateResponse(['o3']);
    // Mixed selection
    const mixedResult = question.evaluateResponse(['o1', 'o3']);
    
    expect(perfectResult.score).toBe(2);
    expect(perfectResult.isFullyCorrect).toBe(true);
    
    expect(partialResult.score).toBe(1); // Half points for selecting half of correct options
    expect(partialResult.isFullyCorrect).toBe(false);
    
    expect(incorrectResult.score).toBe(0);
    expect(incorrectResult.isFullyCorrect).toBe(false);
    
    expect(mixedResult.score).toBeGreaterThan(0); // Some points for correct selection
    expect(mixedResult.score).toBeLessThan(2); // But penalty for incorrect selection
    expect(mixedResult.isFullyCorrect).toBe(false);
  });

  test('should evaluate probability-based response correctly', () => {
    const question = new MultiSelectQuestion('q1', 'Test question?', optionsWithProbability, 2);
    
    // High probability selection
    const highProbResult = question.evaluateResponse(['o1']);
    // Medium probability selection
    const mediumProbResult = question.evaluateResponse(['o2']);
    // Combined probability selection
    const combinedResult = question.evaluateResponse(['o1', 'o2']);
    // Zero probability selection
    const zeroProbResult = question.evaluateResponse(['o3']);
    
    expect(highProbResult.score).toBeCloseTo(1.6, 1); // 80% of 2 points
    expect(mediumProbResult.score).toBeCloseTo(1.2, 1); // 60% of 2 points
    expect(combinedResult.score).toBe(2); // Capped at max points (140% would be 2.8)
    expect(zeroProbResult.score).toBe(0);
  });

  test('should detect if question uses probability values', () => {
    const standardQuestion = new MultiSelectQuestion('q1', 'Standard question?', options);
    const probabilityQuestion = new MultiSelectQuestion('q2', 'Probability question?', optionsWithProbability);
    
    expect(standardQuestion.usesProbabilityValues()).toBe(false);
    expect(probabilityQuestion.usesProbabilityValues()).toBe(true);
  });

  test('should set and get response correctly', () => {
    const question = new MultiSelectQuestion('q1', 'Test question?', options);
    
    expect(question.setResponse(['o1', 'o2'])).toBe(true);
    expect(question.getResponse()).toEqual(['o1', 'o2']);
    
    expect(question.setResponse(['o1', 'o4'])).toBe(false); // Invalid option
    expect(question.getResponse()).toEqual(['o1', 'o2']); // Should not change
    
    question.clearResponse();
    expect(question.getResponse()).toBeNull();
  });

  test('should get selected option texts', () => {
    const question = new MultiSelectQuestion('q1', 'Test question?', options);
    
    expect(question.getSelectedOptionTexts(['o1', 'o2'])).toEqual(['Option 1', 'Option 2']);
    expect(question.getSelectedOptionTexts(['o1'])).toEqual(['Option 1']);
    expect(question.getSelectedOptionTexts(['o4'])).toEqual([]); // Non-existent option
  });
});

describe('FreeTextQuestion', () => {
  test('should create a free text question with correct properties', () => {
    const question = new FreeTextQuestion('q1', 'Free text question?', 'correct answer', 2, 500);
    expect(question.id).toBe('q1');
    expect(question.type).toBe('free-text');
    expect(question.text).toBe('Free text question?');
    expect(question.points).toBe(2);
    expect(question.correctAnswer).toBe('correct answer');
    expect(question.maxLength).toBe(500);
    expect(question.keywords).toEqual([]);
  });

  test('should validate free text question structure', () => {
    const question = new FreeTextQuestion('q1', 'Free text question?');
    expect(question.isValid()).toBe(true);
    
    // Free text questions don't require a correct answer
    const questionWithoutAnswer = new FreeTextQuestion('q1', 'Free text question?', null);
    expect(questionWithoutAnswer.isValid()).toBe(true);
  });

  test('should validate response correctly', () => {
    const question = new FreeTextQuestion('q1', 'Test question?', 'correct answer', 2, 20);
    
    expect(question.validateResponse('Some answer')).toBe(true);
    expect(question.validateResponse('')).toBe(false); // Empty answer
    expect(question.validateResponse('   ')).toBe(false); // Whitespace only
    expect(question.validateResponse(null)).toBe(false);
    expect(question.validateResponse(undefined)).toBe(false);
    
    // Test max length validation
    const longAnswer = 'This answer is too long and exceeds the maximum length limit';
    expect(question.validateResponse(longAnswer)).toBe(false);
  });

  test('should evaluate response with exact match', () => {
    const question = new FreeTextQuestion('q1', 'Test question?', 'correct answer', 2);
    
    const exactMatchResult = question.evaluateResponse('correct answer');
    const caseInsensitiveResult = question.evaluateResponse('Correct Answer');
    const whitespaceResult = question.evaluateResponse('  correct answer  ');
    const incorrectResult = question.evaluateResponse('wrong answer');
    
    expect(exactMatchResult.score).toBe(2);
    expect(exactMatchResult.isCorrect).toBe(true);
    expect(exactMatchResult.requiresManualReview).toBe(false);
    
    expect(caseInsensitiveResult.score).toBe(2);
    expect(caseInsensitiveResult.isCorrect).toBe(true);
    
    expect(whitespaceResult.score).toBe(2);
    expect(whitespaceResult.isCorrect).toBe(true);
    
    expect(incorrectResult.score).toBe(0);
    expect(incorrectResult.isCorrect).toBe(false);
    expect(incorrectResult.requiresManualReview).toBe(true);
  });

  test('should evaluate response with keywords', () => {
    const question = new FreeTextQuestion('q1', 'Test question?', null, 2);
    question.setKeywords(['important', 'concept', 'theory']);
    
    const allKeywordsResult = question.evaluateResponse('The important concept in this theory is...');
    const someKeywordsResult = question.evaluateResponse('This concept is relevant');
    const noKeywordsResult = question.evaluateResponse('The answer is something else');
    
    expect(allKeywordsResult.score).toBe(2); // All keywords present
    expect(allKeywordsResult.requiresManualReview).toBe(true);
    expect(allKeywordsResult.matchedKeywords).toEqual(['important', 'concept', 'theory']);
    
    expect(someKeywordsResult.score).toBeGreaterThan(0); // Partial score
    expect(someKeywordsResult.score).toBeLessThan(2);
    expect(someKeywordsResult.requiresManualReview).toBe(true);
    expect(someKeywordsResult.matchedKeywords).toEqual(['concept']);
    
    expect(noKeywordsResult.score).toBe(0);
    expect(noKeywordsResult.requiresManualReview).toBe(true);
  });

  test('should require manual review when no correct answer or keywords', () => {
    const question = new FreeTextQuestion('q1', 'Test question?');
    
    const result = question.evaluateResponse('Some answer');
    
    expect(result.score).toBe(0);
    expect(result.requiresManualReview).toBe(true);
  });

  test('should set and get response correctly', () => {
    const question = new FreeTextQuestion('q1', 'Test question?', 'correct answer', 2, 100);
    
    expect(question.setResponse('My answer')).toBe(true);
    expect(question.getResponse()).toBe('My answer');
    
    const longAnswer = 'A'.repeat(200);
    expect(question.setResponse(longAnswer)).toBe(false); // Too long
    expect(question.getResponse()).toBe('My answer'); // Should not change
    
    question.clearResponse();
    expect(question.getResponse()).toBeNull();
  });
});