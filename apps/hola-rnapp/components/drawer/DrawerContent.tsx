import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItemList,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useColor } from '@/hooks/useColor';
import { Text } from '@/components/ui/text';
import { useUser } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function DrawerContent(props: DrawerContentComponentProps) {
  const { user } = useUser();
  const insets = useSafeAreaInsets();

  const background = useColor('background');
  const cardBackground = useColor('card');
  const borderColor = useColor('border');
  const primary = useColor('primary');

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
        <Text variant='caption'>
          {user?.primaryEmailAddress?.emailAddress || ''}
        </Text>
      </View>

      {/* Navigation Items */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
      >
        <DrawerItemList {...props} />
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
  },
});
