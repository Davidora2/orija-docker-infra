import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api } from "../api/client";
import PosterCard from "../components/PosterCard";
import Focusable from "../components/Focusable";
import { ScreenHeader } from "../components/ui";
import { colors } from "../theme";
import { isTV, spacing } from "../utils/platform";

export default function FavoritesScreen() {
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await api("/favorites"));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 8000);
      return () => clearInterval(t);
    }, [load])
  );

  function open(item) {
    if (item.media_type === "live") {
      navigation.navigate("Catalog", { kind: "live" });
      return;
    }
    navigation.navigate("Detail", {
      kind: item.media_type === "show" ? "show" : "movie",
      source: item.source,
      id: item.external_id,
      title: item.title,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.pad}>
        <ScreenHeader
          title="Favorites"
          subtitle="Personalized per account. Xtream favorites save into Movies/Shows."
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        numColumns={isTV ? 5 : 3}
        contentContainerStyle={styles.pad}
        ListEmptyComponent={<Text style={styles.empty}>No favorites yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <PosterCard
              title={item.title}
              subtitle={item.download_status}
              poster={item.poster}
              onPress={() => open(item)}
            />
            <View style={styles.row}>
              {item.source === "xtream" && item.media_type !== "live" && (
                <Focusable
                  onPress={async () => {
                    await api(`/favorites/${item.id}/download`, { method: "POST" });
                    load();
                  }}
                  style={styles.mini}
                >
                  <Text style={styles.miniText}>Save</Text>
                </Focusable>
              )}
              <Focusable
                onPress={async () => {
                  await api(`/favorites/${item.id}`, { method: "DELETE" });
                  load();
                }}
                style={styles.mini}
              >
                <Text style={styles.miniText}>Remove</Text>
              </Focusable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: spacing },
  cell: { flex: 1, alignItems: "center", marginBottom: 8 },
  row: { flexDirection: "row", gap: 6 },
  mini: { paddingHorizontal: 8, paddingVertical: 4 },
  miniText: { color: colors.accent, fontSize: 12, fontWeight: "600" },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
  error: { color: "#ffb4a8" },
});
