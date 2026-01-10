import { useState, useCallback, useEffect } from 'react';
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
import { useRouter, Stack } from 'expo-router';
import {
  User,
  MapPin,
  Briefcase,
  Heart,
  Target,
  MessageSquare,
  Save,
  X,
  Plus,
  ChevronLeft
} from 'lucide-react-native';

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

export default function ProfileEditScreen() {
  const router = useRouter();
  const currentUser = useQuery(api.common.users.currentUser);
  const profile = useQuery(
    api.holaai.profile.getLearnerProfile,
    currentUser?._id ? { userId: currentUser._id } : 'skip'
  );
  const upsertProfile = useMutation(api.holaai.profile.upsertLearnerProfile);

  const primary = useColor('primary');
  const foreground = useColor('foreground');
  const textMuted = useColor('textMuted');
  const background = useColor('background');
  const card = useColor('card');
  const border = useColor('border');

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');
  const [profession, setProfession] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState('');
  const [learningGoal, setLearningGoal] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');

  // Load profile data when available
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setOrigin(profile.origin || '');
      setProfession(profile.profession || '');
      setInterests(profile.interests || []);
      setLearningGoal(profile.learningGoal || '');
      setAdditionalContext(profile.additionalContext || '');
    }
  }, [profile]);

  const updateField = useCallback((setter: (v: string) => void) => (value: string) => {
    setter(value);
    setHasChanges(true);
  }, []);

  const addInterest = useCallback(() => {
    const trimmed = interestInput.trim();
    if (trimmed && !interests.includes(trimmed)) {
      setInterests([...interests, trimmed]);
      setInterestInput('');
      setHasChanges(true);
    }
  }, [interestInput, interests]);

  const removeInterest = useCallback((interest: string) => {
    setInterests(interests.filter(i => i !== interest));
    setHasChanges(true);
  }, [interests]);

  const handleSave = useCallback(async () => {
    if (!currentUser?._id) return;

    setIsSaving(true);
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
      setHasChanges(false);
      router.back();
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSaving(false);
    }
  }, [currentUser, name, origin, profession, interests, learningGoal, additionalContext, upsertProfile, router]);

  const isValid = name.trim() && origin.trim() && profession.trim() && interests.length > 0 && learningGoal.trim();

  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Spinner variant="circle" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit Profile',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Icon name={ChevronLeft} size={24} color={foreground} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={!hasChanges || !isValid || isSaving}
              style={{ padding: 8, opacity: (!hasChanges || !isValid || isSaving) ? 0.5 : 1 }}
            >
              {isSaving ? (
                <Spinner size="sm" variant="circle" color={primary} />
              ) : (
                <Icon name={Save} size={22} color={primary} />
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <Card>
            <CardContent>
              <View style={styles.fieldHeader}>
                <Icon name={User} size={18} color={primary} />
                <Text style={[styles.fieldLabel, { color: foreground }]}>Name</Text>
              </View>
              <TextInput
                value={name}
                onChangeText={updateField(setName)}
                placeholder="Your name"
                placeholderTextColor={textMuted}
                style={[styles.input, { color: foreground, borderColor: border, backgroundColor: card }]}
              />
            </CardContent>
          </Card>

          {/* Origin */}
          <Card>
            <CardContent>
              <View style={styles.fieldHeader}>
                <Icon name={MapPin} size={18} color={primary} />
                <Text style={[styles.fieldLabel, { color: foreground }]}>Where you're from</Text>
              </View>
              <TextInput
                value={origin}
                onChangeText={updateField(setOrigin)}
                placeholder="e.g., United States, Canada, Germany"
                placeholderTextColor={textMuted}
                style={[styles.input, { color: foreground, borderColor: border, backgroundColor: card }]}
              />
            </CardContent>
          </Card>

          {/* Profession */}
          <Card>
            <CardContent>
              <View style={styles.fieldHeader}>
                <Icon name={Briefcase} size={18} color={primary} />
                <Text style={[styles.fieldLabel, { color: foreground }]}>Profession</Text>
              </View>
              <TextInput
                value={profession}
                onChangeText={updateField(setProfession)}
                placeholder="e.g., Software Engineer, Teacher, Student"
                placeholderTextColor={textMuted}
                style={[styles.input, { color: foreground, borderColor: border, backgroundColor: card }]}
              />
            </CardContent>
          </Card>

          {/* Interests */}
          <Card>
            <CardContent>
              <View style={styles.fieldHeader}>
                <Icon name={Heart} size={18} color={primary} />
                <Text style={[styles.fieldLabel, { color: foreground }]}>Interests</Text>
              </View>
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
            </CardContent>
          </Card>

          {/* Learning Goal */}
          <Card>
            <CardContent>
              <View style={styles.fieldHeader}>
                <Icon name={Target} size={18} color={primary} />
                <Text style={[styles.fieldLabel, { color: foreground }]}>Why learning Spanish</Text>
              </View>
              <TextInput
                value={learningGoal}
                onChangeText={updateField(setLearningGoal)}
                placeholder="e.g., Living in Argentina, traveling to Spain..."
                placeholderTextColor={textMuted}
                style={[styles.input, styles.multilineInput, { color: foreground, borderColor: border, backgroundColor: card }]}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </CardContent>
          </Card>

          {/* Additional Context */}
          <Card>
            <CardContent>
              <View style={styles.fieldHeader}>
                <Icon name={MessageSquare} size={18} color={primary} />
                <Text style={[styles.fieldLabel, { color: foreground }]}>Additional context</Text>
                <Text style={{ color: textMuted, fontSize: 12, marginLeft: 8 }}>(optional)</Text>
              </View>
              <TextInput
                value={additionalContext}
                onChangeText={updateField(setAdditionalContext)}
                placeholder="Any other context for better conversations..."
                placeholderTextColor={textMuted}
                style={[styles.input, styles.multilineInput, { color: foreground, borderColor: border, backgroundColor: card }]}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button
            onPress={handleSave}
            disabled={!hasChanges || !isValid || isSaving}
            style={styles.saveButton}
          >
            {isSaving ? (
              <Spinner size="sm" variant="circle" color="#fff" />
            ) : (
              <>
                <Icon name={Save} size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>Save Changes</Text>
              </>
            )}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  interestInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  interestInput: {
    flex: 1,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
});
