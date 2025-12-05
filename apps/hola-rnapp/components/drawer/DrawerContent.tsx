import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { usePathname } from 'expo-router';
import { useColor } from '@/hooks/useColor';
import { Text } from '@/components/ui/text';
import { useUser } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function DrawerContent(props: DrawerContentComponentProps) {
  const { state, descriptors, navigation } = props;
  const { user } = useUser();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const background = useColor('background');
  const cardBackground = useColor('card');
  const borderColor = useColor('border');
  const primary = useColor('primary');
  const foreground = useColor('foreground');
  const textMuted = useColor('textMuted');

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

      {/* Navigation Items - read from drawer state */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.drawerLabel ?? options.title ?? route.name;
          const isFocused = state.index === index;

          // Get the icon from options
          const IconComponent = options.drawerIcon;

          const onPress = () => {
            navigation.navigate(route.name);
            navigation.closeDrawer();
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={[
                styles.navItem,
                {
                  backgroundColor: isFocused ? cardBackground : 'transparent',
                },
              ]}
            >
              {IconComponent && (
                <View style={styles.iconContainer}>
                  {IconComponent({
                    color: isFocused ? foreground : textMuted,
                    size: 22,
                    focused: isFocused,
                  })}
                </View>
              )}
              <Text
                style={[
                  styles.navLabel,
                  {
                    color: isFocused ? foreground : textMuted,
                    fontWeight: isFocused ? '600' : '500',
                  },
                ]}
              >
                {typeof label === 'string' ? label : route.name}
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
  iconContainer: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 16,
    marginLeft: 16,
  },
});
