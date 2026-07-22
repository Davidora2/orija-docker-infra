import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "orija_token";
const SERVER_KEY = "orija_server";

async function storageGet(key) {
  if (Platform.OS === "web") return AsyncStorage.getItem(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return AsyncStorage.getItem(key);
  }
}

async function storageSet(key, value) {
  if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
  try {
    return await SecureStore.setItemAsync(key, value);
  } catch {
    return AsyncStorage.setItem(key, value);
  }
}

async function storageDelete(key) {
  if (Platform.OS === "web") return AsyncStorage.removeItem(key);
  try {
    return await SecureStore.deleteItemAsync(key);
  } catch {
    return AsyncStorage.removeItem(key);
  }
}

export async function getServerUrl() {
  return (await storageGet(SERVER_KEY)) || "";
}

export async function setServerUrl(url) {
  const cleaned = url.trim().replace(/\/$/, "");
  await storageSet(SERVER_KEY, cleaned);
  return cleaned;
}

export async function getToken() {
  return storageGet(TOKEN_KEY);
}

export async function setToken(token) {
  return storageSet(TOKEN_KEY, token);
}

export async function clearSession() {
  await storageDelete(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const base = await getServerUrl();
  if (!base) throw new Error("Server URL not configured");

  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}/api${path}`, { ...options, headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = data?.detail || data?.message || res.statusText;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

export function absoluteUrl(base, path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
