import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createIdentity } from '../mesh/crypto';
import { MeshNode, VirtualRelayPhone } from '../mesh/MeshNode';
import {
  clearIdentity,
  loadIdentity,
  loadMessages,
  saveIdentity,
  saveMessages,
} from '../mesh/store';
import type {
  ChatMessage,
  MeshStats,
  NearbyPeer,
  PeerIdentity,
} from '../mesh/types';
import { SimulationTransport } from '../transport/SimulationTransport';
import { BleTransport } from '../transport/BleTransport';
import { LanTransport } from '../transport/LanTransport';

type MeshContextValue = {
  ready: boolean;
  identity: PeerIdentity | null;
  messages: ChatMessage[];
  peers: NearbyPeer[];
  stats: MeshStats;
  demoRelays: number;
  selectedPeerId: string | undefined;
  setSelectedPeerId: (id: string | undefined) => void;
  bootstrap: (displayName: string) => Promise<void>;
  resetIdentity: () => Promise<void>;
  sendMessage: (body: string, to?: string) => Promise<void>;
  setDemoRelays: (count: number) => Promise<void>;
};

const defaultStats: MeshStats = {
  peersNearby: 0,
  messagesStored: 0,
  messagesRelayed: 0,
  transport: 'simulation',
  online: false,
};

const MeshContext = createContext<MeshContextValue | null>(null);

export function MeshProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [identity, setIdentity] = useState<PeerIdentity | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peers, setPeers] = useState<NearbyPeer[]>([]);
  const [stats, setStats] = useState<MeshStats>(defaultStats);
  const [demoRelays, setDemoRelaysState] = useState(2);
  const [selectedPeerId, setSelectedPeerId] = useState<string | undefined>(
    undefined,
  );

  const nodeRef = useRef<MeshNode | null>(null);
  const relaysRef = useRef<VirtualRelayPhone[]>([]);
  const secretRef = useRef<string | null>(null);

  const tearDownRelays = useCallback(async () => {
    const relays = relaysRef.current;
    relaysRef.current = [];
    await Promise.all(relays.map((r) => r.stop()));
  }, []);

  const tearDownNode = useCallback(async () => {
    await nodeRef.current?.stop();
    nodeRef.current = null;
  }, []);

  const startNode = useCallback(
    async (id: PeerIdentity, secretKey: string, initial: ChatMessage[]) => {
      await tearDownNode();
      const node = new MeshNode(id, secretKey, initial);
      nodeRef.current = node;
      secretRef.current = secretKey;

      node.subscribe((snap) => {
        setMessages(snap.messages);
        setPeers(snap.peers);
        setStats(snap.stats);
        void saveMessages(snap.messages);
      });

      const sim = new SimulationTransport(id);
      const ble = new BleTransport(id);
      const lan = new LanTransport(id);
      await node.start([sim, ble, lan]);
    },
    [tearDownNode],
  );

  const spawnRelays = useCallback(
    async (count: number) => {
      await tearDownRelays();
      const names = ['Relay North', 'Relay Ridge', 'Relay Cove', 'Relay Pass'];
      const created: VirtualRelayPhone[] = [];
      for (let i = 0; i < count; i += 1) {
        const phone = new VirtualRelayPhone(names[i] ?? `Relay ${i + 1}`, null);
        await phone.start();
        created.push(phone);
      }
      relaysRef.current = created;
      setDemoRelaysState(count);
    },
    [tearDownRelays],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = await loadIdentity();
      const storedMessages = await loadMessages();
      if (cancelled) return;

      if (existing) {
        setIdentity(existing.identity);
        await startNode(existing.identity, existing.secretKey, storedMessages);
        await spawnRelays(2);
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
      void tearDownRelays();
      void tearDownNode();
    };
  }, [spawnRelays, startNode, tearDownNode, tearDownRelays]);

  const bootstrap = useCallback(
    async (displayName: string) => {
      const { identity: id, secretKey } = await createIdentity(displayName);
      await saveIdentity(id, secretKey);
      setIdentity(id);
      await startNode(id, secretKey, []);
      await spawnRelays(2);
    },
    [spawnRelays, startNode],
  );

  const resetIdentity = useCallback(async () => {
    await tearDownRelays();
    await tearDownNode();
    await clearIdentity();
    await saveMessages([]);
    setIdentity(null);
    setMessages([]);
    setPeers([]);
    setStats(defaultStats);
    setSelectedPeerId(undefined);
  }, [tearDownNode, tearDownRelays]);

  const sendMessage = useCallback(async (body: string, to?: string) => {
    if (!nodeRef.current) throw new Error('Mesh not started');
    await nodeRef.current.sendChat(body, to);
  }, []);

  const setDemoRelays = useCallback(
    async (count: number) => {
      const clamped = Math.max(0, Math.min(4, count));
      await spawnRelays(clamped);
    },
    [spawnRelays],
  );

  const value = useMemo(
    () => ({
      ready,
      identity,
      messages,
      peers,
      stats,
      demoRelays,
      selectedPeerId,
      setSelectedPeerId,
      bootstrap,
      resetIdentity,
      sendMessage,
      setDemoRelays,
    }),
    [
      ready,
      identity,
      messages,
      peers,
      stats,
      demoRelays,
      selectedPeerId,
      bootstrap,
      resetIdentity,
      sendMessage,
      setDemoRelays,
    ],
  );

  return <MeshContext.Provider value={value}>{children}</MeshContext.Provider>;
}

export function useMesh(): MeshContextValue {
  const ctx = useContext(MeshContext);
  if (!ctx) throw new Error('useMesh must be used within MeshProvider');
  return ctx;
}
