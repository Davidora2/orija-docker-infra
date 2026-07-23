import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Audio, ResizeMode, Video } from "expo-av";
import { useNavigation, useRoute } from "@react-navigation/native";
import { absoluteUrl, api, getServerUrl } from "../api/client";
import { PrimaryButton } from "../components/ui";
import { colors } from "../theme";
import { isTV } from "../utils/platform";

export default function PlayerScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params || {};
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [playUrl, setPlayUrl] = useState("");
  const [sessionKey, setSessionKey] = useState(null);
  const [statusText, setStatusText] = useState("Opening stream…");

  useEffect(() => {
    let cancelled = false;
    let heartbeat;
    let openedKey = null;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });
        const opened = await api("/streams/open", {
          method: "POST",
          body: JSON.stringify({
            media_type: params.media_type,
            source: params.source,
            external_id: String(params.external_id),
            title: params.title || "Stream",
            container: params.container || (params.media_type === "live" ? "ts" : "mp4"),
            episode_id: params.episode_id ? String(params.episode_id) : null,
          }),
        });
        if (cancelled) {
          api(`/streams/${opened.session_key}/close`, { method: "POST" }).catch(() => {});
          return;
        }
        openedKey = opened.session_key;
        setSessionKey(opened.session_key);
        const base = await getServerUrl();
        setPlayUrl(absoluteUrl(base, opened.play_url));
        setStatusText("");
        heartbeat = setInterval(() => {
          api(`/streams/${opened.session_key}/heartbeat`, { method: "POST" }).catch(() => {});
        }, 25000);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to open stream");
      }
    })();

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      if (openedKey) api(`/streams/${openedKey}/close`, { method: "POST" }).catch(() => {});
    };
  }, []);

  async function close() {
    if (sessionKey) {
      try {
        await api(`/streams/${sessionKey}/close`, { method: "POST" });
      } catch {
        /* ignore */
      }
    }
    navigation.goBack();
  }

  async function onProgress(status) {
    if (!status.isLoaded || !status.durationMillis) return;
    const pos = Math.floor((status.positionMillis || 0) / 1000);
    if (pos % 10 !== 0) return;
    api("/progress", {
      method: "PUT",
      body: JSON.stringify({
        media_type: params.media_type,
        source: params.source,
        external_id: String(params.episode_id || params.external_id),
        title: params.title,
        poster: params.poster,
        position_seconds: pos,
        duration_seconds: Math.floor(status.durationMillis / 1000),
      }),
    }).catch(() => {});
  }

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        <Text style={styles.title} numberOfLines={1}>
          {params.title || "Player"}
        </Text>
        <PrimaryButton label="Close" ghost onPress={close} />
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <PrimaryButton label="Go back" onPress={close} hasTVPreferredFocus />
        </View>
      ) : playUrl ? (
        <Video
          ref={videoRef}
          style={styles.video}
          source={{ uri: playUrl }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          onPlaybackStatusUpdate={onProgress}
          onError={() => setError("Playback failed — codec or stream unavailable on this device")}
        />
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.status}>{statusText}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: isTV ? 14 : 8,
    backgroundColor: "rgba(0,0,0,0.8)",
    gap: 12,
  },
  title: { color: "#fff", flex: 1, fontSize: isTV ? 22 : 16, fontWeight: "600" },
  video: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  status: { color: colors.muted, marginTop: 12 },
  error: { color: "#ffb4a8", textAlign: "center", marginBottom: 12 },
});
