import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api } from "../api/client";
import PosterCard from "../components/PosterCard";
import { ScreenHeader } from "../components/ui";
import { colors } from "../theme";
import { isTV, spacing } from "../utils/platform";

export default function SearchScreen() {
  const navigation = useNavigation();
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const term = q.trim();
    if (term.length < 1) {
      setItems([]);
      setTotal(0);
      setError("");
      return;
    }
    let alive = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api(`/search?q=${encodeURIComponent(term)}&limit=60`);
        if (!alive) return;
        setItems(data.items || []);
        setTotal(data.total || 0);
        setError("");
      } catch (err) {
        if (alive) {
          setError(err.message);
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);

  function openItem(item) {
    if (item.media_type === "live") {
      navigation.navigate("Player", {
        media_type: "live",
        source: item.source || "xtream",
        external_id: String(item.id),
        title: item.title,
        container: "ts",
        poster: item.poster,
      });
      return;
    }
    navigation.navigate("Detail", {
      kind: item.media_type === "show" ? "show" : "movie",
      source: item.source || "xtream",
      id: String(item.id),
      title: item.title,
    });
  }

  const numColumns = isTV ? 5 : 3;

  return (
    <View style={styles.container}>
      <View style={styles.pad}>
        <ScreenHeader
          title="Search"
          subtitle={
            loading
              ? "Searching…"
              : q.trim()
                ? `${total} match${total === 1 ? "" : "es"}`
                : "Movies, shows, live & local library"
          }
        />
        <TextInput
          style={styles.search}
          placeholder="Search Shogun, movies, channels…"
          placeholderTextColor={colors.muted}
          value={q}
          onChangeText={setQ}
          autoFocus={!isTV}
          hasTVPreferredFocus
          returnKeyType="search"
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(item) => `${item.source}-${item.media_type}-${item.id}`}
          contentContainerStyle={styles.pad}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {q.trim() ? `No matches for “${q.trim()}”` : "Type a title to search everywhere."}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1 / numColumns, alignItems: "center" }}>
              <PosterCard
                title={item.title}
                subtitle={[item.year, item.origin || item.source, item.media_type].filter(Boolean).join(" · ")}
                poster={item.poster}
                onPress={() => openItem(item)}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: spacing, paddingTop: spacing },
  search: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: isTV ? 16 : 10,
    marginBottom: 12,
    fontSize: isTV ? 20 : 16,
  },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
  error: { color: "#ffb4a8", marginBottom: 8 },
});
