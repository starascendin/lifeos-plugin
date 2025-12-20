import { useCallback, useState } from 'react';
import { Pressable, View, ViewStyle, Platform } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Plus, Mic, FileText } from 'lucide-react-native';
import { useColor } from '@/hooks/useColor';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/clerk-expo';
import { RadialMenuItem } from './RadialMenuItem';
import { VoiceMemoModal } from './VoiceMemoModal';
import { QuickNoteModal } from './QuickNoteModal';
import { useVoiceMemoStorage } from '@/hooks/useVoiceMemoStorage';
import { useQuickNotes } from '@/hooks/useQuickNotes';
import { QuickNote } from '@/utils/quicknotes/storage';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 400,
  mass: 0.5,
};

interface QuickAddFABProps {
  onVoiceMemoComplete?: (uri: string, duration: number) => void;
  onQuickNoteSaved?: (note: QuickNote) => void;
}

export function QuickAddFAB({
  onVoiceMemoComplete,
  onQuickNoteSaved,
}: QuickAddFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showVoiceMemoModal, setShowVoiceMemoModal] = useState(false);
  const [showQuickNoteModal, setShowQuickNoteModal] = useState(false);

  const { userId } = useAuth();
  const primary = useColor('primary');
  const card = useColor('card');
  const text = useColor('text');
  const redColor = useColor('red');
  const blueColor = useColor('blue');

  const { addMemo } = useVoiceMemoStorage(userId ?? null);
  const { addNote } = useQuickNotes();

  // Animation values
  const menuProgress = useSharedValue(0);
  const fabRotation = useSharedValue(0);
  const fabScale = useSharedValue(1);
  const backdropOpacity = useSharedValue(0);

  const triggerHaptic = useCallback((style = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(style);
    }
  }, []);

  const openMenu = useCallback(() => {
    setIsOpen(true);
    triggerHaptic();
    menuProgress.value = withSpring(1, SPRING_CONFIG);
    fabRotation.value = withSpring(45, SPRING_CONFIG);
    backdropOpacity.value = withTiming(1, { duration: 200 });
  }, [menuProgress, fabRotation, backdropOpacity, triggerHaptic]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    menuProgress.value = withSpring(0, SPRING_CONFIG);
    fabRotation.value = withSpring(0, SPRING_CONFIG);
    backdropOpacity.value = withTiming(0, { duration: 150 });
  }, [menuProgress, fabRotation, backdropOpacity, triggerHaptic]);

  const toggleMenu = useCallback(() => {
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }, [isOpen, openMenu, closeMenu]);

  const handleVoiceMemoPress = useCallback(() => {
    closeMenu();
    setTimeout(() => setShowVoiceMemoModal(true), 100);
  }, [closeMenu]);

  const handleQuickNotePress = useCallback(() => {
    closeMenu();
    setTimeout(() => setShowQuickNoteModal(true), 100);
  }, [closeMenu]);

  const handleVoiceMemoSave = useCallback(
    async (uri: string, duration: number) => {
      await addMemo(uri, duration);
      onVoiceMemoComplete?.(uri, duration);
    },
    [addMemo, onVoiceMemoComplete]
  );

  const handleQuickNoteSave = useCallback(
    async (text: string) => {
      const note = await addNote(text);
      onQuickNoteSaved?.(note);
    },
    [addNote, onQuickNoteSaved]
  );

  // Animated styles
  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: fabScale.value },
      { rotate: `${fabRotation.value}deg` },
    ],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    pointerEvents: backdropOpacity.value > 0 ? 'auto' : 'none',
  }));

  const containerStyle: ViewStyle = {
    position: 'absolute',
    bottom: 24,
    right: 24,
  };

  const fabStyle: ViewStyle = {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  };

  const backdropStyle: ViewStyle = {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -100,
    bottom: -100,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  };

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[backdropStyle, backdropAnimatedStyle]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={closeMenu}
        />
      </Animated.View>

      {/* FAB Container */}
      <View style={containerStyle}>
        {/* Menu Items */}
        <RadialMenuItem
          icon={Mic}
          label="Voice"
          angle={-135}
          distance={80}
          progress={menuProgress}
          delay={0}
          onPress={handleVoiceMemoPress}
          color={redColor}
          backgroundColor={card}
        />
        <RadialMenuItem
          icon={FileText}
          label="Note"
          angle={-45}
          distance={80}
          progress={menuProgress}
          delay={50}
          onPress={handleQuickNotePress}
          color={blueColor}
          backgroundColor={card}
        />

        {/* FAB Button */}
        <AnimatedPressable
          style={[fabStyle, fabAnimatedStyle]}
          onPress={toggleMenu}
          onPressIn={() => {
            fabScale.value = withSpring(0.95, SPRING_CONFIG);
          }}
          onPressOut={() => {
            fabScale.value = withSpring(1, SPRING_CONFIG);
          }}
        >
          <Icon name={Plus} size={28} color="#FFFFFF" />
        </AnimatedPressable>
      </View>

      {/* Modals */}
      <VoiceMemoModal
        visible={showVoiceMemoModal}
        onClose={() => setShowVoiceMemoModal(false)}
        onSave={handleVoiceMemoSave}
      />
      <QuickNoteModal
        visible={showQuickNoteModal}
        onClose={() => setShowQuickNoteModal(false)}
        onSave={handleQuickNoteSave}
      />
    </>
  );
}
