import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearSession, getServerUrl, getToken, setServerUrl, setToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [serverUrl, setServerUrlState] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function bootstrap() {
    setLoading(true);
    try {
      const url = await getServerUrl();
      setServerUrlState(url || "");
      if (!url) {
        setUser(null);
        return;
      }
      const token = await getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await api("/auth/me");
      setUser(me);
    } catch {
      await clearSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  async function saveServer(url) {
    const cleaned = await setServerUrl(url || "");
    setServerUrlState(cleaned);
    if (!cleaned) {
      await clearSession();
      setUser(null);
      return cleaned;
    }
    await api("/health");
    return cleaned;
  }

  async function login(username, password) {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    await setToken(data.access_token);
    const me = await api("/auth/me");
    setUser(me);
    return me;
  }

  async function logout() {
    await clearSession();
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, serverUrl, saveServer, login, logout, refresh: bootstrap }),
    [user, loading, serverUrl]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
