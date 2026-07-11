"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/apiFetch";

type KeyState = { hasKey: boolean; masked: string | null };

export default function SettingsPage() {
  const [keyState, setKeyState] = useState<KeyState | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function refresh() {
    apiFetch("/api/api-key")
      .then((res) => res.json())
      .then(setKeyState);
  }

  useEffect(refresh, []);

  async function handleSave() {
    if (!input.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await apiFetch("/api/api-key", { method: "POST", body: JSON.stringify({ apiKey: input.trim() }) });
    setBusy(false);
    if (res.ok) {
      setInput("");
      setMessage("Key saved.");
      refresh();
    } else {
      setMessage("Couldn't save that key — check it's at least 10 characters.");
    }
  }

  async function handleDelete() {
    setBusy(true);
    await apiFetch("/api/api-key", { method: "DELETE" });
    setBusy(false);
    setMessage("Key removed.");
    refresh();
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl tracking-tight">Settings</h1>
      <p className="mt-2 font-sans text-ink-muted">
        Your Gemini API key, encrypted at rest. We never log it, never see it in
        plaintext after you save it, and never send it anywhere but Google&apos;s API.
      </p>

      <section className="mt-8 rounded-lg border border-hairline p-5">
        <h2 className="font-display text-lg">Gemini API key</h2>

        {keyState === null ? (
          <p className="mt-3 font-sans text-sm text-ink-muted">Loading…</p>
        ) : keyState.hasKey ? (
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-sm text-ink-muted">{keyState.masked}</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="font-sans text-sm text-red-700 transition-opacity hover:opacity-70 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="mt-3 font-sans text-sm text-ink-muted">No key on file yet.</p>
        )}

        <div className="mt-5 flex gap-2">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your Gemini API key"
            className="w-full rounded-md border border-hairline bg-paper px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={busy || !input.trim()}
            whileTap={{ scale: 0.97 }}
            className="shrink-0 rounded-md bg-ink px-4 py-2 font-sans text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-50"
          >
            {keyState?.hasKey ? "Rotate" : "Save"}
          </motion.button>
        </div>
        {message && <p className="mt-3 font-sans text-sm text-ink-muted">{message}</p>}

        <p className="mt-5 font-sans text-xs text-ink-muted">
          Don&apos;t have one? Get a free key at{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            aistudio.google.com/apikey
          </a>
          .
        </p>
      </section>
    </div>
  );
}
