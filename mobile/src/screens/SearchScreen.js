import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api } from "../api/client";
import PosterCard from "../components/PosterCard";
import Focusable from "../components/Focusable";
import { ScreenHeader } from "../components/ui";
import { colors } from "../theme";
import { isTV, spacing } from "../utils/platform";

export default function SearchScreen() {
  const navigation = useNavigation();
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const term = q.trim();
    if (term.length < 1) {
      setItems([]);
      setSuggestions([]);
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
        setSuggestions(data.suggestions || []);
        setTotal(data.total || 0);
        setError("");
      } catch (err) {
        if (alive) {
          setError(err.message);
          setItems([]);
          setSuggestions([]);
          setTotal(0);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 220);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);

  function openItem(item) {
    if (item.kind === "prediction" || item.source === "tmdb" || !item.id) {
      setQ(item.title);
      return;
    }
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
              ? "Recognizing titles…"
              : q.trim()
                ? `${total} match${total === 1 ? "" : "es"}`
                : "Fuzzy match + predictions"
          }
        />
        <TextInput
          style={styles.search}
          placeholder="Try sho, shogun, matrix 99…"
          placeholderTextColor={colors.muted}
          value={q}
          onChangeText={setQ}
          autoFocus={!isTV}
          hasTVPreferredFocus
          returnKeyType="search"
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>

      {!!suggestions.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestRow}>
          {suggestions.map((s) => (
            <Focusable
              key={`${s.kind}-${s.source}-${s.id || s.tmdb_id || s.title}`}
              onPress={() => openItem(s)}
              style={[styles.chip, s.kind === "prediction" && styles.chipPredict]}
            >
              <Text style={styles.chipTitle} numberOfLines={1}>
                {s.title}
              </Text>
              <Text style={styles.chipMeta} numberOfLines={1}>
                {[s.year, s.media_type, s.kind === "prediction" ? "predicted" : s.match].filter(Boolean).join(" · ")}
              </Text>
            </Focusable>
          ))}
        </ScrollView>
      )}

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
              {q.trim() ? `No matches for “${q.trim()}”` : "Start typing — predictions appear as titles are recognized."}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1 / numColumns, alignItems: "center" }}>
              <PosterCard
                title={item.title}
                subtitle={[item.year, item.match, item.origin || item.source, item.score]
                  .filter((x) => x !== undefined && x !== null && x !== "")
                  .join(" · ")}
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
  suggestRow: { paddingHorizontal: spacing, paddingBottom: 8, gap: 8 },
  chip: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    maxWidth: 220,
  },
  chipPredict: {
    borderStyle: "dashed",
    backgroundColor: "rgba(212,175,106,0.08)",
  },
  chipTitle: { color: colors.text, fontWeight: "700", fontSize: isTV ? 16 : 13 },
  chipMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
  error: { color: "#ffb4a8", marginBottom: 8 },
});
