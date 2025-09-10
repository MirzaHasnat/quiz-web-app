const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
require('dotenv').config();

const addRecordingSettingsToExistingQuizzes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://reminderapp:reminderapp@cluster0.zcn2l.mongodb.net/quiz-web-app');
    console.log('Connected to MongoDB for migration');

    // Find all quizzes that don't have recordingSettings
    const quizzesWithoutRecordingSettings = await Quiz.find({
      recordingSettings: { $exists: false }
    });

    console.log(`Found ${quizzesWithoutRecordingSettings.length} quizzes without recording settings`);

    if (quizzesWithoutRecordingSettings.length === 0) {
      console.log('No quizzes need migration');
      return;
    }

    // Update each quiz with default recording settings
    const updatePromises = quizzesWithoutRecordingSettings.map(quiz => {
      return Quiz.findByIdAndUpdate(
        quiz._id,
        {
          $set: {
            recordingSettings: {
              enableMicrophone: true,
              enableCamera: true,
              enableScreen: true
            }
          }
        },
        { new: true }
      );
    });

    await Promise.all(updatePromises);
    console.log(`Successfully updated ${quizzesWithoutRecordingSettings.length} quizzes with default recording settings`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Migration completed, connection closed');
  }
};

// Run the migration if this file is executed directly
if (require.main === module) {
  addRecordingSettingsToExistingQuizzes();
}

module.exports = addRecordingSettingsToExistingQuizzes;