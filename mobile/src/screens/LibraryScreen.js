import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api } from "../api/client";
import PosterCard from "../components/PosterCard";
import { PrimaryButton, ScreenHeader } from "../components/ui";
import { colors } from "../theme";
import { isTV, spacing } from "../utils/platform";

export default function LibraryScreen() {
  const navigation = useNavigation();
  const [movies, setMovies] = useState([]);
  const [shows, setShows] = useState([]);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([api("/library?media_type=movies"), api("/library/shows")]);
      setMovies(m || []);
      setShows(s || []);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function scan() {
    setBusy(true);
    try {
      setInfo(await api("/library/scan", { method: "POST" }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.pad}
      data={[{ key: "body" }]}
      renderItem={() => (
        <View>
          <ScreenHeader title="Local Library" subtitle="Files in Movies / Shows folders" />
          <PrimaryButton label={busy ? "Scanning…" : "Scan library"} onPress={scan} />
          {!!info && (
            <Text style={styles.sub}>
              Scanned {info.scanned} · added {info.added} · removed {info.removed}
            </Text>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}

          <Text style={styles.section}>Movies</Text>
          <FlatList
            horizontal
            data={movies}
            keyExtractor={(m) => `m-${m.id}`}
            renderItem={({ item }) => (
              <PosterCard
                title={item.title}
                subtitle="local"
                onPress={() =>
                  navigation.navigate("Detail", {
                    kind: "movie",
                    source: "local",
                    id: String(item.id),
                    title: item.title,
                  })
                }
              />
            )}
            ListEmptyComponent={<Text style={styles.sub}>No local movies</Text>}
          />

          <Text style={styles.section}>Shows</Text>
          <FlatList
            horizontal
            data={shows}
            keyExtractor={(s) => s.title}
            renderItem={({ item }) => (
              <PosterCard
                title={item.title}
                subtitle={`${item.episodes?.length || 0} eps`}
                onPress={() =>
                  navigation.navigate("Detail", {
                    kind: "show",
                    source: "local",
                    id: item.title,
                    title: item.title,
                  })
                }
              />
            )}
            ListEmptyComponent={<Text style={styles.sub}>No local shows</Text>}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: spacing, paddingBottom: 40 },
  section: {
    color: colors.text,
    fontSize: isTV ? 24 : 18,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 10,
  },
  sub: { color: colors.muted, marginVertical: 8 },
  error: { color: "#ffb4a8" },
});
