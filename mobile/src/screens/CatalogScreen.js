import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { api } from "../api/client";
import PosterCard from "../components/PosterCard";
import Focusable from "../components/Focusable";
import { ScreenHeader } from "../components/ui";
import { colors } from "../theme";
import { isTV, spacing } from "../utils/platform";

export default function CatalogScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const kind = route.params?.kind || "movies";
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const title = kind === "movies" ? "Movies" : kind === "shows" ? "Shows" : "Live TV";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const cats = await api(`/xtream/categories/${kind}`).catch(() => []);
      setCategories(cats || []);
      const params = new URLSearchParams({ limit: "80" });
      if (categoryId) params.set("category_id", categoryId);
      if (q) params.set("q", q);
      const data = await api(`/xtream/catalog/${kind}?${params}`);
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [kind, categoryId, q]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openItem(item) {
    if (kind === "live") {
      navigation.navigate("Player", {
        media_type: "live",
        source: "xtream",
        external_id: String(item.id),
        title: item.title,
        container: "ts",
        poster: item.poster,
      });
      return;
    }
    navigation.navigate("Detail", {
      kind: kind === "shows" ? "show" : "movie",
      source: item.source || "xtream",
      id: String(item.id),
      title: item.title,
    });
  }

  const numColumns = isTV ? 5 : 3;

  return (
    <View style={styles.container}>
      <View style={styles.pad}>
        <ScreenHeader title={title} subtitle={loading ? "Loading…" : `${items.length} titles`} />
        <TextInput
          style={styles.search}
          placeholder={`Search ${title.toLowerCase()}…`}
          placeholderTextColor={colors.muted}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={load}
          returnKeyType="search"
        />
        <FlatList
          horizontal
          data={[{ category_id: "", category_name: "All" }, ...categories.slice(0, 30)]}
          keyExtractor={(c) => String(c.category_id)}
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12, maxHeight: 52 }}
          renderItem={({ item }) => {
            const active = String(categoryId) === String(item.category_id);
            return (
              <Focusable
                onPress={() => setCategoryId(item.category_id ? String(item.category_id) : "")}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.category_name}</Text>
              </Focusable>
            );
          }}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : kind === "live" ? (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.pad}
          renderItem={({ item, index }) => (
            <Focusable
              hasTVPreferredFocus={index === 0}
              onPress={() => openItem(item)}
              style={styles.liveRow}
            >
              <Text style={styles.liveTitle}>{item.title}</Text>
              <Text style={styles.liveMeta}>Live · Watch</Text>
            </Focusable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No channels</Text>}
        />
      ) : (
        <FlatList
          data={items}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.pad}
          renderItem={({ item }) => (
            <View style={{ flex: 1 / numColumns, alignItems: "center" }}>
              <PosterCard
                title={item.title}
                subtitle={item.year}
                poster={item.poster}
                onPress={() => openItem(item)}
              />
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{q ? `No matches for “${q}”` : "No titles found"}</Text>}
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
  },
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
  liveRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 4,
  },
  liveTitle: { color: colors.text, fontSize: isTV ? 22 : 16, fontWeight: "600" },
  liveMeta: { color: colors.muted, marginTop: 4 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
  error: { color: "#ffb4a8", marginBottom: 8 },
});
