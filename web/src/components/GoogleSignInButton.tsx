"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signInWithGoogle } from "@/lib/firebase-client";

export function GoogleSignInButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch {
      setError("Sign-in didn't go through. Try again.");
      setPending(false);
    }
  }

  return (
    <div className={className}>
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={pending}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        className="inline-flex items-center gap-3 rounded-md bg-ink px-6 py-3 text-paper font-sans text-[15px] font-medium shadow-[0_1px_0_rgba(0,0,0,0.05)] transition-colors hover:bg-ink/90 disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#fff"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.81 2.73v2.27h2.92c1.71-1.57 2.69-3.89 2.69-6.64Z"
          />
          <path
            fill="#fff"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.34C2.44 15.98 5.48 18 9 18Z"
          />
          <path
            fill="#fff"
            d="M3.97 10.71a5.4 5.4 0 0 1 0-3.42V4.95H.95a9 9 0 0 0 0 8.1l3.02-2.34Z"
          />
          <path
            fill="#fff"
            d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.95 4.95l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
        {pending ? "Signing in…" : "Sign in with Google"}
      </motion.button>
      {error && <p className="mt-2 text-sm text-ink-muted">{error}</p>}
    </div>
  );
}
