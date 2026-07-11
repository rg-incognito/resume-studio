# LaTeX Resume + Career Platform (BYOK)

Free, ad-free LaTeX resume SaaS. See `Goal.txt` for the full product spec.

Current state: **build-order steps 1–8 are implemented.** Auth (Firebase Google
sign-in), profile CRUD, encrypted Gemini key storage, a sandboxed Docker LaTeX
compiler, Gemini-driven generation + JD tailoring, and resume version history all
exist and build cleanly. What's blocking a full live test:

- **Firebase isn't configured yet** — sign-in won't work until real config lands
  in `web/.env` (see "Firebase setup" below). Everything downstream is wired to
  activate automatically once it's there.
- **No Gemini key has been tested yet** — the whole pipeline through LaTeX
  compilation was verified directly (see "What's been verified" below); the
  actual `/api/generate` call to Gemini needs a real key pasted into the app's
  Settings page to exercise end-to-end.

## What's been verified without either of those

- `npm run build` passes clean (TypeScript + lint) across the whole app.
- The sandboxed Docker compile pipeline was exercised **through the running app**
  (not just standalone): `POST /api/compile-preview` with a seeded `templateId`
  returned a byte-identical single-page PDF to the standalone Docker test from
  template creation. This is dev-only (404s outside `NODE_ENV=production`) —
  it's Goal.txt step 5's checkpoint, proving the compiler works before Gemini
  is layered on top in step 6.
- The landing page renders and animates correctly (checked visually in-browser).

## Firebase setup (to unlock sign-in and everything past it)

1. Go to [console.firebase.google.com](https://console.firebase.google.com),
   create a project (Spark/free plan is fine).
2. **Authentication** → Sign-in method → enable **Google**.
3. **Project settings** → General → "Your apps" → add a Web app → copy the
   config values into `web/.env`:
   `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
4. **Project settings** → Service accounts → "Generate new private key" →
   downloads a JSON file. Paste its full contents as a single-line string into
   `FIREBASE_SERVICE_ACCOUNT_JSON` in `web/.env`.
5. Restart `npm run dev`. Sign-in should work immediately — `src/lib/auth.ts`
   upserts a `User` row on first sign-in, no separate signup step.

## Gemini key (to unlock actual generation)

Once signed in, paste a free key from
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) into
**Settings** in the app. It's encrypted at rest (AES-256-GCM, `ENCRYPTION_KEY`
in `web/.env`, already generated for local dev) and only ever decrypted
server-side, right before the Gemini call. `GEMINI_MODEL` in `.env` controls
which model `src/lib/gemini.ts` calls — defaults to `gemini-flash-latest`, a
Google-maintained alias that stays current, so it shouldn't need manual
updates. If a request's configured model has been retired anyway,
`src/lib/geminiModel.ts` automatically discovers and retries with a working
model via `ai.models.list()`.

## Layout

- `Goal.txt` — product spec / build order
- `original_resume_latex.txt` — the source resume the template family is based on
- `docker-compose.yml` — local Postgres for dev
- `web/` — Next.js (TypeScript) app; will hold frontend + backend API routes
  - `web/prisma/schema.prisma` — DB schema (User, Profile, ApiKey, Template, ResumeVersion)
  - `web/prisma/seed.ts` — loads `web/templates/*.tex` into the `Template` table
  - `web/templates/*.tex` — 18 standalone LaTeX resume templates, all built on the
    same ATS-safe single-column macro skeleton (`resumeItem`, `resumeSubheading`,
    etc.) as the original resume — only color, font, section-title style, spacing,
    or section order varies between them. See `web/templates/index.json` for the
    full list with descriptions. All 18 are verified to compile to a single-page
    PDF (checked via Docker + pdflatex).
  - `web/src/lib/` — `auth.ts` (Firebase token verification + user upsert),
    `encryption.ts` (AES-256-GCM for the stored Gemini key), `compiler.ts`
    (sandboxed Docker pdflatex), `gemini.ts` (profile+template → LaTeX via
    `@google/genai`), `storage.ts` (dev-mode local-disk PDF storage, swap for
    Oracle Object Storage/S3 later without touching callers).
  - `web/src/app/api/` — `profile`, `api-key`, `templates`, `generate`,
    `resume-versions[/[id]/pdf]`, `compile-preview` (dev-only checkpoint).
  - `web/src/app/dashboard/` — profile builder, template gallery, generate +
    preview, version history, settings (API key).
  - `web/storage/` — gitignored; generated PDFs land here in dev.

> **Note on `original_resume_latex.txt`:** its "Profile Links" and "Achievements"
> sections wrap `\resumeItemListStart`/`\resumeItemListEnd` (itself an `itemize`)
> inside a second outer `itemize` — a nested-list LaTeX error ("Something's wrong
> — perhaps a missing `\item`") that made those two sections fail to compile.
> All 18 generated templates fix this (single `itemize` per section); the
> original file itself was left untouched since it wasn't asked to be edited.

## Local setup

1. **Start Postgres:**
   ```
   docker compose up -d
   ```
2. **Install deps and configure env:**
   ```
   cd web
   npm install
   cp .env.example .env   # already matches docker-compose.yml defaults
   ```
3. **Apply the DB schema and seed templates:**
   ```
   npx prisma migrate dev
   npx prisma db seed
   ```
4. **Run the app:**
   ```
   npm run dev
   ```

## Testing a LaTeX template before deploying anywhere

Every file in `web/templates/` is a standalone, complete `.tex` document — open
any one of them directly to compile and preview it, no app required. Two ways to
compile locally:

**Option A — Overleaf (fastest, no local install):**
Upload the `.tex` file to a new Overleaf project and compile.

**Option B — Docker (matches Goal.txt's sandboxed compiler approach):**
```
docker run --rm -v "%cd%/web/templates:/data" -w /data texlive/texlive \
  pdflatex -interaction=nonstopmode 01-classic-jake.tex
```
(swap the filename for whichever template you want to check). This produces a
`.pdf` alongside the `.tex` file in `web/templates/`.

Neither pdflatex nor tectonic is installed on this machine natively — Docker is
the only local compile path unless you install a TeX distribution (e.g. MiKTeX)
yourself.

## Database GUI

`npx prisma studio` (run from `web/`) opens a browser UI to inspect the seeded
`Template` rows and other tables.
