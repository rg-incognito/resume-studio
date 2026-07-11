"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";

const STEPS = [
  { href: "/dashboard/profile", title: "Build your profile", body: "Enter your experience, education, skills, and projects once." },
  { href: "/dashboard/settings", title: "Add your Gemini key", body: "Paste your own free API key — encrypted at rest, yours alone." },
  { href: "/dashboard/generate", title: "Generate a resume", body: "Pick a template, optionally paste a job description, get a PDF." },
];

export default function DashboardHome() {
  const { user } = useAuth();

  return (
    <div>
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="font-display text-3xl tracking-tight"
      >
        Welcome{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}.
      </motion.h1>
      <p className="mt-2 font-sans text-ink-muted">Three steps to your first resume.</p>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <Link
              href={step.href}
              className="block rounded-lg border border-hairline p-5 transition-colors hover:border-accent"
            >
              <span className="font-mono text-xs text-ink-muted">0{i + 1}</span>
              <h2 className="mt-2 font-display text-lg">{step.title}</h2>
              <p className="mt-2 font-sans text-sm leading-6 text-ink-muted">{step.body}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
