import { Drawer } from 'expo-router/drawer';
import { useColor } from '@/hooks/useColor';
import { DrawerContent } from '@/components/drawer/DrawerContent';
import {
  Home,
  Settings,
  Map,
  MessageSquare,
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
          drawerLabel: 'Home',
          title: 'Home1',
          drawerIcon: ({ color, size }) => (
            <Icon name={Home} color={color} size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name='journey'
        options={{
          drawerLabel: 'A1 Journey',
          title: 'A1 Learning Journey',
          drawerIcon: ({ color, size }) => (
            <Icon name={Map} color={color} size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name='conversation-ai'
        options={{
          drawerLabel: 'Conversation AI',
          title: 'Conversation AI',
          drawerIcon: ({ color, size }) => (
            <Icon name={MessageSquare} color={color} size={size} />
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

    </Drawer>
  );
}
