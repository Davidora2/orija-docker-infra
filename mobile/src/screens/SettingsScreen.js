import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { PrimaryButton, ScreenHeader } from "../components/ui";
import { colors } from "../theme";
import { isAndroid, isIOS, isTV, spacing } from "../utils/platform";

export default function SettingsScreen() {
  const { user, serverUrl, logout, saveServer } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
      <ScreenHeader title="Account" subtitle="Native client for OrijaFlix" />
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{user?.display_name}</Text>
        <Text style={styles.sub}>
          @{user?.username} · {user?.max_streams} streams · {user?.is_admin ? "admin" : "member"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Server</Text>
        <Text style={styles.value}>{serverUrl}</Text>
        <Text style={styles.sub}>
          Platform: {isTV ? "Android TV" : isIOS ? "iOS" : isAndroid ? "Android" : "Other"}
        </Text>
      </View>

      <PrimaryButton label="Change server" ghost onPress={() => saveServer("")} />
      <PrimaryButton label="Sign out" danger onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: spacing, paddingBottom: 40 },
  card: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  label: { color: colors.muted, marginBottom: 4 },
  value: { color: colors.text, fontSize: isTV ? 22 : 17, fontWeight: "600" },
  sub: { color: colors.muted, marginTop: 6 },
});
