import { useState, useCallback } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import {
  User,
  MapPin,
  Briefcase,
  Heart,
  Target,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Plus
} from 'lucide-react-native';

const STEPS = [
  { key: 'name', title: "What's your name?", subtitle: "How should we address you in conversations?", icon: User },
  { key: 'origin', title: "Where are you from?", subtitle: "This helps personalize conversation topics", icon: MapPin },
  { key: 'profession', title: "What do you do?", subtitle: "Your profession helps create relevant scenarios", icon: Briefcase },
  { key: 'interests', title: "What are your interests?", subtitle: "Add hobbies and things you enjoy", icon: Heart },
  { key: 'learningGoal', title: "Why are you learning Spanish?", subtitle: "What brought you here?", icon: Target },
  { key: 'additionalContext', title: "Anything else?", subtitle: "Optional: Add any other context for better conversations", icon: MessageSquare },
];

interface InterestChipProps {
  label: string;
  onRemove: () => void;
  color: string;
}

function InterestChip({ label, onRemove, color }: InterestChipProps) {
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <Text style={{ color, fontSize: 14 }}>{label}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Icon name={X} size={14} color={color} />
      </TouchableOpacity>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useUser();
  const currentUser = useQuery(api.common.users.currentUser);
  const upsertProfile = useMutation(api.holaai.profile.upsertLearnerProfile);

  const primary = useColor('primary');
  const foreground = useColor('foreground');
  const textMuted = useColor('textMuted');
  const background = useColor('background');
  const card = useColor('card');
  const border = useColor('border');

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState(user?.fullName || '');
  const [origin, setOrigin] = useState('');
  const [profession, setProfession] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState('');
  const [learningGoal, setLearningGoal] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');

  const addInterest = useCallback(() => {
    const trimmed = interestInput.trim();
    if (trimmed && !interests.includes(trimmed)) {
      setInterests([...interests, trimmed]);
      setInterestInput('');
    }
  }, [interestInput, interests]);

  const removeInterest = useCallback((interest: string) => {
    setInterests(interests.filter(i => i !== interest));
  }, [interests]);

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 0: return name.trim().length > 0;
      case 1: return origin.trim().length > 0;
      case 2: return profession.trim().length > 0;
      case 3: return interests.length > 0;
      case 4: return learningGoal.trim().length > 0;
      case 5: return true; // Optional step
      default: return false;
    }
  }, [currentStep, name, origin, profession, interests, learningGoal]);

  const handleNext = useCallback(async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Submit profile
      if (!currentUser?._id) return;

      setIsSubmitting(true);
      try {
        await upsertProfile({
          userId: currentUser._id,
          name: name.trim(),
          origin: origin.trim(),
          profession: profession.trim(),
          interests,
          learningGoal: learningGoal.trim(),
          additionalContext: additionalContext.trim() || undefined,
        });
        // Navigate to main app - the AuthGate will detect profile is complete
        router.replace('/(drawer)');
      } catch (error) {
        console.error('Failed to save profile:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [currentStep, currentUser, name, origin, profession, interests, learningGoal, additionalContext, upsertProfile, router]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const currentStepData = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor={textMuted}
            style={[styles.input, { color: foreground, borderColor: border, backgroundColor: card }]}
            autoFocus
          />
        );
      case 1:
        return (
          <TextInput
            value={origin}
            onChangeText={setOrigin}
            placeholder="e.g., United States, Canada, Germany"
            placeholderTextColor={textMuted}
            style={[styles.input, { color: foreground, borderColor: border, backgroundColor: card }]}
            autoFocus
          />
        );
      case 2:
        return (
          <TextInput
            value={profession}
            onChangeText={setProfession}
            placeholder="e.g., Software Engineer, Teacher, Student"
            placeholderTextColor={textMuted}
            style={[styles.input, { color: foreground, borderColor: border, backgroundColor: card }]}
            autoFocus
          />
        );
      case 3:
        return (
          <View>
            <View style={styles.interestInputRow}>
              <TextInput
                value={interestInput}
                onChangeText={setInterestInput}
                placeholder="Add an interest"
                placeholderTextColor={textMuted}
                style={[styles.input, styles.interestInput, { color: foreground, borderColor: border, backgroundColor: card }]}
                onSubmitEditing={addInterest}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={addInterest}
                style={[styles.addButton, { backgroundColor: primary }]}
                disabled={!interestInput.trim()}
              >
                <Icon name={Plus} size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.chipsContainer}>
              {interests.map((interest, index) => (
                <InterestChip
                  key={index}
                  label={interest}
                  onRemove={() => removeInterest(interest)}
                  color={primary}
                />
              ))}
            </View>
            <Text variant="caption" style={{ color: textMuted, marginTop: 8 }}>
              Examples: Travel, Cooking, Music, Sports, Reading, Technology
            </Text>
          </View>
        );
      case 4:
        return (
          <TextInput
            value={learningGoal}
            onChangeText={setLearningGoal}
            placeholder="e.g., Living in Argentina, traveling to Spain, connecting with family..."
            placeholderTextColor={textMuted}
            style={[styles.input, styles.multilineInput, { color: foreground, borderColor: border, backgroundColor: card }]}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        );
      case 5:
        return (
          <TextInput
            value={additionalContext}
            onChangeText={setAdditionalContext}
            placeholder="Optional: Any other context that would help personalize your conversations..."
            placeholderTextColor={textMuted}
            style={[styles.input, styles.multilineInput, { color: foreground, borderColor: border, backgroundColor: card }]}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        );
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: border }]}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: primary }]} />
          </View>
          <Text variant="caption" style={{ color: textMuted, marginTop: 4 }}>
            Step {currentStep + 1} of {STEPS.length}
          </Text>
        </View>

        {/* Step Content */}
        <Card style={styles.card}>
          <CardContent>
            <View style={styles.iconContainer}>
              <View style={[styles.iconCircle, { backgroundColor: primary + '20' }]}>
                <Icon name={currentStepData.icon} size={32} color={primary} />
              </View>
            </View>

            <Text style={[styles.title, { color: foreground }]}>
              {currentStepData.title}
            </Text>
            <Text style={[styles.subtitle, { color: textMuted }]}>
              {currentStepData.subtitle}
            </Text>

            <View style={styles.inputContainer}>
              {renderStepContent()}
            </View>
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <View style={styles.buttonContainer}>
          {currentStep > 0 && (
            <Button
              variant="outline"
              onPress={handleBack}
              style={styles.backButton}
              disabled={isSubmitting}
            >
              <Icon name={ChevronLeft} size={20} color={foreground} />
              <Text style={{ marginLeft: 4, color: foreground }}>Back</Text>
            </Button>
          )}

          <Button
            onPress={handleNext}
            style={[styles.nextButton, currentStep === 0 && { flex: 1 }]}
            disabled={!canProceed() || isSubmitting}
          >
            {isSubmitting ? (
              <Spinner size="sm" variant="circle" color="#fff" />
            ) : (
              <>
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {isLastStep ? 'Complete' : 'Continue'}
                </Text>
                <Icon name={isLastStep ? Check : ChevronRight} size={20} color="#fff" />
              </>
            )}
          </Button>
        </View>

        {/* Skip for optional step */}
        {currentStep === 5 && (
          <TouchableOpacity onPress={handleNext} style={styles.skipButton}>
            <Text style={{ color: textMuted }}>Skip this step</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 60,
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  card: {
    marginBottom: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    marginTop: 8,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: 14,
  },
  interestInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  interestInput: {
    flex: 1,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  skipButton: {
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
  },
});
