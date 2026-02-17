import { onAuthStateChanged, signInAnonymously, User } from "firebase/auth";
import { auth } from "./firebase";

export function initAuth(onReady: (user: User) => void) {
  return onAuthStateChanged(auth, async (u) => {
    if (u) return onReady(u);
    const cred = await signInAnonymously(auth);
    onReady(cred.user);
  });
}

export {};
