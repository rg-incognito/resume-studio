"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/apiFetch";

type Version = {
  id: string;
  label: string | null;
  templateName: string;
  jobDescription: string | null;
  pdfUrl: string | null;
  createdAt: string;
};

export default function VersionsPage() {
  const [versions, setVersions] = useState<Version[] | null>(null);

  function refresh() {
    apiFetch("/api/resume-versions")
      .then((res) => res.json())
      .then(setVersions);
  }

  useEffect(refresh, []);

  async function handleDownload(id: string) {
    const res = await apiFetch(`/api/resume-versions/${id}/pdf`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: string) {
    await apiFetch(`/api/resume-versions/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">Versions</h1>
      <p className="mt-2 font-sans text-ink-muted">
        Every resume you&apos;ve generated, kept side by side with the job it was tailored for.
      </p>

      {versions === null ? (
        <p className="mt-8 font-sans text-sm text-ink-muted">Loading…</p>
      ) : versions.length === 0 ? (
        <p className="mt-8 font-sans text-sm text-ink-muted">
          Nothing generated yet — head to Generate to make your first one.
        </p>
      ) : (
        <div className="mt-8 divide-y divide-hairline border-y border-hairline">
          <AnimatePresence initial={false}>
            {versions.map((v) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-sans text-sm font-medium">
                    {v.label} — {v.templateName}
                  </p>
                  <p className="mt-1 font-mono text-xs text-ink-muted">
                    {new Date(v.createdAt).toLocaleString()}
                    {v.jobDescription ? " · tailored" : " · base"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-4">
                  <button
                    type="button"
                    onClick={() => handleDownload(v.id)}
                    className="font-sans text-sm font-medium text-accent transition-opacity hover:opacity-70"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(v.id)}
                    className="font-sans text-sm text-ink-muted transition-colors hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
