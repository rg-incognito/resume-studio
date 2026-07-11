"use client";

import { motion } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { CompileStrip } from "@/components/CompileStrip";
import Link from "next/link";

const FEATURES = [
  {
    title: "18 templates, zero paywall",
    body: "Every template is the same ATS-safe single-column structure recruiters' parsers actually read, just restyled — no \"upgrade to unlock\" screens.",
  },
  {
    title: "Your key, your quota",
    body: "Paste your own free Gemini API key. We never see your usage bill and never make an inference call on our own dime.",
  },
  {
    title: "Tailored, not overwritten",
    body: "Paste a job description and get a new version with reordered, reweighted bullets — your base profile stays untouched.",
  },
];

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-display text-lg tracking-tight">Resume Studio</span>
          {!loading && user && (
            <Link
              href="/dashboard"
              className="font-sans text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Go to dashboard →
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        <section className="grid gap-16 py-20 sm:py-28 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
              Free · BYOK · ATS-safe
            </p>
            <h1 className="mt-4 font-display text-[2.75rem] leading-[1.08] tracking-tight sm:text-6xl">
              A resume that compiles as cleanly as it reads.
            </h1>
            <p className="mt-6 max-w-md font-sans text-lg leading-7 text-ink-muted">
              Build a structured profile once. Generate a polished LaTeX resume from
              it, in any of 18 ATS-safe templates, retailored for every job
              description — for free, using your own Gemini key.
            </p>
            <div className="mt-9">
              {!loading && !user && <GoogleSignInButton />}
              {!loading && user && (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center rounded-md bg-ink px-6 py-3 font-sans text-[15px] font-medium text-paper transition-colors hover:bg-ink/90"
                >
                  Continue to dashboard
                </Link>
              )}
            </div>
          </motion.div>

          <div className="pb-10 lg:pb-0">
            <CompileStrip />
          </div>
        </section>

        <section className="border-t border-hairline py-16 sm:py-20">
          <div className="grid gap-10 sm:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <h2 className="font-display text-xl">{feature.title}</h2>
                <div className="mt-3 mb-4 h-px w-10 bg-accent" />
                <p className="font-sans text-[15px] leading-6 text-ink-muted">
                  {feature.body}
                </p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-6 py-6 font-sans text-xs text-ink-muted">
          Resume Studio — free, ad-free, and always will be.
        </div>
      </footer>
    </div>
  );
}
