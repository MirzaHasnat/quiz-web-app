/**
 * Question model classes for the Quiz Web App
 * These classes provide type definitions and validation logic for different question types
 * 
 * Requirements:
 * - Support for single-select MCQ (4.1)
 * - Support for multi-select MCQ (4.2)
 * - Support for free text questions (4.3)
 * - Support for answer changes (4.4)
 * - Support for probability values in multi-select MCQs (4.5)
 */

/**
 * Base Question class that all question types extend
 */
class Question {
  constructor(id, type, text, points = 1) {
    this.id = id;
    this.type = type;
    this.text = text;
    this.points = points;
    this.userResponse = null; // Track the user's current response
  }

  /**
   * Validates if the question data is complete and correctly formatted
   * @returns {boolean} True if valid, false otherwise
   */
  isValid() {
    return Boolean(this.id && this.type && this.text);
  }

  /**
   * Sets the user's response to this question
   * Supports requirement 4.4 - When a user changes their answer
   * @param {any} response - The user's response (format depends on question type)
   * @returns {boolean} True if the response was valid and set successfully
   */
  setResponse(response) {
    if (this.validateResponse(response)) {
      this.userResponse = response;
      return true;
    }
    return false;
  }

  /**
   * Gets the user's current response
   * @returns {any} The current response or null if not set
   */
  getResponse() {
    return this.userResponse;
  }

  /**
   * Clears the user's response
   */
  clearResponse() {
    this.userResponse = null;
  }

  /**
   * Validates a response - to be implemented by subclasses
   * @param {any} response - The response to validate
   * @returns {boolean} True if valid, false otherwise
   */
  validateResponse(response) {
    throw new Error('validateResponse must be implemented by subclasses');
  }

  /**
   * Evaluates a response - to be implemented by subclasses
   * @param {any} response - The response to evaluate
   * @returns {Object} Evaluation result
   */
  evaluateResponse(response) {
    throw new Error('evaluateResponse must be implemented by subclasses');
  }

  /**
   * Serializes the question object to a plain object for API submission
   * @returns {Object} Plain object representation of the question
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      text: this.text,
      points: this.points,
      userResponse: this.userResponse
    };
  }

  /**
   * Factory method to create the appropriate question type from raw data
   * @param {Object} data - Raw question data from API
   * @returns {Question} - Appropriate question subclass instance
   */
  static fromData(data) {
    switch (data.type) {
      case 'single-select':
        return new SingleSelectQuestion(
          data.id || data._id,
          data.text,
          data.options,
          data.points
        );
      case 'multi-select':
        return new MultiSelectQuestion(
          data.id || data._id,
          data.text,
          data.options,
          data.points
        );
      case 'free-text':
        return new FreeTextQuestion(
          data.id || data._id,
          data.text,
          data.correctAnswer,
          data.points
        );
      default:
        throw new Error(`Unknown question type: ${data.type}`);
    }
  }
  
  /**
   * Creates a deep clone of the question
   * @returns {Question} A new instance with the same properties
   */
  clone() {
    const cloned = Question.fromData(this.toJSON());
    cloned.userResponse = this.userResponse;
    return cloned;
  }
}

/**
 * Single Select Multiple Choice Question
 * Allows selection of exactly one option
 * Implements requirement 4.1 - When encountering a single-select MCQ THEN the system SHALL allow selection of exactly one option
 */
class SingleSelectQuestion extends Question {
  constructor(id, text, options = [], points = 1) {
    super(id, 'single-select', text, points);
    this.options = options;
  }

  /**
   * Validates if the question has valid options
   * @returns {boolean} True if valid, false otherwise
   */
  isValid() {
    return (
      super.isValid() && 
      Array.isArray(this.options) && 
      this.options.length >= 2 &&
      this.options.some(option => option.isCorrect) &&
      // Ensure only one option is marked as correct
      this.options.filter(option => option.isCorrect).length === 1
    );
  }

  /**
   * Validates if a response to this question is valid
   * @param {string} selectedOptionId - The ID of the selected option
   * @returns {boolean} True if valid, false otherwise
   */
  validateResponse(selectedOptionId) {
    if (!selectedOptionId) return false;
    return this.options.some(option => option.id === selectedOptionId || option._id === selectedOptionId);
  }

