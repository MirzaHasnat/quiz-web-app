const mongoose = require('mongoose');

/**
 * Migration: Add timing settings to Quiz and Question schemas
 * This migration adds:
 * - timingMode field to Quiz schema (default: 'total')
 * - timeLimit field to Question schema (default: null)
 * - timingMode field to Attempt schema (default: 'total')
 * - questionStartTimes and questionTimeRemaining Maps to Attempt schema
 * - timedOutQuestions array to Attempt schema
 */

const addTimingSettings = async () => {
  try {
    console.log('Starting timing settings migration...');
    
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quiz-app');
    }
    
    const db = mongoose.connection.db;
    
    // 1. Update existing quizzes to add timingMode field
    console.log('Updating quizzes to add timingMode field...');
    const quizUpdateResult = await db.collection('quizzes').updateMany(
      { timingMode: { $exists: false } },
      { 
        $set: { 
          timingMode: 'total',
          updatedAt: new Date()
        }
      }
    );
    console.log(`Updated ${quizUpdateResult.modifiedCount} quizzes with timingMode field`);
    
    // 2. Update existing questions to add timeLimit field
    console.log('Updating questions to add timeLimit field...');
    const quizzes = await db.collection('quizzes').find({}).toArray();
    
    let questionsUpdated = 0;
    for (const quiz of quizzes) {
      if (quiz.questions && quiz.questions.length > 0) {
        let hasUpdates = false;
        
        // Add timeLimit: null to questions that don't have it
        quiz.questions.forEach(question => {
          if (!question.hasOwnProperty('timeLimit')) {
            question.timeLimit = null;
            hasUpdates = true;
          }
        });
        
        if (hasUpdates) {
          await db.collection('quizzes').updateOne(
            { _id: quiz._id },
            { 
              $set: { 
                questions: quiz.questions,
                updatedAt: new Date()
              }
            }
          );
          questionsUpdated += quiz.questions.length;
        }
      }
    }
    console.log(`Updated ${questionsUpdated} questions with timeLimit field`);
    
    // 3. Update existing attempts to add timing-related fields
    console.log('Updating attempts to add timing fields...');
    const attemptUpdateResult = await db.collection('attempts').updateMany(
      { timingMode: { $exists: false } },
      { 
        $set: { 
          timingMode: 'total',
          questionStartTimes: {},
          questionTimeRemaining: {},
          timedOutQuestions: []
        }
      }
    );
    console.log(`Updated ${attemptUpdateResult.modifiedCount} attempts with timing fields`);
    
    // 4. Create indexes for performance
    console.log('Creating indexes for timing fields...');
    await db.collection('quizzes').createIndex({ "timingMode": 1 });
    await db.collection('attempts').createIndex({ "timingMode": 1, "status": 1 });
    
    console.log('Migration completed successfully!');
    
    // Summary
    console.log('\n=== Migration Summary ===');
    console.log(`Quizzes updated: ${quizUpdateResult.modifiedCount}`);
    console.log(`Questions updated: ${questionsUpdated}`);
    console.log(`Attempts updated: ${attemptUpdateResult.modifiedCount}`);
    console.log('Indexes created for performance');
    
    return {
      success: true,
      stats: {
        quizzesUpdated: quizUpdateResult.modifiedCount,
        questionsUpdated: questionsUpdated,
        attemptsUpdated: attemptUpdateResult.modifiedCount
      }
    };
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

const rollbackTimingSettings = async () => {
  try {
    console.log('Starting timing settings rollback...');
    
    const db = mongoose.connection.db;
    
    // 1. Remove timingMode field from quizzes
    console.log('Removing timingMode field from quizzes...');
    const quizRollbackResult = await db.collection('quizzes').updateMany(
      {},
      { 
        $unset: { timingMode: "" },
        $set: { updatedAt: new Date() }
      }
    );
    
    // 2. Remove timeLimit field from questions
    console.log('Removing timeLimit field from questions...');
    const quizzes = await db.collection('quizzes').find({}).toArray();
    
    let questionsRolledBack = 0;
    for (const quiz of quizzes) {
      if (quiz.questions && quiz.questions.length > 0) {
        let hasUpdates = false;
        
        quiz.questions.forEach(question => {
          if (question.hasOwnProperty('timeLimit')) {
            delete question.timeLimit;
            hasUpdates = true;
          }
        });
        
        if (hasUpdates) {
          await db.collection('quizzes').updateOne(
            { _id: quiz._id },
            { 
              $set: { 
                questions: quiz.questions,
                updatedAt: new Date()
              }
            }
          );
          questionsRolledBack += quiz.questions.length;
        }
      }
    }
    
    // 3. Remove timing fields from attempts
    console.log('Removing timing fields from attempts...');
    const attemptRollbackResult = await db.collection('attempts').updateMany(
      {},
      { 
        $unset: { 
          timingMode: "",
          questionStartTimes: "",
          questionTimeRemaining: "",
          timedOutQuestions: ""
        }
      }
    );
    
    console.log('Rollback completed successfully!');
    
    return {
      success: true,
      stats: {
        quizzesRolledBack: quizRollbackResult.modifiedCount,
        questionsRolledBack: questionsRolledBack,
        attemptsRolledBack: attemptRollbackResult.modifiedCount
      }
    };
    
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
};

// CLI execution
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'rollback') {
    rollbackTimingSettings()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    addTimingSettings()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = {
  addTimingSettings,
  rollbackTimingSettings
};