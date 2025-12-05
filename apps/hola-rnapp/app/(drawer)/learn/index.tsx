import { useState } from 'react';
import { FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import { BookOpen, ChevronRight, Layers, Play, Database } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { Id } from '@holaai/convex/_generated/dataModel';

export default function LearnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const levels = useQuery(api.content.listLevels);
  const seedContent = useMutation(api.seed.seedContent);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const card = useColor('card');

  const handleSeedContent = async () => {
    setSeeding(true);
    try {
      await seedContent();
    } catch (error) {
      console.error('Error seeding content:', error);
    } finally {
      setSeeding(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Queries auto-refresh, just simulate delay
    setTimeout(() => setRefreshing(false), 500);
  };

  const navigateToLevel = (levelId: Id<'contentLevels'>) => {
    router.push(`/learn/${levelId}`);
  };

  if (levels === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Spinner variant='circle' />
      </View>
    );
  }

  const levelColors: Record<string, string> = {
    A1: '#22c55e', // green
    A2: '#3b82f6', // blue
    B1: '#f59e0b', // amber
    B2: '#8b5cf6', // purple
    C1: '#ef4444', // red
    C2: '#ec4899', // pink
  };

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <FlatList
        data={levels}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 16,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text variant='body' style={{ color: textMuted }}>
              Choose your level and start learning vocabulary, grammar, and phrases
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Card style={{ marginTop: 20 }}>
            <CardHeader>
              <CardTitle>No Content Available</CardTitle>
              <CardDescription>
                Seed the database with initial Spanish learning content to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onPress={handleSeedContent}
                disabled={seeding}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
              >
                {seeding ? (
                  <Spinner variant='circle' size='sm' />
                ) : (
                  <>
                    <Icon name={Database} color='#fff' size={18} />
                    <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '600' }}>
                      Seed Content
                    </Text>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        }
        renderItem={({ item: level }) => {
          const levelColor = levelColors[level.name] || primary;

          return (
            <TouchableOpacity
              onPress={() => navigateToLevel(level._id)}
              activeOpacity={0.7}
            >
              <Card style={{ marginBottom: 16 }}>
                <CardContent style={{ padding: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Level Badge */}
                    <View
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 12,
                        backgroundColor: levelColor,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 16,
                      }}
                    >
                      <Text
                        style={{
                          color: '#fff',
                          fontSize: 20,
                          fontWeight: 'bold',
                        }}
                      >
                        {level.name}
                      </Text>
                    </View>

                    {/* Content */}
                    <View style={{ flex: 1 }}>
                      <Text variant='title' style={{ marginBottom: 4 }}>
                        {level.displayName}
                      </Text>
                      <Text
                        variant='caption'
                        style={{ color: textMuted }}
                        numberOfLines={2}
                      >
                        {level.description}
                      </Text>
                    </View>

                    {/* Arrow */}
                    <Icon name={ChevronRight} color={textMuted} size={24} />
                  </View>
                </CardContent>
              </Card>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          levels.length > 0 ? (
            <View style={{ marginTop: 16, alignItems: 'center' }}>
              <Text variant='caption' style={{ color: textMuted, textAlign: 'center' }}>
                More levels coming soon!{'\n'}Keep practicing to unlock advanced content.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
