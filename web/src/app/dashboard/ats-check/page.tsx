"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/apiFetch";
import type { AtsReport } from "@/lib/schemas/atsCheck";

type CheckState = "idle" | "checking" | "done" | "error";

function scoreColor(score: number): string {
  if (score >= 80) return "#2f7a4d";
  if (score >= 60) return "#b8860b";
  return "#b3402a";
}

function ScoreBar({ label, score, summary }: { label: string; score: number; summary: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between font-sans text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="font-mono text-xs text-ink-muted">{Math.round(score)}/100</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-hairline/60">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: scoreColor(score) }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, score))}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <p className="mt-1 font-sans text-xs text-ink-muted">{summary}</p>
    </div>
  );
}

export default function AtsCheckPage() {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [state, setState] = useState<CheckState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [report, setReport] = useState<AtsReport | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleCheck() {
    if (!file) return;
    setState("checking");
    setError(null);
    setErrorLog(null);
    setReport(null);
    setModelUsed(null);

    const form = new FormData();
    form.append("resume", file);
    if (jobDescription.trim()) form.append("jobDescription", jobDescription.trim());

    const res = await apiFetch("/api/ats-check", { method: "POST", body: form });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "ATS check failed. Try again.");
      setErrorLog(body?.log ?? null);
      setState("error");
      return;
    }

    const { report: data, modelUsed: usedModel }: { report: AtsReport; modelUsed: string } = await res.json();
    setReport(data);
    setModelUsed(usedModel);
    setState("done");
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">ATS Check</h1>
      <p className="mt-2 font-sans text-ink-muted">
        Upload a resume PDF and, optionally, a job description. You&apos;ll get an ATS
        score broken down by formatting, keywords, and content quality — plus exact
        line-by-line changes to raise it.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <label className="block">
            <span className="mb-1 block font-sans text-xs font-medium text-ink-muted">
              Resume (PDF)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full font-sans text-sm file:mr-3 file:rounded-md file:border file:border-hairline file:bg-paper file:px-3 file:py-1.5 file:font-sans file:text-sm file:font-medium file:text-ink hover:file:bg-hairline/30"
            />
            {file && (
              <span className="mt-1 block font-mono text-xs text-ink-muted">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block font-sans text-xs font-medium text-ink-muted">
              Job description (optional — scores keyword match against it)
            </span>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={10}
              placeholder="Paste the job posting here…"
              className="w-full rounded-md border border-hairline bg-paper px-3 py-2 font-sans text-sm outline-none focus:border-accent"
            />
          </label>

          <motion.button
            type="button"
            onClick={handleCheck}
            disabled={state === "checking" || !file}
            whileTap={{ scale: 0.97 }}
            className="rounded-md bg-ink px-5 py-2.5 font-sans text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-60"
          >
            {state === "checking" ? "Analyzing…" : "Run ATS check"}
          </motion.button>

          {modelUsed && state === "done" && (
            <p className="font-mono text-[11px] text-ink-muted">Analyzed with {modelUsed}</p>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 font-mono text-xs text-red-800">
              {error}
              {errorLog && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-sans font-medium">Details</summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[10px]">{errorLog}</pre>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-hairline bg-white/50 p-5 min-h-[400px]">
          <AnimatePresence mode="wait">
            {state === "checking" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full min-h-[380px] items-center justify-center font-mono text-sm text-ink-muted"
              >
                <span className="animate-pulse">$ extracting text and scoring…</span>
              </motion.div>
            )}

            {state === "done" && report && (
              <motion.div
                key="report"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-5">
                  <div
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 font-display text-2xl"
                    style={{ borderColor: scoreColor(report.overallScore), color: scoreColor(report.overallScore) }}
                  >
                    {Math.round(report.overallScore)}
                  </div>
                  <div>
                    <div className="font-sans text-sm font-medium text-ink">Overall ATS score</div>
                    <div className="font-sans text-xs text-ink-muted">out of 100</div>
                  </div>
                </div>

                <div className="space-y-4">
                  {report.categories.map((cat) => (
                    <ScoreBar key={cat.name} label={cat.name} score={cat.score} summary={cat.summary} />
                  ))}
                </div>

                {report.strengths.length > 0 && (
                  <div>
                    <h3 className="font-sans text-sm font-medium text-ink">What&apos;s working</h3>
                    <ul className="mt-2 space-y-1 font-sans text-sm text-ink-muted">
                      {report.strengths.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-accent">✓</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.changes.length > 0 && (
                  <div>
                    <h3 className="font-sans text-sm font-medium text-ink">
                      Changes to make ({report.changes.length})
                    </h3>
                    <div className="mt-3 space-y-3">
                      {report.changes.map((change, i) => (
                        <div key={i} className="rounded-md border border-hairline p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-sans text-xs font-medium uppercase tracking-wide text-accent">
                              {change.area}
                            </span>
                            <span className="font-mono text-xs text-ink-muted">
                              +{Math.round(change.pointsImpact)} pts
                            </span>
                          </div>
                          <p className="mt-2 font-mono text-xs text-red-800 line-through decoration-red-300">
                            {change.current}
                          </p>
                          <p className="mt-1 font-mono text-xs text-green-800">{change.suggested}</p>
                          <p className="mt-2 font-sans text-xs text-ink-muted">{change.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {state === "idle" && (
              <div className="flex h-full min-h-[380px] items-center justify-center font-sans text-sm text-ink-muted">
                Your ATS report will show up here.
              </div>
            )}

            {state === "error" && (
              <div className="flex h-full min-h-[380px] items-center justify-center font-sans text-sm text-ink-muted">
                Check failed — see the error on the left.
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
