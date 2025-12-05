import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useRouter, usePathname } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { useUser } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  BookOpen,
  MessageSquare,
  Mic,
  GraduationCap,
  Sparkles,
  MessageCircle,
  Settings,
  Search,
} from 'lucide-react-native';

// Define the navigation items we want to show
const navigationItems = [
  { name: '(home)', label: 'Home', icon: Home, path: '/' },
  { name: 'learn', label: 'Learn', icon: BookOpen, path: '/learn' },
  { name: 'bella', label: 'Bella AI', icon: MessageSquare, path: '/bella' },
  { name: 'voice', label: 'Voice Practice', icon: Mic, path: '/voice' },
  { name: 'practice', label: 'Practice', icon: GraduationCap, path: '/practice' },
  { name: 'ai-lessons', label: 'AI Lessons', icon: Sparkles, path: '/ai-lessons' },
  { name: 'chat', label: 'Chat', icon: MessageCircle, path: '/chat' },
  { name: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  { name: 'search', label: 'Search', icon: Search, path: '/search' },
];

export function DrawerContent(props: DrawerContentComponentProps) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const background = useColor('background');
  const cardBackground = useColor('card');
  const borderColor = useColor('border');
  const primary = useColor('primary');
  const foreground = useColor('foreground');
  const textMuted = useColor('textMuted');

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/' || pathname === '/(home)';
    }
    return pathname.startsWith(path);
  };

  const handleNavigation = (path: string) => {
    router.push(path as any);
    props.navigation.closeDrawer();
  };

  return (
    <View style={[styles.container, { backgroundColor: background }]}>
      {/* User Header Section */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: cardBackground,
            borderBottomColor: borderColor,
            paddingTop: insets.top + 16,
          },
        ]}
      >
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: primary }]}>
          <Text style={styles.avatarText}>
            {user?.firstName?.charAt(0) || user?.emailAddresses?.[0]?.emailAddress?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>
        <Text variant='subtitle' style={styles.userName}>
          {user?.fullName || 'User'}
        </Text>
        <Text variant='caption' style={{ color: textMuted }}>
          {user?.primaryEmailAddress?.emailAddress || ''}
        </Text>
      </View>

      {/* Navigation Items */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
      >
        {navigationItems.map((item) => {
          const active = isActive(item.path);
          const ItemIcon = item.icon;

          return (
            <TouchableOpacity
              key={item.name}
              onPress={() => handleNavigation(item.path)}
              activeOpacity={0.7}
              style={[
                styles.navItem,
                {
                  backgroundColor: active ? cardBackground : 'transparent',
                },
              ]}
            >
              <Icon
                name={ItemIcon}
                size={22}
                color={active ? foreground : textMuted}
              />
              <Text
                style={[
                  styles.navLabel,
                  {
                    color: active ? foreground : textMuted,
                    fontWeight: active ? '600' : '500',
                  },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </DrawerContentScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  userName: {
    marginBottom: 4,
  },
  scrollContent: {
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 16,
    marginLeft: 16,
  },
});
