import { useRef, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const ARCHIVE_WIDTH = 88;
const DELETE_WIDTH = 80;
const THRESHOLD = 56;

type Props = {
  children: ReactNode;
  onArchive: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  /** Hint under the row content when not swiping */
  hint?: string;
};

/**
 * Swipe left to reveal Archive (primary). Optional Delete is secondary.
 * Uses PanResponder so we avoid extra native gesture deps for APK builds.
 */
export function SwipeableRow({
  children,
  onArchive,
  onDelete,
  disabled,
  hint,
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openWidth = onDelete ? ARCHIVE_WIDTH + DELETE_WIDTH : ARCHIVE_WIDTH;
  const openRef = useRef(0);

  const close = () => {
    openRef.current = 0;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  };

  const open = () => {
    openRef.current = -openWidth;
    Animated.spring(translateX, {
      toValue: -openWidth,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        if (disabled) return false;
        return (
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2
        );
      },
      onPanResponderMove: (_evt, gesture) => {
        const next = Math.min(0, Math.max(-openWidth - 24, openRef.current + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const current = openRef.current + gesture.dx;
        if (gesture.dx < -THRESHOLD || current < -openWidth / 2) {
          // Full swipe past archive threshold → archive immediately
          if (gesture.dx < -THRESHOLD * 2.2 && !onDelete) {
            close();
            onArchive();
            return;
          }
          open();
          return;
        }
        close();
      },
      onPanResponderTerminate: () => close(),
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={[styles.actions, { width: openWidth }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Archive"
          onPress={() => {
            close();
            onArchive();
          }}
          style={[styles.actionBtn, styles.archiveBtn, { width: ARCHIVE_WIDTH }]}
        >
          <Text style={styles.actionText}>Archive</Text>
        </Pressable>
        {onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete"
            onPress={() => {
              close();
              onDelete();
            }}
            style={[styles.actionBtn, styles.deleteBtn, { width: DELETE_WIDTH }]}
          >
            <Text style={styles.actionText}>Delete</Text>
          </Pressable>
        ) : null}
      </View>
      <Animated.View
        style={[styles.foreground, { transform: [{ translateX }] }]}
        {...pan.panHandlers}
      >
        {children}
      </Animated.View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
  },
  actions: {
    ...StyleSheet.absoluteFill,
    left: undefined,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  archiveBtn: {
    backgroundColor: '#617A57',
  },
  deleteBtn: {
    backgroundColor: '#C9634F',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  foreground: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  hint: {
    marginTop: 4,
    fontSize: 11,
    color: '#6C7771',
    paddingHorizontal: 4,
  },
});
