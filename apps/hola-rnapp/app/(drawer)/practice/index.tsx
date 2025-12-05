import { useState, useEffect } from 'react';
import { ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { useUser } from '@clerk/clerk-expo';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import {
  GraduationCap,
  Play,
  CheckCircle,
  XCircle,
  RotateCcw,
  Trophy,
  Target,
  Flame,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { Id, Doc } from '@holaai/convex/_generated/dataModel';

type Exercise = Doc<'exercises'>;

export default function PracticeScreen() {
  const { user } = useUser();
  const insets = useSafeAreaInsets();

  // State
  const [mode, setMode] = useState<'select' | 'quiz' | 'results'>('select');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<{ correct: boolean; answer: string }[]>([]);

  // Convex queries
  const convexUser = useQuery(api.users.currentUser);
  const levels = useQuery(api.content.listLevels);
  const [selectedLevel, setSelectedLevel] = useState<Id<'contentLevels'> | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Id<'contentCategories'> | null>(null);

  const categories = useQuery(
    api.content.listCategories,
    selectedLevel ? { levelId: selectedLevel } : 'skip'
  );

  const exercises = useQuery(
    api.exercises.listExercises,
    selectedCategory ? { categoryId: selectedCategory } : 'skip'
  );

  const recordProgress = useMutation(api.exercises.recordExerciseAttempt);

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const success = '#22c55e';
  const error = '#ef4444';

  // Filter only quiz-compatible exercises
  const quizExercises = exercises?.filter(
    (e) => e.type === 'multiple_choice' || e.type === 'fill_blank'
  ) || [];

  const currentExercise = quizExercises[currentQuestionIndex];

  const handleStartQuiz = () => {
    if (quizExercises.length === 0) {
      Alert.alert('No Exercises', 'No exercises available for this category.');
      return;
    }
    setMode('quiz');
    setCurrentQuestionIndex(0);
    setScore(0);
    setAnswers([]);
    setSelectedAnswer(null);
    setShowResult(false);
  };

  const handleAnswer = (answer: string) => {
    if (showResult) return;
    setSelectedAnswer(answer);
  };

  const handleSubmit = async () => {
    if (!currentExercise || !selectedAnswer) return;

    const isCorrect = selectedAnswer.toLowerCase().trim() ===
      currentExercise.correctAnswer.toLowerCase().trim();

    setShowResult(true);
    setAnswers([...answers, { correct: isCorrect, answer: selectedAnswer }]);

    if (isCorrect) {
      setScore(score + 1);
    }

    // Record progress
    if (convexUser) {
      try {
        await recordProgress({
          userId: convexUser._id,
          exerciseId: currentExercise._id,
          score: isCorrect ? 100 : 0,
          isCorrect,
        });
      } catch (e) {
        console.error('Error recording progress:', e);
      }
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < quizExercises.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setMode('results');
    }
  };

  const handleRestart = () => {
    setMode('select');
    setSelectedLevel(null);
    setSelectedCategory(null);
  };

  const levelColors: Record<string, string> = {
    A1: '#22c55e',
    A2: '#3b82f6',
    B1: '#f59e0b',
  };

  // Show loading while fetching user or levels
  if (convexUser === undefined || levels === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Spinner variant='circle' />
      </View>
    );
  }

  // If no user, show message
  if (!convexUser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background, padding: 20 }}>
        <Text variant='subtitle' style={{ textAlign: 'center' }}>
          Please sign in to access practice quizzes
        </Text>
      </View>
    );
  }

  // Results Screen
  if (mode === 'results') {
    const percentage = Math.round((score / quizExercises.length) * 100);
    const grade =
      percentage >= 90 ? 'Excellent!' :
      percentage >= 70 ? 'Good job!' :
      percentage >= 50 ? 'Keep practicing!' : 'Try again!';

    return (
      <View style={{ flex: 1, backgroundColor: background }}>
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 20,
            alignItems: 'center',
          }}
        >
          <Icon
            name={Trophy}
            size={64}
            color={percentage >= 70 ? success : primary}
          />
          <Text variant='heading' style={{ marginTop: 20 }}>
            Quiz Complete!
          </Text>
          <Text variant='title' style={{ marginTop: 8, color: textMuted }}>
            {grade}
          </Text>

          <Card style={{ width: '100%', marginTop: 32 }}>
            <CardContent style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 48, fontWeight: 'bold', color: primary }}>
                {percentage}%
              </Text>
              <Text variant='caption' style={{ color: textMuted }}>
                {score} of {quizExercises.length} correct
              </Text>
            </CardContent>
          </Card>

          {/* Answer Summary */}
          <View style={{ width: '100%', marginTop: 24 }}>
            <Text variant='subtitle' style={{ marginBottom: 12 }}>
              Your Answers
            </Text>
            {answers.map((answer, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: `${textMuted}20`,
                }}
              >
                <Icon
                  name={answer.correct ? CheckCircle : XCircle}
                  size={20}
                  color={answer.correct ? success : error}
                />
                <Text style={{ flex: 1, marginLeft: 12 }}>
                  Question {index + 1}
                </Text>
                <Text style={{ color: answer.correct ? success : error }}>
                  {answer.correct ? 'Correct' : 'Incorrect'}
                </Text>
              </View>
            ))}
          </View>

          <Button
            onPress={handleRestart}
            style={{ marginTop: 32, flexDirection: 'row', alignItems: 'center', width: '100%' }}
          >
            <Icon name={RotateCcw} color='#fff' size={18} />
            <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
              Practice Again
            </Text>
          </Button>
        </ScrollView>
      </View>
    );
  }

  // Quiz Screen
  if (mode === 'quiz' && currentExercise) {
    return (
      <View style={{ flex: 1, backgroundColor: background }}>
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 20,
          }}
        >
          {/* Progress */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <View
              style={{
                flex: 1,
                height: 8,
                backgroundColor: `${primary}30`,
                borderRadius: 4,
                marginRight: 12,
              }}
            >
              <View
                style={{
                  width: `${((currentQuestionIndex + 1) / quizExercises.length) * 100}%`,
                  height: '100%',
                  backgroundColor: primary,
                  borderRadius: 4,
                }}
              />
            </View>
            <Text variant='caption' style={{ color: textMuted }}>
              {currentQuestionIndex + 1}/{quizExercises.length}
            </Text>
          </View>

          {/* Question */}
          <Card style={{ marginBottom: 24 }}>
            <CardContent>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View
                  style={{
                    backgroundColor: `${primary}20`,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: primary, fontSize: 12, fontWeight: '600' }}>
                    {currentExercise.type === 'multiple_choice' ? 'Multiple Choice' : 'Fill in the Blank'}
                  </Text>
                </View>
                <Text variant='caption' style={{ color: textMuted, marginLeft: 8 }}>
                  Difficulty: {currentExercise.difficulty}/5
                </Text>
              </View>
              <Text style={{ fontSize: 18, lineHeight: 26 }}>
                {currentExercise.question}
              </Text>
            </CardContent>
          </Card>

          {/* Options */}
          {currentExercise.type === 'multiple_choice' && currentExercise.options && (
            <View style={{ marginBottom: 24 }}>
              {currentExercise.options.map((option, index) => {
                const isSelected = selectedAnswer === option;
                const isCorrect = option === currentExercise.correctAnswer;
                const showCorrect = showResult && isCorrect;
                const showWrong = showResult && isSelected && !isCorrect;

                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleAnswer(option)}
                    disabled={showResult}
                    style={{
                      backgroundColor: showCorrect
                        ? `${success}20`
                        : showWrong
                          ? `${error}20`
                          : isSelected
                            ? `${primary}20`
                            : card,
                      borderWidth: 2,
                      borderColor: showCorrect
                        ? success
                        : showWrong
                          ? error
                          : isSelected
                            ? primary
                            : 'transparent',
                      padding: 16,
                      borderRadius: 12,
                      marginBottom: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: showCorrect
                          ? success
                          : showWrong
                            ? error
                            : isSelected
                              ? primary
                              : textMuted + '30',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: isSelected || showCorrect || showWrong ? '#fff' : textMuted,
                          fontWeight: '600',
                        }}
                      >
                        {String.fromCharCode(65 + index)}
                      </Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 16 }}>{option}</Text>
                    {showCorrect && <Icon name={CheckCircle} size={20} color={success} />}
                    {showWrong && <Icon name={XCircle} size={20} color={error} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Explanation */}
          {showResult && currentExercise.explanation && (
            <Card style={{ marginBottom: 24, backgroundColor: `${primary}10` }}>
              <CardContent>
                <Text variant='subtitle' style={{ marginBottom: 8, color: primary }}>
                  Explanation
                </Text>
                <Text style={{ lineHeight: 22 }}>{currentExercise.explanation}</Text>
              </CardContent>
            </Card>
          )}

          {/* Action Button */}
          {!showResult ? (
            <Button
              onPress={handleSubmit}
              disabled={!selectedAnswer}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Check Answer</Text>
            </Button>
          ) : (
            <Button
              onPress={handleNext}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                {currentQuestionIndex < quizExercises.length - 1 ? 'Next Question' : 'See Results'}
              </Text>
            </Button>
          )}
        </ScrollView>
      </View>
    );
  }

  // Selection Screen
  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
        }}
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text variant='body' style={{ color: textMuted }}>
            Test your knowledge with quizzes and exercises
          </Text>
        </View>

        {/* Level Selection */}
        <Text variant='subtitle' style={{ marginBottom: 12 }}>
          Select Level
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: 24 }}>
          {levels.map((level) => (
            <TouchableOpacity
              key={level._id}
              onPress={() => {
                setSelectedLevel(level._id);
                setSelectedCategory(null);
              }}
              style={{
                flex: 1,
                padding: 16,
                marginRight: level._id === levels[levels.length - 1]._id ? 0 : 8,
                borderRadius: 12,
                backgroundColor: selectedLevel === level._id ? levelColors[level.name] : card,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: selectedLevel === level._id ? '#fff' : textMuted,
                }}
              >
                {level.name}
              </Text>
              <Text
                variant='caption'
                style={{
                  color: selectedLevel === level._id ? 'rgba(255,255,255,0.8)' : textMuted,
                }}
              >
                {level.displayName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category Selection */}
        {selectedLevel && categories && (
          <>
            <Text variant='subtitle' style={{ marginBottom: 12 }}>
              Select Category
            </Text>
            <View style={{ marginBottom: 24 }}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category._id}
                  onPress={() => setSelectedCategory(category._id)}
                  style={{
                    padding: 16,
                    marginBottom: 8,
                    borderRadius: 12,
                    backgroundColor: selectedCategory === category._id ? primary : card,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontWeight: '500',
                      color: selectedCategory === category._id ? '#fff' : undefined,
                    }}
                  >
                    {category.name}
                  </Text>
                  {selectedCategory === category._id && (
                    <Icon name={CheckCircle} size={20} color='#fff' />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Quiz Info */}
        {selectedCategory && exercises !== undefined && (
          <Card style={{ marginBottom: 24 }}>
            <CardContent>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Icon name={Target} color={primary} size={24} />
                <Text variant='subtitle' style={{ marginLeft: 8 }}>
                  Quiz Ready
                </Text>
              </View>
              <Text variant='caption' style={{ color: textMuted }}>
                {quizExercises.length} questions available
              </Text>
            </CardContent>
          </Card>
        )}

        {/* Start Button */}
        {selectedCategory && (
          <Button
            onPress={handleStartQuiz}
            disabled={quizExercises.length === 0}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name={Play} color='#fff' size={18} />
            <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
              Start Quiz
            </Text>
          </Button>
        )}
      </ScrollView>
    </View>
  );
}
