import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut as firebaseSignOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "UNCONFIGURED",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "UNCONFIGURED",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "UNCONFIGURED",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "UNCONFIGURED",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "UNCONFIGURED",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "UNCONFIGURED",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "UNCONFIGURED"
};

// Validate that critical env vars exist
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("CRITICAL: Firebase Environment Variables are missing. Please add VITE_FIREBASE_API_KEY to your Cloudflare/Vite ENV.");
}

export const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const isFirebaseConfigured = firebaseConfig.apiKey !== "UNCONFIGURED" && firebaseConfig.projectId !== "UNCONFIGURED";

/** The customer backed out; that isn't an outage, so it must not trigger the fallback. */
export function isFirebaseSignInCancelled(err: unknown) {
  const code = (err as { code?: string })?.code;
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
}

export async function signInWithFirebaseGoogle() {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured");
  }
  try {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    return result.user;
  } catch (err) {
    // In-app browsers often block popups, while a redirect still works.
    if ((err as { code?: string })?.code === "auth/popup-blocked") {
      await signInWithRedirect(firebaseAuth, googleProvider);
      return null;
    }
    throw err;
  }
}

export async function signOutFromFirebase() {
  await firebaseSignOut(firebaseAuth);
}
