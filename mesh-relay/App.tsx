import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  IBMPlexMono_400Regular,
} from '@expo-google-fonts/ibm-plex-mono';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MeshProvider, useMesh } from './src/context/MeshContext';
import { OnboardingScreen } from './src/ui/screens/OnboardingScreen';
import { ChatScreen } from './src/ui/screens/ChatScreen';
import { PeersScreen } from './src/ui/screens/PeersScreen';
import { SettingsScreen } from './src/ui/screens/SettingsScreen';
import { colors } from './src/ui/theme';

type Screen = 'chat' | 'peers' | 'settings';

function Root() {
  const { ready, identity } = useMesh();
  const [screen, setScreen] = useState<Screen>('chat');

  const openPeers = useCallback(() => setScreen('peers'), []);
  const openSettings = useCallback(() => setScreen('settings'), []);
  const back = useCallback(() => setScreen('chat'), []);

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!identity) {
    return <OnboardingScreen />;
  }

  if (screen === 'peers') {
    return <PeersScreen onBack={back} />;
  }
  if (screen === 'settings') {
    return <SettingsScreen onBack={back} />;
  }

  return (
    <ChatScreen onOpenPeers={openPeers} onOpenSettings={openSettings} />
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    IBMPlexMono_400Regular,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <MeshProvider>
        <Root />
      </MeshProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
