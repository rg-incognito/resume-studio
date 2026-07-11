"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";

type AuthContextValue = {
  user: FirebaseUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(() => Boolean(firebaseAuth));

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      // UX-only hint for proxy.ts to redirect signed-out visits away from
      // /dashboard before the page flashes. Never trusted for authorization —
      // every API route independently verifies the real Firebase ID token.
      document.cookie = nextUser
        ? "auth-hint=1; path=/; max-age=2592000; samesite=lax"
        : "auth-hint=; path=/; max-age=0";
    });
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
