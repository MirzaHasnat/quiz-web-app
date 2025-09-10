const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
require('dotenv').config();

const addNegativeMarkingToExistingQuizzes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://reminderapp:reminderapp@cluster0.zcn2l.mongodb.net/quiz-web-app');
    console.log('Connected to MongoDB for negative marking migration');

    // Find all quizzes that don't have negativeMarking settings
    const quizzesWithoutNegativeMarking = await Quiz.find({
      negativeMarking: { $exists: false }
    });

    console.log(`Found ${quizzesWithoutNegativeMarking.length} quizzes without negative marking settings`);

    if (quizzesWithoutNegativeMarking.length === 0) {
      console.log('No quizzes need migration for negative marking');
      return;
    }

    // Update each quiz with default negative marking settings
    const updatePromises = quizzesWithoutNegativeMarking.map(quiz => {
      return Quiz.findByIdAndUpdate(
        quiz._id,
        {
          $set: {
            negativeMarking: {
              enabled: false,
              penaltyValue: 0
            }
          }
        },
        { new: true }
      );
    });

    await Promise.all(updatePromises);
    console.log(`Successfully updated ${quizzesWithoutNegativeMarking.length} quizzes with default negative marking settings`);

  } catch (error) {
    console.error('Negative marking migration failed:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Negative marking migration completed, connection closed');
  }
};

// Run the migration if this file is executed directly
if (require.main === module) {
  addNegativeMarkingToExistingQuizzes();
}

module.exports = addNegativeMarkingToExistingQuizzes;