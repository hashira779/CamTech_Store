import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut as firebaseSignOut, type Auth } from "firebase/auth";

const buildTimeConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let authPromise: Promise<Auth | null> | null = null;

// Settings saved in the Infra console win, so they apply without rebuilding the store.
async function loadConfig(apiBaseUrl: string) {
  try {
    const res = await fetch(`${apiBaseUrl}/api/v1/public/auth-config`);
    if (res.ok) {
      const json = await res.json();
      const firebase = (json.data || json).firebase;
      if (firebase?.apiKey && firebase?.projectId) return firebase;
    }
  } catch (err) {
    console.warn("Could not load sign-in settings; using the build's values.", err);
  }
  return buildTimeConfig;
}

/** Resolves to null when Firebase isn't configured, which sends sign-in to the fallback. */
export function getFirebaseAuth(apiBaseUrl: string): Promise<Auth | null> {
  authPromise ??= loadConfig(apiBaseUrl).then((config) =>
    config.apiKey && config.projectId ? getAuth(initializeApp(config)) : null
  );
  return authPromise;
}

const googleProvider = new GoogleAuthProvider();

/** The customer backed out; that isn't an outage, so it must not trigger the fallback. */
export function isFirebaseSignInCancelled(err: unknown) {
  const code = (err as { code?: string })?.code;
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
}

export async function signInWithFirebaseGoogle(apiBaseUrl: string) {
  const auth = await getFirebaseAuth(apiBaseUrl);
  if (!auth) {
    throw new Error("Firebase is not configured");
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    // In-app browsers often block popups, while a redirect still works.
    if ((err as { code?: string })?.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw err;
  }
}

export async function signOutFromFirebase(apiBaseUrl: string) {
  const auth = await getFirebaseAuth(apiBaseUrl);
  if (auth) await firebaseSignOut(auth);
}
