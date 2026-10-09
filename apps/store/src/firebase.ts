import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC1YhXeUurQk5hk80uI4lG9mamo30dxY4U",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "camtech-571ff.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "camtech-571ff",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "camtech-571ff.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "359994256974",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:359994256974:web:2fcc0b0a3cfa186b87dd1f",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-614YV6K92V"
};

export const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function signInWithFirebaseGoogle() {
  const result = await signInWithPopup(firebaseAuth, googleProvider);
  return result.user;
}

export async function signOutFromFirebase() {
  await firebaseSignOut(firebaseAuth);
}
