import { Drawer } from 'expo-router/drawer';
import { useColor } from '@/hooks/useColor';
import { DrawerContent } from '@/components/drawer/DrawerContent';
import {
  Home,
  MessageCircle,
  Settings,
  Search,
  BookOpen,
  MessageSquare,
  Mic,
  GraduationCap,
  Sparkles,
} from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

export default function DrawerLayout() {
  const foreground = useColor('foreground');
  const background = useColor('background');
  const textMuted = useColor('textMuted');
  const cardBackground = useColor('card');

  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        drawerType: 'slide',
        drawerStyle: {
          backgroundColor: background,
          width: 280,
        },
        drawerActiveBackgroundColor: cardBackground,
        drawerActiveTintColor: foreground,
        drawerInactiveTintColor: textMuted,
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: '500',
        },
        drawerItemStyle: {
          marginHorizontal: 8,
          borderRadius: 8,
        },
        swipeEnabled: true,
        swipeEdgeWidth: 100,
      }}
      drawerContent={(props) => <DrawerContent {...props} />}
    >
      <Drawer.Screen
        name='(home)'
        options={{
          drawerLabel: 'Home1',
          title: 'Home1',
          drawerIcon: ({ color, size }) => (
            <Icon name={Home} color={color} size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name='learn'
        options={{
          drawerLabel: 'Learn',
          title: 'Learn Spanish1',
          drawerIcon: ({ color, size }) => (
            <Icon name={BookOpen} color={color} size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name='bella'
        options={{
          drawerLabel: 'Bella AI',
          title: 'Bella Conversations',
          drawerIcon: ({ color, size }) => (
            <Icon name={MessageSquare} color={color} size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name='voice'
        options={{
          drawerLabel: 'Voice Practice1',
          title: 'Voice Practice',
          drawerIcon: ({ color, size }) => (
            <Icon name={Mic} color={color} size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name='practice'
        options={{
          drawerLabel: 'Practice',
          title: 'Practice & Quiz',
          drawerIcon: ({ color, size }) => (
            <Icon name={GraduationCap} color={color} size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name='ai-lessons'
        options={{
          drawerLabel: 'AI Lessons',
          title: 'AI Lessons',
          drawerIcon: ({ color, size }) => (
            <Icon name={Sparkles} color={color} size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name='chat'
        options={{
          drawerLabel: 'Chat',
          title: 'Chat',
          drawerIcon: ({ color, size }) => (
            <Icon name={MessageCircle} color={color} size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name='settings'
        options={{
          drawerLabel: 'Settings',
          title: 'Settings',
          drawerIcon: ({ color, size }) => (
            <Icon name={Settings} color={color} size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name='search'
        options={{
          drawerLabel: 'Search',
          title: 'Search',
          drawerIcon: ({ color, size }) => (
            <Icon name={Search} color={color} size={size} />
          ),
        }}
      />
    </Drawer>
  );
}
