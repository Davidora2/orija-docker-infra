import React from "react";
import { ActivityIndicator, StatusBar, StyleSheet, View } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import ServerScreen from "./src/screens/ServerScreen";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import CatalogScreen from "./src/screens/CatalogScreen";
import DetailScreen from "./src/screens/DetailScreen";
import LiveAliasScreen from "./src/screens/CatalogScreen";
import FavoritesScreen from "./src/screens/FavoritesScreen";
import LibraryScreen from "./src/screens/LibraryScreen";
import SearchScreen from "./src/screens/SearchScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import PlayerScreen from "./src/screens/PlayerScreen";
import { colors } from "./src/theme";
import { isTV } from "./src/utils/platform";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.text,
    border: colors.line,
    primary: colors.accent,
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.line,
          height: isTV ? 72 : 58,
          paddingBottom: isTV ? 12 : 6,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: isTV ? 14 : 11, fontWeight: "600" },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Movies" component={CatalogScreen} initialParams={{ kind: "movies" }} />
      <Tab.Screen name="Shows" component={CatalogScreen} initialParams={{ kind: "shows" }} />
      <Tab.Screen name="Live" component={LiveAliasScreen} initialParams={{ kind: "live" }} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading, serverUrl } = useAuth();

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgElevated },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {!serverUrl ? (
        <Stack.Screen name="Server" component={ServerScreen} options={{ headerShown: false }} />
      ) : !user ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Detail" component={DetailScreen} options={{ title: "Details" }} />
          <Stack.Screen
            name="Catalog"
            component={CatalogScreen}
            options={({ route }) => ({ title: route.params?.kind || "Catalog" })}
          />
          <Stack.Screen
            name="Player"
            component={PlayerScreen}
            options={{ headerShown: false, orientation: "landscape", animation: "fade" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar barStyle="light-content" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
