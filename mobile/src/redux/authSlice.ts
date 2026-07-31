import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type User = { id: string; name: string; email: string; role?: string; organizationId?: string; avatarUrl?: string; authProvider?: string };

type AuthState = {
  user: User | null;
  accessToken: string | null;
};

const initialState: AuthState = { user: null, accessToken: null };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: User; accessToken: string; refreshToken?: string }>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      AsyncStorage.setItem("accessToken", action.payload.accessToken);
      if (action.payload.refreshToken) AsyncStorage.setItem("refreshToken", action.payload.refreshToken);
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      AsyncStorage.removeItem("accessToken");
      AsyncStorage.removeItem("refreshToken");
    },
  },
});

export const { logout, setCredentials } = authSlice.actions;
export default authSlice.reducer;