  /**
   * Checks if the selected option is correct
   * @param {string} selectedOptionId - The ID of the selected option
   * @returns {boolean} True if correct, false otherwise
   */
  isCorrectResponse(selectedOptionId) {
    if (!this.validateResponse(selectedOptionId)) return false;
    const selectedOption = this.options.find(
      option => option.id === selectedOptionId || option._id === selectedOptionId
    );
    return selectedOption && selectedOption.isCorrect;
  }

  /**
   * Evaluates the response and returns a score
   * @param {string} selectedOptionId - The ID of the selected option
   * @returns {Object} Evaluation result with score and correctness
   */
  evaluateResponse(selectedOptionId) {
    const isCorrect = this.isCorrectResponse(selectedOptionId);
    return {
      score: isCorrect ? this.points : 0,
      isCorrect,
      requiresManualReview: false,
      feedback: isCorrect ? 'Correct answer!' : 'Incorrect answer.'
    };
  }

  /**
   * Gets the text of the selected option
   * @param {string} selectedOptionId - The ID of the selected option
   * @returns {string|null} The text of the selected option or null if not found
   */
  getSelectedOptionText(selectedOptionId) {
    if (!this.validateResponse(selectedOptionId)) return null;
    const selectedOption = this.options.find(
      option => option.id === selectedOptionId || option._id === selectedOptionId
    );
    return selectedOption ? selectedOption.text : null;
  }

  /**
   * Serializes the question object to a plain object for API submission
   * @returns {Object} Plain object representation of the question
   */
  toJSON() {
    return {
      ...super.toJSON(),
      options: this.options.map(option => ({
        id: option.id || option._id,
        text: option.text,
        isCorrect: option.isCorrect
      }))
    };
  }
}

/**
 * Multi Select Multiple Choice Question
 * Allows selection of multiple options
 * Implements requirements:
 * - 4.2 - When encountering a multi-select MCQ THEN the system SHALL allow selection of multiple options
 * - 4.5 - IF a multi-select MCQ has probability values THEN the system SHALL store these for admin evaluation
 */
class MultiSelectQuestion extends Question {
  constructor(id, text, options = [], points = 1) {
    super(id, 'multi-select', text, points);
    this.options = options;
    
    // Ensure probability values are properly set
    this._normalizeProbabilities();
  }

  /**
   * Normalizes probability values for options if they exist
   * This ensures that probability values are valid percentages
   * Implements requirement 4.5 - IF a multi-select MCQ has probability values
   * @private
   */
  _normalizeProbabilities() {
    // Check if any options have probability values
    const hasProbabilities = this.options.some(option => 
      option.probability !== undefined && option.probability !== null
    );
    
    if (hasProbabilities) {
      // Ensure all options have probability values
      this.options.forEach(option => {
        if (option.probability === undefined || option.probability === null) {
          option.probability = option.isCorrect ? 100 : 0;
        }
        
        // Ensure probability is within valid range (0-100)
        option.probability = Math.max(0, Math.min(100, option.probability));
      });
    }
  }

  /**
   * Validates if the question has valid options
   * @returns {boolean} True if valid, false otherwise
   */
  isValid() {
    return (
      super.isValid() && 
      Array.isArray(this.options) && 
      this.options.length >= 2 &&
      // At least one option should be marked as correct
      this.options.some(option => option.isCorrect)
    );
  }

  /**
   * Validates if a response to this question is valid
   * @param {string[]} selectedOptionIds - Array of selected option IDs
   * @returns {boolean} True if valid, false otherwise
   */
  validateResponse(selectedOptionIds) {
    if (!Array.isArray(selectedOptionIds)) return false;
    // Empty array is valid (no selections)
    if (selectedOptionIds.length === 0) return true;
    
    // Check if all selected options exist in the question
    return selectedOptionIds.every(id => 
      this.options.some(option => option.id === id || option._id === id)
    );
  }

