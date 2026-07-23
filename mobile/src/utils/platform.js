import { Platform } from "react-native";

export const isTV =
  Platform.isTV === true ||
  Platform.constants?.uiMode === "tv" ||
  String(Platform.OS).includes("androidtv");

export const isIOS = Platform.OS === "ios";
export const isAndroid = Platform.OS === "android";

export const posterWidth = isTV ? 180 : 120;
export const posterHeight = isTV ? 270 : 180;
export const spacing = isTV ? 20 : 12;
export const titleSize = isTV ? 42 : 28;
