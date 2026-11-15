# Draftly

## Overview

Draftly is a small collaborative document editor: sign in, write rich text, import a file as a new document, and share a document with another user as a viewer or an editor. It was built as a 4-hour take-home. I chose a narrow slice and made it solid instead of covering every feature. `docs/ARCHITECTURE.md` explains what I prioritized and cut, and `docs/AI_WORKFLOW.md` describes how I used AI tools while building it.

Live URL: <LIVE_URL>

Stack: Next.js 16 (App Router, TypeScript), Tailwind, Prisma 6 on Neon Postgres, TipTap, zod, bcryptjs + jose, sanitize-html, mammoth, marked, Vitest. Deployed on Vercel.

What the app does:

- Sign in and sign out with seeded accounts (JWT in an httpOnly cookie). The login page has a "Demo accounts" box; clicking an account fills the form.
- Dashboard with "My documents" and "Shared with me" (role badge and owner name on shared items).
- Create a document, rename it inline, and edit it with a rich-text editor (bold, italic, underline, H1 to H3, bullet and numbered lists).
- Debounced autosave with a Saving / Saved indicator, a retry button on failure, and a warning before leaving with unsaved changes.
- Read-only view for viewers (no toolbar, no save behavior).
- Sharing for the owner: a Share dialog on the document page to add someone by email as viewer or editor, change their role, or remove them.
- Import a `.txt`, `.md` or `.docx` file from the dashboard ("Import file") as a new document.
- Server-side sanitization of all saved HTML to a fixed allowlist.
- Friendly "not found" and "something went wrong" pages that never show error details.

## Supported upload types

Supported: `.txt`, `.md` and `.docx`, up to 2 MB. Each upload becomes a new, editable document owned by the uploader, titled from the filename (extension removed, underscores turned into spaces, truncated to 120 characters, "Imported document" if nothing is left).

**How to import:** on the dashboard, click "Import file" and pick a file. The helper text next to the button reads "Supports .txt, .md, .docx, up to 2 MB". The browser checks the file type, an empty file and the 2 MB limit before uploading, using the same messages as the API. While the upload runs the button shows "Importing…". On success you land in the new document; on failure an inline message appears that you can dismiss. If the server's reply is not readable (for example a platform-level rejection of a large body), the message is "Upload failed. Check the file type and size (max 2 MB) and try again." Network failures show the same message. Choosing the same file again after an error works.

**What each type does:**

- `.txt`: text is escaped, blank lines separate paragraphs, single line breaks become line breaks. Files that contain null bytes are rejected as binary.
- `.md`: converted with `marked`, then sanitized. Headings deeper than H3 become H3. Code blocks become a paragraph with a line break after each line. Blockquotes become plain paragraphs. Links keep their text but lose the URL. Horizontal rules are dropped. Tables lose their structure: the cell text is kept as plain text. Raw HTML written inside the markdown is removed by the sanitizer.
- `.docx`: converted with `mammoth`, in memory (headings, lists, bold, italic and underline are kept).
- **Images are dropped** on import. The `.docx` image converter never reads image data, and the sanitizer removes any `img`. A file that is only images has no text left and is rejected.
- Anything else, files over 2 MB, empty files, binary `.txt` files, corrupt `.docx` files, and files with no readable text are rejected with a message. Converted content over 500 KB is rejected too.
- **Not mitigated:** a small `.docx` that expands to a very large size when unzipped (a zip bomb) is not detected. The 2 MB cap limits the upload, not the unzipped size.

The 2 MB cap exists because Vercel limits request bodies to about 4.5 MB.

**Sample files** for trying the importer are in `tests/fixtures/`: `sample.docx` (heading, bold, italic, underline, both list types and an image that gets dropped), `project_notes.md` (headings, emphasis, a link, lists, a blockquote and a code block) and `meeting_agenda.txt` (paragraphs, line breaks, and a line with `R&D <draft>` to show escaping). The submission folder also has copies in a `sample-files` folder.

## Local setup

Requirements: Node.js 20+, npm, and a Postgres database (a free Neon project, or a local Postgres).

From the unzipped source folder:

```bash
cd draftly                 # the folder you unzipped
npm install                # also runs `prisma generate` (postinstall)
cp .env.example .env       # then fill in the values (see below)
npm run db:push            # create tables in the database
npm run db:seed            # create the 3 demo users and the sample document (idempotent)
npm run dev                # http://localhost:3000
```

Alternatively, clone the repository first, then run the same steps from the cloned folder:

```bash
git clone <repo-url> draftly
cd draftly
```

