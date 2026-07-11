import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase config isn't set until the project exists (see README). Guard init
// so builds and unauthenticated pages don't crash in the meantime — auth-gated
// features simply no-op until real config is provided in web/.env.
const isConfigured = Boolean(firebaseConfig.apiKey);

export const firebaseApp: FirebaseApp | null = isConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const firebaseAuth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;

const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  if (!firebaseAuth) {
    return Promise.reject(new Error("Firebase isn't configured yet."));
  }
  return signInWithPopup(firebaseAuth, googleProvider);
}

export function signOutUser() {
  if (!firebaseAuth) return Promise.resolve();
  return signOut(firebaseAuth);
}
