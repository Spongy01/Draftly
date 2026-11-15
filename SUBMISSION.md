# Submission

Draftly: a lightweight collaborative document editor, built for a 4-hour take-home.

Live URL: https://draftly-eight-livid.vercel.app/login

Note: the database is on Neon's free tier, which suspends when idle. The first request after a pause can take a few seconds. Refresh once if the first load is slow or fails.

## What is included

| File | What a reviewer will find |
|---|---|
| Source code (`src/`, `prisma/`, `tests/`) | The Next.js app, Prisma schema and seed, and Vitest tests. |
| `README.md` | What the app does, how to run it locally, env vars, test users, a sharing walkthrough, the importer's behavior and limits, deployment steps, and known limitations. |
| `docs/ARCHITECTURE.md` | What I built and cut, stack reasons, data model, the access model, content handling, the import pipeline, autosave design, security tradeoffs, and plan vs. as built. |
| `docs/AI_WORKFLOW.md` | How I used AI tools while building this. |
| `SUBMISSION.md` | This file. |
| `walkthrough-video.txt` | A text file containing the walkthrough video URL. |
| `sample-files/` | Copies of the three import samples: `sample.docx`, `project_notes.md` and `meeting_agenda.txt` (the originals are in `tests/fixtures/`). |
| Screenshots (optional) | Images of the main screens, if included. |

## Test accounts

All three use the password `Draftly!2026`. The `/login` page has a "Demo accounts" box that lists them; clicking one fills the form.

| Email | Name |
|---|---|
| alice@draftly.test | Alice |
| bob@draftly.test | Bob |
| carol@draftly.test | Carol |

The seed also creates a document, "Welcome to Draftly", owned by Alice and shared with Bob as a viewer and Carol as an editor. Sign in as Bob or Carol to see it under "Shared with me" straight away.

## Sharing flow to try

Use two browsers, or a normal and a private window.

1. As Alice, create a document and type some text.
2. As Bob in the other window, confirm "Shared with me" shows only "Welcome to Draftly".
3. As Alice, open the new document, click Share, add `bob@draftly.test` as Viewer.
4. As Bob, reload the dashboard. The document appears with a Viewer badge. It opens read-only.
5. As Alice, change Bob to Editor. As Bob, reload: the toolbar appears and edits autosave.
6. While Bob is typing, as Alice change Bob to Viewer or remove him. Bob's next save stops with "You no longer have edit access" (or "This document is no longer shared with you") and his text stays in the editor.
7. As Alice, remove Bob. As Bob, reload the document: it returns "not found".

## Import flow to try

On the dashboard, click "Import file" (the helper text next to it says "Supports .txt, .md, .docx, up to 2 MB") and pick one of the files in `sample-files/`. Each becomes a new document owned by the signed-in user, titled from the filename. Try a `.pdf` or a file over 2 MB to see the error message; the browser rejects both before uploading.

## Partial or incomplete

**What is working:**

- Login and logout with seeded users (JWT in an httpOnly cookie), with clickable demo accounts on the login page.
- Create, rename, edit and reopen documents with bold, italic, underline, H1 to H3 and lists.
- Autosave with a Saving / Saved indicator, retry on failure, and a clean stop if access is removed mid-edit.
- Dashboard with "My documents" and "Shared with me" and role badges.
- Owner-only sharing from a Share dialog, by email, as viewer or editor, with role change and removal.
- Import of `.txt`, `.md` and `.docx` (up to 2 MB) from the dashboard, with client-side checks and clean error messages.
- Access checked in every route and page; no-access and missing documents both return 404.
- HTML sanitized on every save and import; automated tests for the pure logic (run `npm test`).
- A seeded "Welcome to Draftly" document shared with Bob (viewer) and Carol (editor).
- Friendly not-found and error pages with no error details shown.

**What is incomplete:**

- Document delete, Markdown export, and version history: not built.
- No real-time collaboration; last write wins.
- Sharing works for existing users only.
- Images are dropped on import and save. Markdown tables lose their structure, code blocks become paragraphs, and links keep only their text.
- Zip-bomb style `.docx` files are not mitigated; the 2 MB cap limits the upload, not the unzipped size.
- No automated tests for route handlers or the browser flow.

**What I would build next with another 2 to 4 hours:**

1. Conflict detection on save (409 on a stale `updatedAt`) with a prompt in the editor.
2. Owner-only document delete with confirmation.
3. Markdown export.
4. Route-level integration tests against a throwaway database.
5. Importer hardening: limit the unzipped size of `.docx` files, and keep more structure from markdown tables and code blocks.
