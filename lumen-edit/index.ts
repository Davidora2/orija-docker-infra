import 'react-native-gesture-handler';
import { Buffer } from 'buffer';

// jpeg-js expects Buffer in some encode/decode paths (web)
const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (!g.Buffer) g.Buffer = Buffer;

import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
