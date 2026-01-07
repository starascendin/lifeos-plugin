import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { Target, BookOpen, FileText, MessageSquare, Sparkles } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

interface IntroStageProps {
  lessonData: {
    title: string;
    description: string;
    objectives: string[];
    vocabulary: any[];
    grammar: any[];
    phrases: any[];
    module?: {
      moduleNumber: number;
      title: string;
    } | null;
  };
  onContinue: () => void;
}

export function IntroStage({ lessonData, onContinue }: IntroStageProps) {
  const insets = useSafeAreaInsets();
  const primary = useColor('primary');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const success = '#22c55e';

  const contentCounts = [
    { label: 'Vocabulary', count: lessonData.vocabulary.length, icon: BookOpen, color: '#3b82f6' },
    { label: 'Grammar', count: lessonData.grammar.length, icon: FileText, color: '#f59e0b' },
    { label: 'Phrases', count: lessonData.phrases.length, icon: MessageSquare, color: '#22c55e' },
  ].filter((item) => item.count > 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: `${primary}20` }]}>
            <Icon name={Sparkles} size={32} color={primary} />
          </View>
          <Text variant="heading" style={styles.title}>
            {lessonData.title}
          </Text>
          {lessonData.module && (
            <Text variant="caption" style={{ color: textMuted, marginTop: 4 }}>
              Module {lessonData.module.moduleNumber}: {lessonData.module.title}
            </Text>
          )}
          {lessonData.description && (
            <Text variant="body" style={[styles.description, { color: textMuted }]}>
              {lessonData.description}
            </Text>
          )}
        </View>

        {/* What you'll learn */}
        <Card style={styles.card}>
          <CardContent style={styles.cardContent}>
            <View style={styles.sectionHeader}>
              <Icon name={Target} size={20} color={primary} />
              <Text variant="subtitle" style={styles.sectionTitle}>
                What You'll Learn
              </Text>
            </View>
            {lessonData.objectives.map((objective, index) => (
              <View key={index} style={styles.objectiveItem}>
                <View style={[styles.objectiveBullet, { backgroundColor: success }]}>
                  <Text style={styles.bulletText}>{index + 1}</Text>
                </View>
                <Text variant="body" style={styles.objectiveText}>
                  {objective}
                </Text>
              </View>
            ))}
          </CardContent>
        </Card>

        {/* Content preview */}
        <Card style={styles.card}>
          <CardContent style={styles.cardContent}>
            <Text variant="subtitle" style={styles.sectionTitle}>
              Lesson Content
            </Text>
            <View style={styles.contentGrid}>
              {contentCounts.map((item) => (
                <View
                  key={item.label}
                  style={[styles.contentItem, { backgroundColor: `${item.color}15` }]}
                >
                  <Icon name={item.icon} size={24} color={item.color} />
                  <Text variant="title" style={[styles.contentCount, { color: item.color }]}>
                    {item.count}
                  </Text>
                  <Text variant="caption" style={{ color: textMuted }}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card style={{ ...styles.card, backgroundColor: `${primary}10` }}>
          <CardContent style={styles.cardContent}>
            <Text variant="subtitle" style={styles.sectionTitle}>
              How It Works
            </Text>
            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, { backgroundColor: primary }]}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text variant="body" style={styles.stepText}>
                Learn new words and concepts
              </Text>
            </View>
            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, { backgroundColor: primary }]}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text variant="body" style={styles.stepText}>
                Practice with interactive drills
              </Text>
            </View>
            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, { backgroundColor: primary }]}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text variant="body" style={styles.stepText}>
                Master each item to progress
              </Text>
            </View>
          </CardContent>
        </Card>
      </ScrollView>

      {/* Fixed bottom button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button onPress={onContinue} style={styles.button}>
          <Text style={styles.buttonText}>Let's Begin!</Text>
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    marginBottom: 16,
  },
  cardContent: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    marginLeft: 8,
  },
  objectiveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  objectiveBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bulletText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  objectiveText: {
    flex: 1,
  },
  contentGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  contentItem: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    minWidth: 90,
  },
  contentCount: {
    marginTop: 8,
    fontWeight: 'bold',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  stepText: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'transparent',
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
