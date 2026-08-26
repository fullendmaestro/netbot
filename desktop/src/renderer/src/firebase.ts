import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB6IUrVxeoYKDd-UbC2bg3FBUjTrsBbZSk",
  authDomain: "netbot-603c0.firebaseapp.com",
  projectId: "netbot-603c0",
  storageBucket: "netbot-603c0.firebasestorage.app",
  messagingSenderId: "275053515215",
  appId: "1:275053515215:web:8e2e23695fe6ed98c1c2ba",
  measurementId: "G-ZJ77QQ4TN0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, googleProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, db };
export type { User };
