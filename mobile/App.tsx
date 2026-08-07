import "react-native-gesture-handler";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Alert, BackHandler, Platform } from "react-native";
import { Provider } from "react-redux";
import AppNavigator from "./src/navigation/AppNavigator";
import { logout } from "./src/redux/authSlice";
import { store } from "./src/redux/store";
import { connectSocket, disconnectSocket } from "./src/services/socket";

const queryClient = new QueryClient();
const navigationRef = createNavigationContainerRef();

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

export default function App() {
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

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SocketBridge />
        <NavigationContainer ref={navigationRef}>
          <StatusBar style="dark" />
          <AppNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </Provider>
  );
}
