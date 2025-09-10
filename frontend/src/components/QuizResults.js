import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Paper,
  Grid,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  Grade as GradeIcon,
  Quiz as QuizIcon
} from '@mui/icons-material';
import axios from '../utils/axiosConfig';

const QuizResults = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get(`/api/dashboard/quizzes/${quizId}/results`);
        setResults(response.data.data);
      } catch (err) {
        console.error('Error fetching quiz results:', err);
        if (err.response?.status === 403) {
          setError('Results are not yet available. Please check back later.');
        } else if (err.response?.status === 404) {
          setError('Quiz or results not found.');
        } else {
          setError('Failed to load quiz results. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (quizId) {
      fetchResults();
    }
  }, [quizId]);

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <Container maxWidth="md">
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            Loading Your Results
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please wait while we fetch your quiz results...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 4 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBackToDashboard}
            sx={{ mb: 3 }}
          >
            Back to Dashboard
          </Button>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Container>
    );
  }

  if (!results) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 4 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBackToDashboard}
            sx={{ mb: 3 }}
          >
            Back to Dashboard
          </Button>
          <Alert severity="info">No results available for this quiz.</Alert>
        </Box>
      </Container>
    );
  }

  const scorePercentage = results.attempt.maxScore > 0 
    ? Math.round((results.attempt.totalScore / results.attempt.maxScore) * 100) 
    : 0;

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'warning';
    return 'error';
  };

  const getUserAnswerText = (userAnswer, question) => {
    if (!userAnswer) return null;
    
    if (question.type === 'free-text') {
      return userAnswer.textAnswer;
    } else if (question.type === 'single-select') {
      if (userAnswer.selectedOptions && userAnswer.selectedOptions.length > 0) {
        const selectedOption = question.options.find(opt => opt._id === userAnswer.selectedOptions[0]);
        return selectedOption ? selectedOption.text : userAnswer.selectedOptions[0];
      }
    } else if (question.type === 'multi-select') {
      if (userAnswer.selectedOptions && userAnswer.selectedOptions.length > 0) {
        const selectedTexts = userAnswer.selectedOptions.map(selectedId => {
          const option = question.options.find(opt => opt._id === selectedId);
          return option ? option.text : selectedId;
        });
        return selectedTexts.join(', ');
      }
    }
    
    return null;
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBackToDashboard}
          sx={{ mb: 3 }}
        >
          Back to Dashboard
        </Button>

        {/* Quiz Header */}
        <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <QuizIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h4" component="h1">
              {results.quiz.title}
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" paragraph>
            {results.quiz.description}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip 
              label={`Status: ${results.attempt.status}`} 
              color={results.attempt.status === 'reviewed' ? 'success' : 'default'}
            />
            <Chip 
              label={`Completed: ${new Date(results.attempt.endTime).toLocaleDateString()}`} 
              variant="outlined"
            />
            {results.attempt.reviewedAt && (
              <Chip 
                label={`Reviewed: ${new Date(results.attempt.reviewedAt).toLocaleDateString()}`} 
                color="info"
                variant="outlined"
              />
            )}
          </Box>
        </Paper>

        {/* Score Summary */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <GradeIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h5">Your Score</Typography>
            </Box>
            
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h2" color={`${getScoreColor(scorePercentage)}.main`}>
                    {scorePercentage}%
                  </Typography>
                  <Typography variant="h6" color="text.secondary">
                    {results.attempt.totalScore} / {results.attempt.maxScore} points
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ width: '100%' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Score Breakdown
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={scorePercentage}
                    color={getScoreColor(scorePercentage)}
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption">0%</Typography>
                    <Typography variant="caption">100%</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>

            {/* Negative Marking Breakdown */}
            {results.attempt.negativeMarkingApplied && (results.attempt.positiveScore !== undefined || results.attempt.negativeScore !== undefined) && (
              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Detailed Score Breakdown (Negative Marking Applied)
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center', p: 1 }}>
                      <Typography variant="h6" color="success.main">
                        +{results.attempt.positiveScore || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Correct Answers
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center', p: 1 }}>
                      <Typography variant="h6" color="error.main">
                        -{results.attempt.negativeScore || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Penalty Points
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center', p: 1 }}>
                      <Typography variant="h6" color="primary.main">
                        {results.attempt.totalScore}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Final Score
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Question Details */}
        {results.showDetails && results.attempt.answers && (
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <QuizIcon sx={{ mr: 2 }} />
                Question Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {results.quiz.questions.map((question, index) => {
                const userAnswer = results.attempt.answers.find(a => a.questionId === question._id);
                const isCorrect = userAnswer?.isCorrect;
                
                return (
                  <Accordion key={question._id} sx={{ mb: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        {question.type !== 'free-text' && (
                          isCorrect ? (
                            <CheckCircleIcon sx={{ color: 'success.main', mr: 2 }} />
                          ) : (
                            <CancelIcon sx={{ color: 'error.main', mr: 2 }} />
                          )
                        )}
                        <Typography sx={{ flexGrow: 1 }}>
                          Question {index + 1}: {question.text}
                        </Typography>
                        <Chip 
                          size="small" 
                          label={`${userAnswer?.score || 0}/${question.points} pts`}
                          color={isCorrect ? 'success' : 'default'}
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ pl: 2 }}>
                        {/* Show options for multiple choice questions */}
                        {(question.type === 'single-select' || question.type === 'multi-select') && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>Options:</Typography>
                            {question.options.map((option, optIndex) => (
                              <Box key={optIndex} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: (results.quiz.resultVisibilitySettings?.showCorrectAnswers !== false && option.isCorrect) 
                                      ? 'success.main' 
                                      : 'text.primary',
                                    fontWeight: (results.quiz.resultVisibilitySettings?.showCorrectAnswers !== false && option.isCorrect) 
                                      ? 'bold' 
                                      : 'normal'
                                  }}
                                >
                                  {String.fromCharCode(65 + optIndex)}. {option.text}
                                  {results.quiz.resultVisibilitySettings?.showCorrectAnswers !== false && option.isCorrect && ' ✓'}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}
                        
                        {/* Show user's answer */}
                        {results.quiz.resultVisibilitySettings?.showUserAnswers !== false && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>Your Answer:</Typography>
                            <Typography variant="body2" sx={{ 
                              color: isCorrect ? 'success.main' : 'error.main',
                              fontStyle: getUserAnswerText(userAnswer, question) ? 'normal' : 'italic'
                            }}>
                              {getUserAnswerText(userAnswer, question) || 'No answer provided'}
                            </Typography>
                          </Box>
                        )}
                        
                        {/* Show feedback if available */}
                        {results.quiz.resultVisibilitySettings?.showFeedback !== false && userAnswer?.feedback && (
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>Feedback:</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {userAnswer.feedback}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Show message if details are not available */}
        {!results.showDetails && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Detailed question breakdown is not available for this quiz. Only your overall score is shown.
          </Alert>
        )}
      </Box>
    </Container>
  );
};

export default QuizResults;