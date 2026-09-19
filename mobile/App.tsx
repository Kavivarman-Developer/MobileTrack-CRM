import "react-native-gesture-handler";
import React, { Component, ErrorInfo, ReactNode, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";
import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
} from "@expo-google-fonts/nunito-sans";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Alert, BackHandler, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Provider } from "react-redux";
import AppNavigator from "./src/navigation/AppNavigator";
import Toast from "react-native-toast-message";
import { colors } from "./src/constants/theme";
import { toastConfig } from "./src/utils/toast";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logout, restoreCredentials } from "./src/redux/authSlice";
import { store } from "./src/redux/store";
import { useAppDispatch, useAppSelector } from "./src/hooks/redux";
import { connectSocket, disconnectSocket } from "./src/services/socket";

const queryClient = new QueryClient();
const navigationRef = createNavigationContainerRef();

interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AppErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errStyles.container}>
          <Text style={errStyles.title}>Application Error</Text>
          <Text style={errStyles.msg}>{this.state.error?.message || "Unknown error"}</Text>
          <ScrollView style={errStyles.stack}>
            <Text style={errStyles.stackText}>{this.state.error?.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const errStyles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#FFFFFF", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "bold", color: "#DC2626", marginBottom: 12 },
  msg: { fontSize: 14, color: "#1E293B", marginBottom: 12 },
  stack: { maxHeight: 250, backgroundColor: "#F1F5F9", padding: 12, borderRadius: 8 },
  stackText: { fontSize: 11, fontFamily: "monospace", color: "#475569" },
});

function SocketBridge() {
  useEffect(() => {
    let currentToken: string | null = null;
    const unsubscribe = store.subscribe(() => {
      const state = store.getState();
      const token = state.auth.accessToken;
      const user = state.auth.user;
      if (!token) {
        currentToken = null;
        disconnectSocket();
        return;
      }
      if (token === currentToken) return;
      currentToken = token;
      const socket = connectSocket(token);
      socket.on("product:updated", () => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["stock-summary"] });
      });
      socket.on("order:created", () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      });
      socket.on("order:updated", () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      });
      socket.on("inventory:adjusted", () => {
        queryClient.invalidateQueries({ queryKey: ["inventory-adjustments"] });
        queryClient.invalidateQueries({ queryKey: ["stock-summary"] });
      });
      socket.on("vendorCall:created", () => {
        queryClient.invalidateQueries({ queryKey: ["vendor-calls"] });
        queryClient.invalidateQueries({ queryKey: ["vendor-call-summary"] });
      });
      socket.on("organization:updated", (organization) => {
        queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
        queryClient.invalidateQueries({ queryKey: ["admin-organization"] });
        if (user?.role !== "superadmin" && organization?._id === user?.organizationId && organization?.isActive === false) {
          Alert.alert("Account suspended", "Your account has been suspended by the administrator.");
          store.dispatch(logout());
        }
      });
      socket.on("user:updated", (updatedUser) => {
        queryClient.invalidateQueries({ queryKey: ["admin-organization-users"] });
        if ((updatedUser?._id === user?.id || updatedUser?.id === user?.id) && updatedUser?.isActive === false) {
          Alert.alert("Account blocked", "Your login has been blocked by the administrator.");
          store.dispatch(logout());
        }
      });
    });
    return () => {
      unsubscribe();
      disconnectSocket();
    };
  }, []);
  return null;
}

function AuthHydrator({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((state) => state.auth.user);
  const isHydrated = useAppSelector((state) => state.auth.isHydrated);

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        let storedUser: any = null;
        let storedToken: string | null = null;
        let storedRefresh: string | null = null;

        if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
          try {
            storedUser = window.localStorage.getItem("user");
            storedToken = window.localStorage.getItem("accessToken");
            storedRefresh = window.localStorage.getItem("refreshToken");
          } catch (e) {}
        }

        if (!storedUser || !storedToken) {
          storedUser = await AsyncStorage.getItem("user");
          storedToken = await AsyncStorage.getItem("accessToken");
          storedRefresh = await AsyncStorage.getItem("refreshToken");
        }

        if (storedUser && storedToken) {
          const user = typeof storedUser === "string" ? JSON.parse(storedUser) : storedUser;
          dispatch(restoreCredentials({ user, accessToken: storedToken, refreshToken: storedRefresh || undefined }));
        } else if (!authUser) {
          dispatch(restoreCredentials(null));
        }
      } catch (e) {
        if (!authUser) {
          dispatch(restoreCredentials(null));
        }
      }
    }
    loadStoredAuth();
  }, [dispatch]);

  return <>{children}</>;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(
    Platform.OS === "web"
      ? {}
      : {
          ...Ionicons.font,
          Inter_400Regular,
          Inter_500Medium,
          Inter_600SemiBold,
          Inter_700Bold,
          NunitoSans_400Regular,
          NunitoSans_600SemiBold,
          NunitoSans_700Bold,
          NunitoSans_800ExtraBold,
        }
  );

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded && !fontError && Platform.OS !== "web") {
    return (
      <View style={{ alignItems: "center", backgroundColor: colors.background, flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, width: "100%", height: "100%", minHeight: "100vh" as any }}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <Provider store={store}>
            <QueryClientProvider client={queryClient}>
              <SocketBridge />
              <AuthHydrator>
                <NavigationContainer ref={navigationRef}>
                  <StatusBar style="dark" />
                  <AppNavigator />
                  <Toast config={toastConfig} />
                </NavigationContainer>
              </AuthHydrator>
            </QueryClientProvider>
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