To create the database on Neon: make a free project at neon.tech, open **Connect**, and copy two strings. The pooled string (host contains `-pooler`) is `DATABASE_URL`. The direct string, with connection pooling turned off, is `DIRECT_URL`.

A local Postgres also works. Set both `DATABASE_URL` and `DIRECT_URL` to the same local connection string. For example, with Docker:

```bash
docker run -d --name draftly-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=draftly -p 5432:5432 postgres:16-alpine
# DATABASE_URL and DIRECT_URL both: postgresql://postgres:devpass@localhost:5432/draftly
```

Other scripts: `npm run build`, `npm start`, `npm run lint`, `npm test`, `npm run db:studio`.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string used by the app. On Neon, use the pooled string (host contains `-pooler`) and append `&pgbouncer=true` if it is not present. |
| `DIRECT_URL` | Direct (non-pooled) Postgres connection string, used by Prisma for `db:push`. |
| `JWT_SECRET` | Random string, at least 16 characters, used to sign session cookies. Generate one with `openssl rand -base64 32`. |

`.env.example` contains placeholders only. `.env` and `.env.local` are gitignored; do not commit real values.

## Seeded test users

All three share one password: `Draftly!2026`

| Email | Name |
|---|---|
| alice@draftly.test | Alice |
| bob@draftly.test | Bob |
| carol@draftly.test | Carol |

There is no signup and no password reset. These are the only accounts.

**Demo accounts box.** The `/login` page lists these three accounts and the shared password. Each row is a button that fills in the email and password, so a reviewer only has to press Sign in. The credentials are shown on purpose because this is a seeded review environment (see the tradeoffs in `docs/ARCHITECTURE.md`).

**Sample document.** The seed also creates a document titled "Welcome to Draftly", owned by Alice, with a short explanation of what to try. It is shared with Bob as a viewer and with Carol as an editor, so sharing can be seen straight away from either account. The seed is idempotent: running it again never overwrites the sample document, its shares or any edits made to it (a deleted share or document is recreated). It does reset the three users' names and passwords to the demo values.

### How to see sharing work

Use two browsers, or one normal window and one private window, so the two sessions do not share a cookie.

**Quick look.** Sign in as Bob: "Welcome to Draftly" is under "Shared with me" with a Viewer badge, and it opens read-only (no toolbar, no save indicator, "View only" label). Sign in as Carol: the same document shows an Editor badge and opens with the toolbar and autosave.

**Full flow.**

1. Window A: sign in as `alice@draftly.test`. Click "New document", give it a title and type some text.
2. Window B: sign in as `bob@draftly.test`. "Shared with me" shows only "Welcome to Draftly".
3. Window A: open your new document, click Share, enter `bob@draftly.test`, choose Viewer, and add.
4. Window B: reload the dashboard. The new document is under "Shared with me" with a Viewer badge and "Owned by Alice". Open it. It is read-only.
5. Window A: in the Share dialog, change Bob's role to Editor.
6. Window B: reload the document. The toolbar is there. Type something and watch Saving then Saved. Reload in Window A to see Bob's change.
7. Window A: remove Bob in the Share dialog.
8. Window B: reload the document. It returns "not found", and it is gone from his dashboard.

To see access lost mid-edit: with Bob editing in Window B, change him to Viewer (or remove him) in Window A, then keep typing in Window B. The next save stops and shows "You no longer have edit access" (or "This document is no longer shared with you"). The text stays in the editor so it can be copied out.

Edge cases worth trying in the dialog: an email that is not a user, sharing with yourself, and re-adding someone who already has access (this updates their role).

## Running tests

```bash
npm test
```

This runs Vitest. The tests need no database, network, or running server. They cover pure logic only:

| File | What it covers |
|---|---|
| `tests/access.test.ts` | `getAccess` for owner, editor, viewer, stranger and signed-out users; capability helpers; `decideAccess` status mapping (401, 403, and the identical 404 for missing and no-access documents) |
| `tests/session-token.test.ts` | Session JWT helpers: round trip, wrong secret, expired, tampered, malformed, unsigned and wrong-algorithm tokens |
| `tests/sanitize.test.ts` | Allowlist behavior: scripts, images (including base64), event handlers, links, style attributes; idempotence over repeated saves; no double escaping of entities |
| `tests/validation.test.ts` | zod schemas for title, document update, share and remove-share; the 500 KB content limit counted in bytes |
| `tests/sharing.test.ts` | The share-target rule (no self-share, no sharing with the owner) |
| `tests/autosave.test.ts` | The autosave state machine: one request in flight, follow-up saves, stale responses, failure and retry, and the blocked state when access is lost |
| `tests/import.test.ts` | The `.txt` and `.md` converters, title from filename, the import pipeline (type, size and empty-file checks, sanitizing, the 500 KB cap), and the `project_notes.md` and `meeting_agenda.txt` sample files |
| `tests/docx.test.ts` | The `.docx` converter, using `tests/fixtures/sample.docx`, including corrupt and truncated files |

