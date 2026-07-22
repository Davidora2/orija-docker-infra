import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
import { isTV } from "../utils/platform";
import { PrimaryButton, ScreenHeader } from "../components/ui";

export default function ServerScreen() {
  const { serverUrl, saveServer } = useAuth();
  const [url, setUrl] = useState(serverUrl || "http://");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onContinue() {
    setBusy(true);
    setError("");
    try {
      await saveServer(url);
    } catch (err) {
      setError(err.message || "Could not reach Orija server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <ScreenHeader
          title="Connect"
          subtitle="Enter your Orija server address (same host as docker compose)."
        />
        <Text style={styles.label}>Server URL</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.1.50:8096"
          placeholderTextColor={colors.muted}
          value={url}
          onChangeText={setUrl}
          hasTVPreferredFocus
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <PrimaryButton label={busy ? "Connecting…" : "Continue"} onPress={onContinue} disabled={busy} />
        <Text style={styles.hint}>
          Android / iOS / Android TV all talk to the same Orija API. Use your LAN IP, not localhost, on devices.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: isTV ? 48 : 24,
  },
  card: {
    maxWidth: 720,
    alignSelf: "center",
    width: "100%",
    backgroundColor: colors.bgElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: isTV ? 32 : 20,
  },
  label: {
    color: colors.muted,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: isTV ? 18 : 12,
    marginBottom: 12,
    fontSize: isTV ? 20 : 16,
  },
  error: {
    color: "#ffb4a8",
    marginBottom: 8,
  },
  hint: {
    color: colors.muted,
    marginTop: 12,
    lineHeight: 20,
  },
});
