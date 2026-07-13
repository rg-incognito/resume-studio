"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { apiFetch } from "@/lib/apiFetch";

type Template = { id: string; name: string; description: string };
type GenerateState = "idle" | "generating" | "done" | "error";

function GeneratePageInner() {
  const searchParams = useSearchParams();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState(searchParams.get("template") ?? "");
  const [jobDescription, setJobDescription] = useState("");
  const [state, setState] = useState<GenerateState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/templates")
      .then((res) => res.json())
      .then((data: Template[]) => {
        setTemplates(data);
        if (!templateId && data[0]) setTemplateId(data[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    if (!templateId) return;
    setState("generating");
    setError(null);
    setErrorLog(null);
    setPdfBlobUrl(null);
    setModelUsed(null);

    const res = await apiFetch("/api/generate", {
      method: "POST",
      body: JSON.stringify({
        templateId,
        jobDescription: jobDescription.trim() || undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Generation failed. Try again — this is sometimes transient.");
      setErrorLog(body?.log ?? null);
      setState("error");
      return;
    }

    const { id, modelUsed: usedModel } = await res.json();
    const pdfRes = await apiFetch(`/api/resume-versions/${id}/pdf`);
    const blob = await pdfRes.blob();
    setPdfBlobUrl(URL.createObjectURL(blob));
    setModelUsed(usedModel ?? null);
    setState("done");
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">Generate</h1>
      <p className="mt-2 font-sans text-ink-muted">
        Pick a template. Paste a job description if you want this version tailored
        to it — your base profile is never overwritten.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-5">
          <label className="block">
            <span className="mb-1 block font-sans text-xs font-medium text-ink-muted">Template</span>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-md border border-hairline bg-paper px-3 py-2 font-sans text-sm outline-none focus:border-accent"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {templateId && (
            <a
              href={`/template-previews/${templateId}.png`}
              target="_blank"
              rel="noreferrer"
              className="block w-32 overflow-hidden rounded-sm border border-hairline transition-opacity hover:opacity-80"
            >
              <Image
                src={`/template-previews/${templateId}.png`}
                alt="Selected template preview"
                width={200}
                height={259}
                className="h-auto w-full"
              />
            </a>
          )}

          <label className="block">
            <span className="mb-1 block font-sans text-xs font-medium text-ink-muted">
              Job description (optional — tailors this version)
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
            onClick={handleGenerate}
            disabled={state === "generating" || !templateId}
            whileTap={{ scale: 0.97 }}
            className="rounded-md bg-ink px-5 py-2.5 font-sans text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-60"
          >
            {state === "generating"
              ? "Compiling…"
              : jobDescription.trim()
                ? "Generate tailored resume"
                : "Generate resume"}
          </motion.button>

          {modelUsed && state === "done" && (
            <p className="font-mono text-[11px] text-ink-muted">Generated with {modelUsed}</p>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 font-mono text-xs text-red-800">
              {error}
              {errorLog && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-sans font-medium">Details</summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[10px]">
                    {errorLog}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-hairline bg-white/50 p-3 min-h-[400px]">
          <AnimatePresence mode="wait">
            {state === "generating" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full min-h-[380px] items-center justify-center font-mono text-sm text-ink-muted"
              >
                <span className="animate-pulse">$ generating and compiling…</span>
              </motion.div>
            )}
            {state === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full min-h-[380px] flex-col items-center justify-center gap-2 px-8 text-center font-sans text-sm text-ink-muted"
              >
                <span>Generation failed — see the error below.</span>
                <span>Hitting Generate again usually works.</span>
              </motion.div>
            )}
            {state === "done" && pdfBlobUrl && (
              <motion.iframe
                key="pdf"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                src={pdfBlobUrl}
                className="h-[500px] w-full rounded-sm"
                title="Resume preview"
              />
            )}
            {state === "idle" && (
              <div className="flex h-full min-h-[380px] items-center justify-center font-sans text-sm text-ink-muted">
                Your PDF preview will show up here.
              </div>
            )}
          </AnimatePresence>
          {state === "done" && pdfBlobUrl && (
            <a
              href={pdfBlobUrl}
              download="resume.pdf"
              className="mt-3 inline-block font-sans text-sm font-medium text-accent hover:opacity-70"
            >
              Download PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={null}>
      <GeneratePageInner />
    </Suspense>
  );
}