Not covered by the suite: route handlers, Prisma queries, React components, and the full browser flow. API behavior was exercised separately against a throwaway database. See `docs/ARCHITECTURE.md` for the reasoning.

## Deployment

Target: Vercel (Hobby plan) and Neon Postgres (free tier).

1. Create the Neon project and copy the pooled and direct connection strings, as described under Local setup.
2. From your machine, push the schema and seed the Neon database. Set the values for that shell only so they are not written to disk:

   ```bash
   export DATABASE_URL="<pooled string>"
   export DIRECT_URL="<direct string>"
   export JWT_SECRET="<any string of 16+ characters; not used by these two commands>"
   npm run db:push
   npm run db:seed
   ```

3. Push the repo to GitHub and import it in Vercel. The Next.js preset is detected automatically.
4. Under Environment Variables, add `DATABASE_URL` (pooled), `DIRECT_URL` (direct) and `JWT_SECRET` for Production.
5. Deploy. `postinstall` runs `prisma generate`, so the build needs no extra steps.
6. Open the deployment URL and sign in as `alice@draftly.test`. The dashboard shows "Signed in as Alice" and the "Welcome to Draftly" document.

The Vercel build does not touch the database. If the schema changes, run `npm run db:push` against Neon again.

Neon's free tier suspends the database when idle, so the first request after a quiet period can take a few seconds or briefly fail. Refresh once and later requests are fast.

## Known limitations

- **Last write wins, no real-time collaboration.** If two people edit the same document, the later save replaces the earlier one. There is no conflict detection and no live cursors.
- **No document delete.** Documents can be created but not removed.
- **No version history.**
- **No Markdown export.**
- **Sharing is by email, to existing users only.** There are no invitations for people without an account. An unknown email returns "No user found with that email", which tells the owner whether an address is registered. I accepted that for an internal-tool scope.
- **Images are dropped on import and on save.** The editor has no image support and the sanitizer removes `img` tags.
- **Imports are lossy by design.** Markdown tables lose their structure (the text is kept), code blocks become paragraphs with line breaks, links keep only their text, and deeper headings become H3. Anything outside the supported formatting is flattened to text.
- **Zip-bomb style `.docx` files are not mitigated.** The 2 MB upload cap does not limit the unzipped size.
- **Limited formatting.** Only bold, italic, underline, H1 to H3, and bullet and numbered lists. Links, tables, colors and fonts are dropped.
- **Seeded accounts only.** No signup, password reset, or email verification. The demo credentials are shown on the login page.
- **Content is capped at 500 KB** of HTML per save and per import.
- **Cold starts.** The first request after Neon idles can be slow.
- **A database outage shows an error page.** It no longer looks like being signed out, but there is no retry or offline mode.

## What works / What is incomplete / What I would build next

**What works** (implemented in the code):

- Login and logout with seeded users; session in an httpOnly cookie; clickable demo accounts on the login page.
- Create, rename, edit and reopen documents with formatting that survives a reload.
- Autosave with a clear status, retry on failure, a warning before leaving with unsaved changes, and a clean stop if access is removed mid-edit.
- Access control on every route and page: owner, editor, viewer, and a 404 for everyone else.
- Dashboard split into owned and shared documents, with role badges.
- Sharing from the Share dialog: add by email, change role, remove, with inline errors.
- Import of `.txt`, `.md` and `.docx` from the dashboard, with client-side checks and clean error messages.
- Sanitized storage, and automated tests for the pure logic (run `npm test`).
- A seeded "Welcome to Draftly" document shared with Bob (viewer) and Carol (editor).
- Friendly error and not-found pages.

**What is incomplete:**

- Markdown export: not started.
- Document delete: not started.
- Version history and real-time collaboration: not started.
- No automated tests for route handlers or the browser flow.

**What I would build next with 2 to 4 more hours:**

1. Conflict detection on save: send the `updatedAt` the client last saw and return 409 if it is stale, then show a "this document changed" prompt.
2. Owner-only document delete with a confirmation step.
3. Markdown export.
4. Route-level integration tests against a throwaway database.
5. Importer hardening: limit the unzipped size of `.docx` files, and keep more structure from markdown tables and code blocks.