  /**
   * Checks if the selected options match the correct answers
   * For multi-select, we consider partial correctness based on probability values
   * @param {string[]} selectedOptionIds - Array of selected option IDs
   * @returns {Object} Object containing correctness score and details
   */
  evaluateResponse(selectedOptionIds) {
    if (!this.validateResponse(selectedOptionIds)) {
      return { 
        score: 0, 
        isFullyCorrect: false, 
        requiresManualReview: false,
        feedback: 'Invalid selection.'
      };
    }

    const correctOptions = this.options.filter(option => option.isCorrect);
    const selectedCorrectCount = selectedOptionIds.filter(id => 
      correctOptions.some(option => option.id === id || option._id === id)
    ).length;
    
    const incorrectSelections = selectedOptionIds.filter(id => 
      !correctOptions.some(option => option.id === id || option._id === id)
    ).length;

    // Check if we should use probability-based scoring
    const hasProbabilities = this.options.some(option => 
      option.probability !== undefined && option.probability !== null
    );

    let score = 0;
    let feedback = '';
    
    if (hasProbabilities) {
      // Calculate score based on probability values
      const selectedOptions = selectedOptionIds.map(id => 
        this.options.find(option => option.id === id || option._id === id)
      );
      
      // Sum up probability values of selected options (normalized to points)
      const totalProbability = selectedOptions.reduce((sum, option) => 
        sum + (option.probability || 0), 0);
      
      // Calculate score based on total probability (max 100%)
      score = (Math.min(100, totalProbability) / 100) * this.points;
      feedback = `Score based on probability values: ${score.toFixed(2)} points`;
    } else {
      // Use standard scoring method
      if (correctOptions.length > 0) {
        // Add points for correct selections
        score += (selectedCorrectCount / correctOptions.length) * this.points;
        
        // Subtract points for incorrect selections (if any)
        if (incorrectSelections > 0) {
          const penaltyPerIncorrect = this.points / this.options.length;
          score -= incorrectSelections * penaltyPerIncorrect;
        }
        
        feedback = `You selected ${selectedCorrectCount} out of ${correctOptions.length} correct options`;
        if (incorrectSelections > 0) {
          feedback += ` and ${incorrectSelections} incorrect options`;
        }
      }
    }
    
    // Ensure score is not negative
    score = Math.max(0, score);

    const isFullyCorrect = 
      selectedCorrectCount === correctOptions.length && 
      incorrectSelections === 0;

    return {
      score: parseFloat(score.toFixed(2)),
      isFullyCorrect,
      requiresManualReview: false,
      feedback
    };
  }
  
  /**
   * Gets the text of the selected options
   * @param {string[]} selectedOptionIds - Array of selected option IDs
   * @returns {string[]} Array of selected option texts
   */
  getSelectedOptionTexts(selectedOptionIds) {
    if (!this.validateResponse(selectedOptionIds)) return [];
    
    return selectedOptionIds
      .map(id => {
        const option = this.options.find(opt => opt.id === id || opt._id === id);
        return option ? option.text : null;
      })
      .filter(text => text !== null);
  }
  
  /**
   * Checks if the question uses probability values
   * @returns {boolean} True if the question uses probability values
   */
  usesProbabilityValues() {
    return this.options.some(option => 
      option.probability !== undefined && option.probability !== null
    );
  }
  
  /**
   * Serializes the question object to a plain object for API submission
   * @returns {Object} Plain object representation of the question
   */
  toJSON() {
    return {
      ...super.toJSON(),
      options: this.options.map(option => ({
        id: option.id || option._id,
        text: option.text,
        isCorrect: option.isCorrect,
        probability: option.probability
      }))
    };
  }
}

/**
 * Free Text Question
 * Allows entering a text response
 * Implements requirement 4.3 - When encountering a free text question THEN the system SHALL provide a text input field for typed responses
 */
class FreeTextQuestion extends Question {
  constructor(id, text, correctAnswer = null, points = 1, maxLength = 1000) {
    super(id, 'free-text', text, points);
    this.correctAnswer = correctAnswer;
    this.maxLength = maxLength; // Optional maximum length for the answer
    this.keywords = []; // Optional keywords for partial matching
  }

