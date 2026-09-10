import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { DEFAULT_SERVER_URL, pingInbox, uploadFile, type InboxInfo } from "./src/api";

export default function App() {
  const [inbox, setInbox] = useState<InboxInfo | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pingInbox()
      .then(setInbox)
      .catch((error) => setStatus(error instanceof Error ? error.message : "Cannot reach home"))
      .finally(() => undefined);
  }, []);

  async function send(fromCamera: boolean) {
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
          DEFAULT_SERVER_URL,
          {
            uri: asset.uri,
            name,
            mime: asset.mimeType || "image/jpeg",
            size: asset.fileSize,
          },
          (done, total) => setStatus(`${name} · ${done}/${total}`),
        );
        ok += 1;
      }
      setStatus(`Sent ${ok} file${ok === 1 ? "" : "s"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.brand}>Send photos</Text>
          <Text style={styles.sub}>
            Tap below and choose photos or videos. They go home automatically. No login, no size limit.
          </Text>
          <Pressable style={styles.btn} onPress={() => send(false)} disabled={busy}>
            <Text style={styles.btnText}>Choose photos or videos</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.secondary]} onPress={() => send(true)} disabled={busy}>
            <Text style={styles.secondaryText}>Take photo</Text>
          </Pressable>
          {inbox ? <Text style={styles.muted}>Ready</Text> : null}
          {busy ? <ActivityIndicator color="#0f6b5c" style={{ marginTop: 16 }} /> : null}
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f3efe6" },
  page: { padding: 24, paddingBottom: 48 },
  brand: { fontSize: 32, fontWeight: "700", color: "#1c1914" },
  sub: { marginTop: 8, marginBottom: 12, color: "#6b6458", lineHeight: 22 },
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
  muted: { color: "#6b6458", marginTop: 18 },
  status: { marginTop: 16, color: "#1c1914", lineHeight: 22 },
});
