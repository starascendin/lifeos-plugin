import { FlatList, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'convex/react';
import { api } from '@holaai/convex/_generated/api';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import {
  ChevronRight,
  BookOpen,
  Languages,
  MessageSquare,
  Utensils,
  Users,
  Hash,
  Plane,
  ShoppingBag,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import type { Id } from '@holaai/convex/_generated/dataModel';

// Map category names to icons
const categoryIcons: Record<string, React.ComponentType<any>> = {
  Greetings: MessageSquare,
  Numbers: Hash,
  'Food & Drinks': Utensils,
  Family: Users,
  Travel: Plane,
  Shopping: ShoppingBag,
  Grammar: BookOpen,
  Vocabulary: Languages,
};

export default function LevelDetailScreen() {
  const { levelId } = useLocalSearchParams<{ levelId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const level = useQuery(api.content.getLevel, {
    levelId: levelId as Id<'contentLevels'>,
  });
  const categories = useQuery(api.content.listCategories, {
    levelId: levelId as Id<'contentLevels'>,
  });

  const primary = useColor('primary');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const foreground = useColor('foreground');

  if (level === undefined || categories === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Spinner variant='circle' />
      </View>
    );
  }

  if (!level) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: background }}>
        <Text>Level not found</Text>
      </View>
    );
  }

  const navigateToCategory = (categoryId: Id<'contentCategories'>) => {
    router.push(`/learn/category/${categoryId}`);
  };

  const levelColors: Record<string, string> = {
    A1: '#22c55e',
    A2: '#3b82f6',
    B1: '#f59e0b',
    B2: '#8b5cf6',
    C1: '#ef4444',
    C2: '#ec4899',
  };

  const levelColor = levelColors[level.name] || primary;

  return (
    <>
      <Stack.Screen
        options={{
          title: `${level.name} - ${level.displayName}`,
          headerShown: true,
          headerTintColor: foreground,
          headerStyle: { backgroundColor: background },
        }}
      />

      <View style={{ flex: 1, backgroundColor: background }}>
        <FlatList
          data={categories}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 16,
          }}
          ListHeaderComponent={
            <View style={{ marginBottom: 24 }}>
              {/* Level Header Card */}
              <Card
                style={{
                  backgroundColor: levelColor,
                  marginBottom: 16,
                }}
              >
                <CardContent>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 16,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>
                        {level.name}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
                        {level.displayName}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
                        {level.description}
                      </Text>
                    </View>
                  </View>
                </CardContent>
              </Card>

              <Text variant='subtitle' style={{ marginBottom: 8 }}>
                Categories
              </Text>
              <Text variant='caption' style={{ color: textMuted }}>
                Select a category to start learning
              </Text>
            </View>
          }
          ListEmptyComponent={
            <Card>
              <CardContent>
                <Text style={{ textAlign: 'center', color: textMuted }}>
                  No categories available for this level yet.
                </Text>
              </CardContent>
            </Card>
          }
          renderItem={({ item: category }) => {
            const CategoryIcon = categoryIcons[category.name] || BookOpen;

            return (
              <TouchableOpacity
                onPress={() => navigateToCategory(category._id)}
                activeOpacity={0.7}
              >
                <Card style={{ marginBottom: 12 }}>
                  <CardContent style={{ padding: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {/* Icon */}
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 10,
                          backgroundColor: `${levelColor}20`,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: 14,
                        }}
                      >
                        <Icon name={CategoryIcon} color={levelColor} size={22} />
                      </View>

                      {/* Content */}
                      <View style={{ flex: 1 }}>
                        <Text variant='title' style={{ fontSize: 16, marginBottom: 2 }}>
                          {category.name}
                        </Text>
                        <Text
                          variant='caption'
                          style={{ color: textMuted }}
                          numberOfLines={1}
                        >
                          {category.description}
                        </Text>
                      </View>

                      {/* Arrow */}
                      <Icon name={ChevronRight} color={textMuted} size={20} />
                    </View>
                  </CardContent>
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </>
  );
}