  /**
   * Validates if the question data is complete and correctly formatted
   * @returns {boolean} True if valid, false otherwise
   */
  isValid() {
    // Free text questions don't require a correct answer as they may need manual review
    return super.isValid();
  }

  /**
   * Sets keywords for partial matching
   * @param {string[]} keywords - Array of keywords to match against
   */
  setKeywords(keywords) {
    if (Array.isArray(keywords)) {
      this.keywords = keywords.map(keyword => keyword.trim().toLowerCase());
    }
  }

  /**
   * Validates if a response to this question is valid
   * @param {string} textAnswer - The text answer provided
   * @returns {boolean} True if valid, false otherwise
   */
  validateResponse(textAnswer) {
    // Any non-empty string is considered valid
    if (typeof textAnswer !== 'string' || textAnswer.trim().length === 0) {
      return false;
    }
    
    // Check if the answer exceeds the maximum length (if specified)
    if (this.maxLength > 0 && textAnswer.length > this.maxLength) {
      return false;
    }
    
    return true;
  }

  /**
   * For free text questions, automatic evaluation is limited
   * This can be extended with NLP or pattern matching in the future
   * Currently, it checks for exact matches or keyword matches if available
   * @param {string} textAnswer - The text answer provided
   * @returns {Object} Evaluation result with score and review flag
   */
  evaluateResponse(textAnswer) {
    if (!this.validateResponse(textAnswer)) {
      return { 
        score: 0, 
        isCorrect: false,
        requiresManualReview: true,
        feedback: 'Invalid response format or length.'
      };
    }

    // Normalize the text answer
    const normalizedAnswer = textAnswer.trim().toLowerCase();
    
    // If no correct answer or keywords are defined, manual review is required
    if (!this.correctAnswer && this.keywords.length === 0) {
      return { 
        score: 0, 
        isCorrect: false,
        requiresManualReview: true,
        feedback: 'Your answer requires manual review.'
      };
    }

    let isCorrect = false;
    let score = 0;
    let feedback = '';
    
    // Check for exact match if correctAnswer is provided
    if (this.correctAnswer) {
      isCorrect = normalizedAnswer === this.correctAnswer.trim().toLowerCase();
      if (isCorrect) {
        score = this.points;
        feedback = 'Exact match with the correct answer.';
      }
    }
    
    // If not an exact match but keywords are available, check for keyword matches
    if (!isCorrect && this.keywords.length > 0) {
      const matchedKeywords = this.keywords.filter(keyword => 
        normalizedAnswer.includes(keyword)
      );
      
      if (matchedKeywords.length > 0) {
        // Calculate partial score based on keyword matches
        const keywordScore = (matchedKeywords.length / this.keywords.length) * this.points;
        score = Math.min(keywordScore, this.points); // Cap at maximum points
        feedback = `Matched ${matchedKeywords.length} out of ${this.keywords.length} keywords.`;
        
        // Still requires manual review for confirmation
        return {
          score: parseFloat(score.toFixed(2)),
          isCorrect: false, // Not fully correct until manually reviewed
          requiresManualReview: true,
          feedback,
          matchedKeywords
        };
      }
    }

    return {
      score,
      isCorrect,
      requiresManualReview: !isCorrect, // Always require review if not exact match
      feedback: feedback || 'Your answer requires manual review.'
    };
  }

  /**
   * Performs a more advanced evaluation using pattern matching or other techniques
   * This is a placeholder for future enhancements
   * @param {string} textAnswer - The text answer provided
   * @returns {Object} Advanced evaluation result
   */
  advancedEvaluation(textAnswer) {
    // This could be extended with NLP, pattern matching, or other techniques
    // For now, it just returns the basic evaluation
    return this.evaluateResponse(textAnswer);
  }

  /**
   * Serializes the question object to a plain object for API submission
   * @returns {Object} Plain object representation of the question
   */
  toJSON() {
    return {
      ...super.toJSON(),
      correctAnswer: this.correctAnswer,
      maxLength: this.maxLength,
      keywords: this.keywords
    };
  }
}

export { Question, SingleSelectQuestion, MultiSelectQuestion, FreeTextQuestion };