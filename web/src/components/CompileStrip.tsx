"use client";

import { motion } from "framer-motion";

const LINES = [
  "$ resume compile --template=navy-accent",
  "> loaded profile: profile.json",
  '> tailoring for: "Backend Engineer II"',
  "> pdflatex resume.tex",
  "> Output written on resume.pdf (1 page)",
  "✓ compiled in 1.2s",
];

export function CompileStrip() {
  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="rounded-lg border border-hairline bg-ink font-mono text-[13px] leading-6 text-paper/90 shadow-[0_20px_60px_-25px_rgba(27,27,24,0.45)]"
      >
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        </div>
        <div className="space-y-1 px-4 py-4">
          {LINES.map((line, i) => (
            <motion.p
              key={line}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.4 + i * 0.22 }}
              className={line.startsWith("✓") ? "text-compiled" : undefined}
            >
              {line}
            </motion.p>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: -3 }}
        transition={{ duration: 0.5, delay: 1.9 }}
        className="absolute -bottom-10 -right-6 hidden w-40 rounded-sm border border-hairline bg-paper p-3 shadow-[0_14px_34px_-14px_rgba(27,27,24,0.35)] sm:block"
      >
        <div className="mb-2 h-2 w-16 rounded-sm bg-ink/80" />
        <div className="mb-1 h-1 w-full rounded-sm bg-hairline" />
        <div className="mb-1 h-1 w-full rounded-sm bg-hairline" />
        <div className="mb-2.5 h-1 w-3/4 rounded-sm bg-hairline" />
        <div className="mb-1 h-1 w-full rounded-sm bg-hairline" />
        <div className="mb-1 h-1 w-5/6 rounded-sm bg-hairline" />
      </motion.div>
    </div>
  );
}
