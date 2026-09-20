const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const { getMessaging } = require("firebase-admin/messaging");

const projectId = process.env.FIREBASE_PROJECT_ID || "kadaikanakku";

if (!getApps().length) {
  initializeApp({
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  });
}

module.exports = { auth: getAuth, storage: getStorage, messaging: getMessaging };
