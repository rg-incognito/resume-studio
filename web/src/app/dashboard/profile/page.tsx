"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/apiFetch";
import type { ProfileInput } from "@/lib/schemas/profile";

const EMPTY: ProfileInput = {
  personalInfo: { name: "", email: "", phone: "", location: "", linkedin: "", links: [] },
  workExperience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  achievements: [],
};

type SaveState = "idle" | "saving" | "saved" | "error";
type ImportState = "idle" | "parsing" | "error";

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileInput>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [importState, setImportState] = useState<ImportState>("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    apiFetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        setProfile({
          personalInfo: { links: [], ...data.personalInfo },
          workExperience: data.workExperience ?? [],
          education: data.education ?? [],
          skills: data.skills ?? [],
          projects: data.projects ?? [],
          certifications: data.certifications ?? [],
          achievements: data.achievements ?? [],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaveState("saving");
    setErrorDetail(null);
    const res = await apiFetch("/api/profile", {
      method: "PUT",
      body: JSON.stringify(profile),
    });
    if (res.ok) {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } else {
      const body = await res.json().catch(() => null);
      setErrorDetail(body?.error ? JSON.stringify(body.error) : "Couldn't save. Try again.");
      setSaveState("error");
    }
  }

  async function handleImport() {
    if (!resumeText.trim()) return;
    setImportState("parsing");
    setImportError(null);
    const res = await apiFetch("/api/profile/parse", {
      method: "POST",
      body: JSON.stringify({ resumeText: resumeText.trim() }),
    });
    if (res.ok) {
      const parsed: ProfileInput = await res.json();
      setProfile(parsed);
      setImportState("idle");
      setShowImport(false);
      setResumeText("");
    } else {
      const body = await res.json().catch(() => null);
      setImportError(body?.error ?? "Couldn't parse that resume.");
      setImportState("error");
    }
  }

  if (loading) {
    return <p className="font-sans text-sm text-ink-muted">Loading your profile…</p>;
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl tracking-tight">Profile</h1>
        <SaveButton state={saveState} onClick={handleSave} />
      </div>
      {errorDetail && <p className="mt-2 font-sans text-sm text-red-700">{errorDetail}</p>}
      <p className="mt-2 font-sans text-ink-muted">
        This is the source of truth. Resumes are always generated from it, never edited
        directly.
      </p>

      <div className="mt-6 rounded-lg border border-hairline p-5">
        {!showImport ? (
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="font-sans text-sm font-medium text-accent transition-opacity hover:opacity-70"
          >
            Paste an existing resume to fill this in →
          </button>
        ) : (
          <div>
            <p className="font-sans text-sm font-medium">Paste your existing resume</p>
            <p className="mt-1 font-sans text-xs text-ink-muted">
              Plain text from any resume — we&apos;ll extract your info into the fields below
              using your Gemini key. Nothing is saved until you review and hit Save.
            </p>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              rows={8}
              placeholder="Paste resume text here…"
              className="mt-3 w-full rounded-md border border-hairline bg-paper px-3 py-2 font-sans text-sm outline-none focus:border-accent"
            />
            <div className="mt-3 flex items-center gap-3">
              <motion.button
                type="button"
                onClick={handleImport}
                disabled={importState === "parsing" || !resumeText.trim()}
                whileTap={{ scale: 0.97 }}
                className="rounded-md bg-ink px-4 py-2 font-sans text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-50"
              >
                {importState === "parsing" ? "Reading…" : "Fill from resume"}
              </motion.button>
              <button
                type="button"
                onClick={() => {
                  setShowImport(false);
                  setImportError(null);
                }}
                className="font-sans text-sm text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
            {importError && <p className="mt-2 font-sans text-sm text-red-700">{importError}</p>}
          </div>
        )}
      </div>

      <Section title="Personal info">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            value={profile.personalInfo.name}
            onChange={(v) => setProfile((p) => ({ ...p, personalInfo: { ...p.personalInfo, name: v } }))}
          />
          <Field
            label="Email"
            value={profile.personalInfo.email}
            onChange={(v) => setProfile((p) => ({ ...p, personalInfo: { ...p.personalInfo, email: v } }))}
          />
          <Field
            label="Phone"
            value={profile.personalInfo.phone ?? ""}
            onChange={(v) => setProfile((p) => ({ ...p, personalInfo: { ...p.personalInfo, phone: v } }))}
          />
          <Field
            label="Location"
            value={profile.personalInfo.location ?? ""}
            onChange={(v) => setProfile((p) => ({ ...p, personalInfo: { ...p.personalInfo, location: v } }))}
          />
          <Field
            label="LinkedIn URL"
            value={profile.personalInfo.linkedin ?? ""}
            onChange={(v) => setProfile((p) => ({ ...p, personalInfo: { ...p.personalInfo, linkedin: v } }))}
          />
        </div>

        <SubLabel>Other links (GitHub, LeetCode, portfolio…)</SubLabel>
        <ListEditor
          items={profile.personalInfo.links ?? []}
          onChange={(links) => setProfile((p) => ({ ...p, personalInfo: { ...p.personalInfo, links } }))}
          empty={{ label: "", url: "" }}
          render={(item, update) => (
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <input
                className={inputClass}
                placeholder="Label (e.g. GitHub)"
                value={item.label}
                onChange={(e) => update({ ...item, label: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="https://…"
                value={item.url}
                onChange={(e) => update({ ...item, url: e.target.value })}
              />
            </div>
          )}
          addLabel="Add link"
        />
      </Section>

      <Section title="Work experience">
        <ListEditor
          items={profile.workExperience}
          onChange={(workExperience) => setProfile((p) => ({ ...p, workExperience }))}
          empty={{ company: "", role: "", location: "", startDate: "", endDate: "", bullets: [] }}
          addLabel="Add role"
          render={(item, update) => (
            <div className="flex-1 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={inputClass} placeholder="Company" value={item.company} onChange={(e) => update({ ...item, company: e.target.value })} />
                <input className={inputClass} placeholder="Role" value={item.role} onChange={(e) => update({ ...item, role: e.target.value })} />
                <input className={inputClass} placeholder="Location" value={item.location} onChange={(e) => update({ ...item, location: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass} placeholder="Start" value={item.startDate} onChange={(e) => update({ ...item, startDate: e.target.value })} />
                  <input className={inputClass} placeholder="End" value={item.endDate} onChange={(e) => update({ ...item, endDate: e.target.value })} />
                </div>
              </div>
              <BulletEditor bullets={item.bullets} onChange={(bullets) => update({ ...item, bullets })} />
            </div>
          )}
        />
      </Section>

      <Section title="Education">
        <ListEditor
          items={profile.education}
          onChange={(education) => setProfile((p) => ({ ...p, education }))}
          empty={{ institution: "", degree: "", location: "", startDate: "", endDate: "" }}
          addLabel="Add education"
          render={(item, update) => (
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <input className={inputClass} placeholder="Institution" value={item.institution} onChange={(e) => update({ ...item, institution: e.target.value })} />
              <input className={inputClass} placeholder="Degree" value={item.degree} onChange={(e) => update({ ...item, degree: e.target.value })} />
              <input className={inputClass} placeholder="Location" value={item.location} onChange={(e) => update({ ...item, location: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className={inputClass} placeholder="Start" value={item.startDate} onChange={(e) => update({ ...item, startDate: e.target.value })} />
                <input className={inputClass} placeholder="End" value={item.endDate} onChange={(e) => update({ ...item, endDate: e.target.value })} />
              </div>
            </div>
          )}
        />
      </Section>

      <Section title="Skills">
        <ListEditor
          items={profile.skills}
          onChange={(skills) => setProfile((p) => ({ ...p, skills }))}
          empty={{ label: "", items: [] }}
          addLabel="Add skill group"
          render={(item, update) => (
            <div className="flex-1 space-y-2">
              <input className={inputClass} placeholder="Group label (e.g. Languages)" value={item.label} onChange={(e) => update({ ...item, label: e.target.value })} />
              <input
                className={inputClass}
                placeholder="Comma-separated: Java, Python, SQL"
                value={item.items.join(", ")}
                onChange={(e) => update({ ...item, items: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
          )}
        />
      </Section>

      <Section title="Projects">
        <ListEditor
          items={profile.projects}
          onChange={(projects) => setProfile((p) => ({ ...p, projects }))}
          empty={{ name: "", stack: "", startDate: "", endDate: "", bullets: [] }}
          addLabel="Add project"
          render={(item, update) => (
            <div className="flex-1 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={inputClass} placeholder="Project name" value={item.name} onChange={(e) => update({ ...item, name: e.target.value })} />
                <input className={inputClass} placeholder="Stack (Python, LLM, …)" value={item.stack} onChange={(e) => update({ ...item, stack: e.target.value })} />
                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  <input className={inputClass} placeholder="Start" value={item.startDate} onChange={(e) => update({ ...item, startDate: e.target.value })} />
                  <input className={inputClass} placeholder="End" value={item.endDate} onChange={(e) => update({ ...item, endDate: e.target.value })} />
                </div>
              </div>
              <BulletEditor bullets={item.bullets} onChange={(bullets) => update({ ...item, bullets })} />
            </div>
          )}
        />
      </Section>

      <Section title="Certifications">
        <ListEditor
          items={profile.certifications}
          onChange={(certifications) => setProfile((p) => ({ ...p, certifications }))}
          empty={{ name: "", issuer: "", date: "" }}
          addLabel="Add certification"
          render={(item, update) => (
            <div className="grid flex-1 gap-2 sm:grid-cols-3">
              <input className={inputClass} placeholder="Name" value={item.name} onChange={(e) => update({ ...item, name: e.target.value })} />
              <input className={inputClass} placeholder="Issuer" value={item.issuer} onChange={(e) => update({ ...item, issuer: e.target.value })} />
              <input className={inputClass} placeholder="Date" value={item.date} onChange={(e) => update({ ...item, date: e.target.value })} />
            </div>
          )}
        />
      </Section>

      <Section title="Achievements" last>
        <BulletEditor bullets={profile.achievements} onChange={(achievements) => setProfile((p) => ({ ...p, achievements }))} addLabel="Add achievement" />
      </Section>

      <div className="flex justify-end pb-16 pt-4">
        <SaveButton state={saveState} onClick={handleSave} />
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-hairline bg-paper px-3 py-2 font-sans text-sm text-ink outline-none transition-colors focus:border-accent";

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={`pt-10 ${last ? "" : "border-b border-hairline pb-10"}`}>
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-2 mb-5 h-px w-10 bg-accent" />
      {children}
    </section>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 mt-5 font-sans text-xs font-medium uppercase tracking-wide text-ink-muted">{children}</p>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block font-sans text-xs font-medium text-ink-muted">{label}</span>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function ListEditor<T>({
  items,
  onChange,
  empty,
  render,
  addLabel = "Add",
}: {
  items: T[];
  onChange: (items: T[]) => void;
  empty: T;
  render: (item: T, update: (next: T) => void) => React.ReactNode;
  addLabel?: string;
}) {
  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-3 rounded-md border border-hairline p-4"
          >
            {render(item, (next) => onChange(items.map((it, idx) => (idx === i ? next : it))))}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="font-sans text-xs text-ink-muted transition-colors hover:text-ink"
              aria-label="Remove"
            >
              Remove
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => onChange([...items, empty])}
        className="font-sans text-sm font-medium text-accent transition-opacity hover:opacity-70"
      >
        + {addLabel}
      </button>
    </div>
  );
}

function BulletEditor({
  bullets,
  onChange,
  addLabel = "Add bullet",
}: {
  bullets: string[];
  onChange: (bullets: string[]) => void;
  addLabel?: string;
}) {
  return (
    <div className="space-y-2">
      {bullets.map((bullet, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            className={inputClass}
            value={bullet}
            onChange={(e) => onChange(bullets.map((b, idx) => (idx === i ? e.target.value : b)))}
          />
          <button
            type="button"
            onClick={() => onChange(bullets.filter((_, idx) => idx !== i))}
            className="font-sans text-xs text-ink-muted transition-colors hover:text-ink"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...bullets, ""])}
        className="font-sans text-xs font-medium text-accent transition-opacity hover:opacity-70"
      >
        + {addLabel}
      </button>
    </div>
  );
}

function SaveButton({ state, onClick }: { state: SaveState; onClick: () => void }) {
  const label = state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save profile";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={state === "saving"}
      whileTap={{ scale: 0.97 }}
      className="rounded-md bg-ink px-5 py-2.5 font-sans text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-60"
    >
      {label}
    </motion.button>
  );
}
