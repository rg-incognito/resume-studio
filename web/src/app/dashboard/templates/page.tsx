"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiFetch } from "@/lib/apiFetch";

type Template = { id: string; name: string; description: string };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    apiFetch("/api/templates")
      .then((res) => res.json())
      .then(setTemplates);
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">Templates</h1>
      <p className="mt-2 font-sans text-ink-muted">
        18 free templates, one ATS-safe structure. Pick one to generate with.
      </p>

      {templates === null ? (
        <p className="mt-8 font-sans text-sm text-ink-muted">Loading…</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
            >
              <button
                type="button"
                onClick={() => router.push(`/dashboard/generate?template=${template.id}`)}
                className="group block w-full overflow-hidden rounded-lg border border-hairline text-left transition-colors hover:border-accent"
              >
                <div className="relative aspect-[8.5/11] overflow-hidden bg-white">
                  <Image
                    src={`/template-previews/${template.id}.png`}
                    alt={`${template.name} preview`}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-4">
                  <h2 className="font-display text-lg">{template.name}</h2>
                  <p className="mt-1.5 font-sans text-sm leading-5 text-ink-muted">
                    {template.description}
                  </p>
                </div>
              </button>
              <a
                href={`/template-previews/${template.id}.png`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-block px-4 font-sans text-xs font-medium text-accent hover:opacity-70"
              >
                View full size ↗
              </a>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
