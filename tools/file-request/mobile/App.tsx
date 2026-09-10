import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KEYS, pingInbox, uploadFile, type InboxInfo } from "./src/api";

export default function App() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [inbox, setInbox] = useState<InboxInfo | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const savedUrl = (await AsyncStorage.getItem(KEYS.url)) || "";
      const savedToken = (await AsyncStorage.getItem(KEYS.token)) || "";
      setUrl(savedUrl);
      setToken(savedToken);
      if (savedUrl && savedToken) {
        try {
          setInbox(await pingInbox(savedUrl, savedToken));
        } catch (error) {
          setStatus(error instanceof Error ? error.message : "Saved login failed");
        }
      }
      setReady(true);
    })();
  }, []);

  async function connect() {
    setBusy(true);
    setStatus("");
    try {
      const info = await pingInbox(url.trim(), token.trim());
      await AsyncStorage.setItem(KEYS.url, url.trim());
      await AsyncStorage.setItem(KEYS.token, token.trim());
      setInbox(info);
      setStatus(`Connected · ${info.destination.user}`);
    } catch (error) {
      setInbox(null);
      setStatus(error instanceof Error ? error.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function send(fromCamera: boolean) {
    if (!inbox) return;
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus("Permission needed to send photos");
      return;
    }
    const picked = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          allowsMultipleSelection: true,
          quality: 1,
          orderedSelection: true,
        });
    if (picked.canceled || !picked.assets?.length) return;
    setBusy(true);
    let ok = 0;
    try {
      for (const [index, asset] of picked.assets.entries()) {
        const name =
          asset.fileName ||
          `upload-${Date.now()}-${index}.${asset.mimeType?.includes("video") ? "mp4" : "jpg"}`;
        setStatus(`Sending ${index + 1}/${picked.assets.length}: ${name}`);
        await uploadFile(
          url.trim(),
          token.trim(),
          {
            uri: asset.uri,
            name,
            mime: asset.mimeType || "image/jpeg",
            size: asset.fileSize,
          },
          (done, total) => setStatus(`${name} · chunk ${done}/${total}`),
        );
        ok += 1;
      }
      setStatus(`Sent ${ok} file${ok === 1 ? "" : "s"} to ${inbox.destination.user} · ${inbox.destination.album}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0f6b5c" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.brand}>Immich Send</Text>
          <Text style={styles.sub}>
            Upload from anywhere. Files go through your Orija relay in 8MB chunks with no size cap, then into Immich on your home
            server — Cloudflare’s 100MB tunnel limit does not apply.
          </Text>

          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://photos-inbox.example.com"
            value={url}
            onChangeText={setUrl}
          />
          <Text style={styles.label}>Phone token</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="token from admin → Phone inboxes"
            value={token}
            onChangeText={setToken}
          />
          <Pressable style={styles.btn} onPress={connect} disabled={busy}>
            <Text style={styles.btnText}>{inbox ? "Reconnect" : "Connect"}</Text>
          </Pressable>

          {inbox ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{inbox.label}</Text>
              <Text style={styles.muted}>
                Goes to {inbox.destination.user} · {inbox.destination.album}
              </Text>
              <Pressable style={styles.btn} onPress={() => send(false)} disabled={busy}>
                <Text style={styles.btnText}>Choose photos or videos</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.secondary]} onPress={() => send(true)} disabled={busy}>
                <Text style={styles.secondaryText}>Take photo</Text>
              </Pressable>
            </View>
          ) : null}

          {busy ? <ActivityIndicator color="#0f6b5c" style={{ marginTop: 16 }} /> : null}
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f3efe6" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f3efe6" },
  page: { padding: 24, paddingBottom: 48 },
  brand: { fontSize: 32, fontWeight: "700", color: "#1c1914" },
  sub: { marginTop: 8, color: "#6b6458", lineHeight: 22 },
  label: { marginTop: 18, marginBottom: 6, color: "#6b6458", fontSize: 13 },
  input: {
    backgroundColor: "#fff",
    borderColor: "#ddd4c4",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1c1914",
  },
  btn: {
    marginTop: 14,
    backgroundColor: "#0f6b5c",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  secondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#ddd4c4" },
  secondaryText: { color: "#1c1914", fontWeight: "700" },
  card: {
    marginTop: 24,
    backgroundColor: "#fffdf8",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ddd4c4",
    padding: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#1c1914" },
  muted: { color: "#6b6458", marginTop: 4, marginBottom: 8 },
  status: { marginTop: 16, color: "#1c1914", lineHeight: 22 },
});
