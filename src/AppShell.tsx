import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { initAuth } from "./lib/initAuth";
import EditorScreen from "./features/editor/EditorScreen";

export default function AppShell() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = initAuth(setUser);
    return () => unsub();
  }, []);

  if (!user) return <div style={{ padding: 24 }}>Signing in…</div>;

  return <EditorScreen user={user} />;
}
