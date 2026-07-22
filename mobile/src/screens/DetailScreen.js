import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "../api/client";
import Focusable from "../components/Focusable";
import { PrimaryButton } from "../components/ui";
import { colors } from "../theme";
import { isTV, spacing } from "../utils/platform";

export default function DetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { kind, source, id } = route.params || {};
  const [item, setItem] = useState(null);
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (kind === "movie") {
          if (source === "local") {
            const local = await api(`/library/${id}`);
            if (!alive) return;
            setItem({
              id: String(local.id),
              title: local.title,
              plot: "Local file",
              poster: "",
              container: "mp4",
              source: "local",
              media_type: "movie",
            });
          } else {
            const data = await api(`/xtream/movies/${id}`);
            if (alive) setItem(data);
          }
        } else {
          if (source === "local") {
            const shows = await api("/library/shows");
            const match = (shows || []).find(
              (s) => s.title === id || String(s.episodes?.[0]?.id) === id
            );
            if (!match) throw new Error("Show not found");
            if (!alive) return;
            setItem({
              id,
              title: match.title,
              plot: "Local library",
              poster: "",
              source: "local",
              seasons: [
                {
                  season: 1,
                  episodes: match.episodes.map((ep) => ({
                    id: ep.id,
                    title: ep.title,
                    episode_num: ep.episode,
                    container: "mp4",
                  })),
                },
              ],
            });
          } else {
            const data = await api(`/xtream/shows/${id}`);
            if (alive) setItem(data);
          }
        }
      } catch (err) {
        if (alive) setError(err.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [kind, source, id]);

  async function favorite() {
    setBusy(true);
    setMsg("");
    try {
      await api("/favorites", {
        method: "POST",
        body: JSON.stringify({
          media_type: kind === "show" ? "show" : "movie",
          source,
          external_id: String(id),
          title: item.title,
          poster: item.poster,
          year: item.year,
          save_to_library: true,
        }),
      });
      setMsg(source === "xtream" ? "Favorited — saving to library…" : "Favorited");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  function playMovie() {
    navigation.navigate("Player", {
      media_type: "movie",
      source,
      external_id: String(id),
      title: item.title,
      container: item.container || "mp4",
      poster: item.poster,
    });
  }

  function playEpisode(ep) {
    navigation.navigate("Player", {
      media_type: source === "local" ? "episode" : "show",
      source,
      external_id: source === "local" ? String(ep.id) : String(id),
      episode_id: source === "local" ? undefined : String(ep.id),
      title: `${item.title} — ${ep.title}`,
      container: ep.container || "mp4",
      poster: item.poster,
    });
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!item) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const season = item.seasons?.[seasonIdx];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.posterWrap}>
          {item.poster ? (
            <Image source={{ uri: item.poster }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.posterFallback]}>
              <Text style={{ color: colors.accent }}>ORIJA</Text>
            </View>
          )}
        </View>
        <View style={styles.meta}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.sub}>{[item.year, item.rating, source].filter(Boolean).join(" · ")}</Text>
          <Text style={styles.plot}>{item.plot || "No synopsis available."}</Text>
          <View style={styles.actions}>
            {kind === "movie" ? (
              <PrimaryButton label="Play" onPress={playMovie} hasTVPreferredFocus />
            ) : (
              season?.episodes?.[0] && (
                <PrimaryButton
                  label="Play first episode"
                  onPress={() => playEpisode(season.episodes[0])}
                  hasTVPreferredFocus
                />
              )
            )}
            <PrimaryButton label={busy ? "Saving…" : "★ Favorite & Save"} ghost onPress={favorite} />
          </View>
          {!!msg && <Text style={styles.sub}>{msg}</Text>}
        </View>
      </View>

      {kind === "show" && (
        <View>
          <FlatList
            horizontal
            data={item.seasons || []}
            keyExtractor={(s) => String(s.season)}
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
            renderItem={({ item: s, index }) => (
              <Focusable
                onPress={() => setSeasonIdx(index)}
                style={[styles.chip, index === seasonIdx && styles.chipActive]}
              >
                <Text style={[styles.chipText, index === seasonIdx && styles.chipTextActive]}>
                  Season {s.season}
                </Text>
              </Focusable>
            )}
          />
          {(season?.episodes || []).map((ep) => (
            <Focusable key={ep.id} onPress={() => playEpisode(ep)} style={styles.episode}>
              <View style={{ flex: 1 }}>
                <Text style={styles.epTitle}>
                  E{ep.episode_num ?? "?"} · {ep.title}
                </Text>
                {!!ep.plot && <Text style={styles.sub}>{ep.plot}</Text>}
              </View>
              <Text style={styles.playHint}>Play</Text>
            </Focusable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  hero: { flexDirection: isTV ? "row" : "column", gap: 18, marginBottom: 20 },
  posterWrap: { alignSelf: isTV ? "flex-start" : "center" },
  poster: { width: isTV ? 220 : 180, height: isTV ? 330 : 270, borderRadius: 14 },
  posterFallback: {
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  meta: { flex: 1 },
  title: { color: colors.text, fontSize: isTV ? 36 : 26, fontWeight: "700" },
  sub: { color: colors.muted, marginTop: 6, lineHeight: 20 },
  plot: { color: colors.text, marginTop: 12, lineHeight: 22, opacity: 0.9 },
  actions: { marginTop: 12, flexDirection: isTV ? "row" : "column", gap: 10, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted },
  chipTextActive: { color: "#14110b", fontWeight: "700" },
  episode: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 12,
  },
  epTitle: { color: colors.text, fontWeight: "600", fontSize: isTV ? 18 : 15 },
  playHint: { color: colors.accent, fontWeight: "700" },
  error: { color: "#ffb4a8" },
});
