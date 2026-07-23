import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
import { isTV } from "../utils/platform";
import { PrimaryButton, ScreenHeader } from "../components/ui";

export default function LoginScreen() {
  const { login, serverUrl, saveServer } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || "Login failed");
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
        <ScreenHeader title="Sign in" subtitle={serverUrl} />
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          placeholderTextColor={colors.muted}
          hasTVPreferredFocus
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholderTextColor={colors.muted}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <PrimaryButton label={busy ? "Signing in…" : "Enter"} onPress={onLogin} />
        <PrimaryButton label="Change server" ghost onPress={() => saveServer("")} />
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
});
