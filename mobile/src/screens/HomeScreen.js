import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api } from "../api/client";
import PosterCard from "../components/PosterCard";
import { ScreenHeader } from "../components/ui";
import { colors } from "../theme";
import { isTV, spacing } from "../utils/platform";

export default function HomeScreen() {
  const navigation = useNavigation();
  const [movies, setMovies] = useState([]);
  const [shows, setShows] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [st, favs] = await Promise.all([api("/xtream/status"), api("/favorites")]);
      setStatus(st);
      setFavorites((favs || []).slice(0, 12));
      if (st?.connected) {
        const [m, s] = await Promise.all([
          api("/xtream/catalog/movies?limit=20"),
          api("/xtream/catalog/shows?limit=20"),
        ]);
        setMovies(m.items || []);
        setShows(s.items || []);
      } else {
        const local = await api("/library?media_type=movies");
        setMovies((local || []).map((x) => ({ ...x, id: String(x.id), source: "local", media_type: "movie" })));
        setShows([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openItem(item, fallbackType) {
    const type = item.media_type || fallbackType;
    const source = item.source || "xtream";
    const id = item.id || item.external_id;
    if (type === "show") {
      navigation.navigate("Detail", { kind: "show", source, id, title: item.title });
    } else {
      navigation.navigate("Detail", { kind: "movie", source, id, title: item.title });
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={[{ key: "body" }]}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}
      renderItem={() => (
        <View>
          <ScreenHeader
            title="Now Showing"
            subtitle={
              status?.connected
                ? `Xtream connected · max ${status.max_connections || "?"} lines`
                : "Local library / connect Xtream on server"
            }
          />
          {!!error && <Text style={styles.error}>{error}</Text>}

          {favorites.length > 0 && (
            <Section title="Favorites">
              <FlatList
                horizontal
                data={favorites}
                keyExtractor={(item) => `fav-${item.id}`}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <PosterCard
                    title={item.title}
                    subtitle={item.download_status}
                    poster={item.poster}
                    onPress={() => openItem(item, item.media_type)}
                  />
                )}
              />
            </Section>
          )}

          <Section title="Movies">
            <FlatList
              horizontal
              data={movies}
              keyExtractor={(item) => `m-${item.source}-${item.id}`}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <PosterCard
                  title={item.title}
                  subtitle={[item.year, item.source].filter(Boolean).join(" · ")}
                  poster={item.poster}
                  onPress={() => openItem(item, "movie")}
                />
              )}
              ListEmptyComponent={<Text style={styles.empty}>No movies yet</Text>}
            />
          </Section>

          <Section title="Shows">
            <FlatList
              horizontal
              data={shows}
              keyExtractor={(item) => `s-${item.source}-${item.id}`}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <PosterCard
                  title={item.title}
                  subtitle={item.year}
                  poster={item.poster}
                  onPress={() => openItem(item, "show")}
                />
              )}
              ListEmptyComponent={<Text style={styles.empty}>No shows yet</Text>}
            />
          </Section>
        </View>
      )}
    />
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  section: { marginBottom: 22 },
  sectionTitle: { color: colors.text, fontSize: isTV ? 26 : 18, fontWeight: "700", marginBottom: 10 },
  empty: { color: colors.muted, paddingVertical: 12 },
  error: { color: "#ffb4a8", marginBottom: 12 },
});
