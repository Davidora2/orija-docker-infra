import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { ChatMessage, PeerIdentity } from './types';
import { IDENTITY_STORAGE_KEY } from './crypto';

const MESSAGES_KEY = 'mesh.messages.v1';
const SECRET_KEY = 'mesh.secret.v1';

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function saveIdentity(
  identity: PeerIdentity,
  secretKey: string,
): Promise<void> {
  await AsyncStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  await secureSet(SECRET_KEY, secretKey);
}

export async function loadIdentity(): Promise<{
  identity: PeerIdentity;
  secretKey: string;
} | null> {
  const raw = await AsyncStorage.getItem(IDENTITY_STORAGE_KEY);
  const secretKey = await secureGet(SECRET_KEY);
  if (!raw || !secretKey) return null;
  try {
    const identity = JSON.parse(raw) as PeerIdentity;
    return { identity, secretKey };
  } catch {
    return null;
  }
}

export async function clearIdentity(): Promise<void> {
  await AsyncStorage.removeItem(IDENTITY_STORAGE_KEY);
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(SECRET_KEY);
  } else {
    await SecureStore.deleteItemAsync(SECRET_KEY);
  }
}

export async function saveMessages(messages: ChatMessage[]): Promise<void> {
  const trimmed = messages.slice(-200);
  await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(trimmed));
}

export async function loadMessages(): Promise<ChatMessage[]> {
  const raw = await AsyncStorage.getItem(MESSAGES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}
