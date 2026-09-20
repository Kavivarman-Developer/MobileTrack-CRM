import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
} from "firebase/auth";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCYJGUuGQ4_gUBMnM3WCtKuscr--4duCTo",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "kadaikanakku.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "kadaikanakku",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "kadaikanakku.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "775937258064",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:775937258064:web:9e6b71a6b9412d1c011755",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

function initAuth() {
  if (getApps().length > 1) {
    try {
      return getAuth(firebaseApp);
    } catch (e) {}
  }

  if (Platform.OS === "web") {
    try {
      return initializeAuth(firebaseApp, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      });
    } catch (e) {
      return getAuth(firebaseApp);
    }
  } else {
    try {
      const authModule = require("firebase/auth");
      if (authModule.getReactNativePersistence) {
        return initializeAuth(firebaseApp, {
          persistence: authModule.getReactNativePersistence(AsyncStorage),
        });
      }
    } catch (e) {}
    return getAuth(firebaseApp);
  }
}

export const firebaseAuth = initAuth();

if (Platform.OS === "web" && typeof window !== "undefined") {
  try {
    const firebaseCompat = require("firebase/compat/app");
    require("firebase/compat/auth");
    const compat = firebaseCompat.default || firebaseCompat;
    if (compat && compat.apps && !compat.apps.length) {
      compat.initializeApp(firebaseConfig);
    }
  } catch (e) {
    console.warn("Firebase compat init warning:", e);
  }
}
