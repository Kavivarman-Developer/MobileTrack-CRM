import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Platform } from "react-native";

export type User = {
  id: string;
  name: string;
  email: string;
  role?: string;
  phone?: string;
  organizationId?: string;
  avatarUrl?: string;
  authProvider?: string;
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isHydrated: boolean;
};

function getInitialState(): AuthState {
  let user: User | null = null;
  let accessToken: string | null = null;
  if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
    try {
      const storedUser = window.localStorage.getItem("user");
      const storedToken = window.localStorage.getItem("accessToken");
      if (storedUser && storedToken) {
        user = JSON.parse(storedUser);
        accessToken = storedToken;
      }
    } catch (e) {
      console.warn("Could not read initial auth from localStorage:", e);
    }
  }
  return {
    user,
    accessToken,
    isHydrated: Platform.OS === "web" ? true : false,
  };
}

const authSlice = createSlice({
  name: "auth",
  initialState: getInitialState(),
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: User; accessToken: string; refreshToken?: string }>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isHydrated = true;

      const userJson = JSON.stringify(action.payload.user);
      AsyncStorage.setItem("user", userJson);
      AsyncStorage.setItem("accessToken", action.payload.accessToken);
      if (action.payload.refreshToken) AsyncStorage.setItem("refreshToken", action.payload.refreshToken);

      if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.setItem("user", userJson);
          window.localStorage.setItem("accessToken", action.payload.accessToken);
          if (action.payload.refreshToken) window.localStorage.setItem("refreshToken", action.payload.refreshToken);
        } catch (e) {}
      }
    },
    restoreCredentials(state, action: PayloadAction<{ user: User; accessToken: string; refreshToken?: string } | null>) {
      if (action.payload) {
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
      } else {
        state.user = null;
        state.accessToken = null;
      }
      state.isHydrated = true;
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.isHydrated = true;

      AsyncStorage.removeItem("user");
      AsyncStorage.removeItem("accessToken");
      AsyncStorage.removeItem("refreshToken");

      if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.removeItem("user");
          window.localStorage.removeItem("accessToken");
          window.localStorage.removeItem("refreshToken");
        } catch (e) {}
      }
    },
  },
});

export const { logout, setCredentials, restoreCredentials } = authSlice.actions;
export default authSlice.reducer;
