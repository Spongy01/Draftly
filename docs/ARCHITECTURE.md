# Architecture

This note covers what I prioritized in the 4-hour window and why. File paths are relative to the repo root.

## Product slice

I built the core loop that makes a document editor believable: sign in, write formatted text that persists, and share it with another user at a specific permission level. I spent the time on correctness of that loop (access control, safe content, reliable saving) rather than on breadth.

What I cut, and why:

| Cut | Reason |
|---|---|
| Real-time co-editing (CRDT, websockets) | Largest time sink, and Vercel serverless is a poor fit for long-lived connections. Last write wins is documented. |
| Conflict detection on save | Cheap to describe, but it needs UI for the conflict case. First item for a follow-up. |
| Signup, password reset, OAuth | Seeded users are enough to demonstrate sharing between accounts. |
| Version history, comments, presence | Not needed to show the core flow. |
| Images, links, tables, fonts | Not in the required formatting list, and each one widens the sanitizer surface. Images in particular bloat stored HTML as base64. |
| `.pdf`, `.doc`, `.rtf` import | The brief names only txt, md and docx. |
| Document delete, Markdown export | Lowest value per hour of the remaining items. |

## Stack

| Choice | Why |
|---|---|
| Next.js 16, App Router, TypeScript | UI and API route handlers in one repo, one-step Vercel deploy. |
| Tailwind | Fast to style without a component library. |
| Postgres on Neon, via Prisma 6 | Vercel's filesystem is ephemeral, so SQLite would lose data between invocations. Neon is a free, persistent Postgres reachable from serverless. Prisma gives a typed schema and a seed script. |
| TipTap | StarterKit covers every required format, reads and writes HTML, and `editable: false` gives safe read-only rendering. |
| zod | One schema per endpoint, shared by validation tests. |
| bcryptjs + jose | Password hashing and a signed JWT in an httpOnly cookie, in a few small files (`src/lib/auth.ts`, `src/lib/session-token.ts`). No auth service to configure. |
| sanitize-html | Allowlist sanitizer that runs in plain Node. |
| mammoth, marked | `.docx` and `.md` to HTML for upload. |
| Vitest | TypeScript-native and fast, which suits testing pure functions. |

## Data model

Defined in `prisma/schema.prisma`.

| Table | Columns | Notes |
|---|---|---|
| `User` | `id`, `email` (unique, lowercased), `name`, `passwordHash`, `createdAt` | Seeded, no signup. |
| `Document` | `id`, `title`, `contentHtml`, `ownerId`, `createdAt`, `updatedAt` | `ownerId` cascades on delete. Index on `ownerId`. |
| `Share` | `id`, `documentId`, `userId`, `role` (`VIEWER` or `EDITOR`), `createdAt` | Unique on `(documentId, userId)`, so a user has at most one role per document. Index on `userId`. |

The owner is a column on `Document`, not a share row. "Owner" is therefore never a stored role, and it cannot be granted or revoked through the share API.

## Access model

All authorization goes through one pure function in `src/lib/access.ts`:

```ts
getAccess(user, doc, shares): "owner" | "editor" | "viewer" | "none"
```

It does no I/O. It takes plain data and returns a level. `canView`, `canEdit` and `canManage` derive capabilities from that level, and `decideAccess` maps (user, document, shares, needed level) to either an allowed access level or a status code:

- no session: 401
- document missing, or user has no access: 404
- user can view but lacks the needed level: 403

`src/lib/guard.ts` (`requireDocumentAccess`) is the thin I/O wrapper: it loads the session user, the document and its shares, calls `decideAccess`, and returns the document plus the access level. Route handlers and the document page both call it. It also drops the `shares` relation from what it returns, so a handler cannot leak the share list to a non-owner by accident.

**Missing and no-access documents return the identical 404.** If they differed, a 403 for "exists but not yours" would let anyone probe for valid document IDs. Because `decideAccess` returns the same status and the guard uses one message ("Document not found"), the two cases are indistinguishable. This is covered by a test. The document page does the same: 403 and 404 both call `notFound()`.

**Every route checks access itself instead of relying on middleware.** Middleware runs before the handler and cannot see the document or its shares, so it can only answer "is there a session", not "may this user touch this document". It is also easy to bypass by accident, for example through a matcher that misses a path. Calling the guard inside each handler makes the check impossible to skip without noticing, and it puts the check next to the data it protects. The repo has no middleware file at all. Pages redirect to `/login` themselves.

The guard runs before any request body is read, so unauthorized callers cannot make the server parse large or malformed input.

## Content handling

Documents are stored as HTML in `Document.contentHtml`, because TipTap, mammoth and marked all produce and consume HTML.

Stored HTML is treated as untrusted. `src/lib/sanitize.ts` applies a strict allowlist, with no attributes at all:

`p, h1, h2, h3, strong, em, u, ul, ol, li, br`

It runs on every PATCH before the write. The upload path (`src/lib/import/index.ts`) uses the same function after converting the file. Disallowed tags are unwrapped (their text is kept) except `script`, `style`, `textarea` and `option`, whose contents are dropped. Images, links, classes, styles and event handlers do not survive.

The editor is configured to match the allowlist (`src/components/editor/Editor.tsx`). TipTap's StarterKit turns off code, code block, blockquote, strike, horizontal rule and link, so the editor cannot produce markup the server would strip. Otherwise a user could apply a format, see it, and lose it on the next reload.

Read-only documents render through TipTap with `editable: false`. The app never uses `dangerouslySetInnerHTML`, so even if the sanitizer had a gap, stored HTML is parsed by ProseMirror rather than injected into the DOM.

A test checks that sanitizing is idempotent, since autosave re-sanitizes the same content repeatedly and a non-idempotent sanitizer would slowly corrupt text (for example by double-escaping `&`).

Content is limited to 500 KB per save. The size is counted in UTF-8 bytes, before sanitizing, and the check avoids encoding large strings unless the length is in an ambiguous range.

## Import

`POST /api/upload` accepts one file in the `file` field of a multipart form and creates a new document owned by the caller. The pipeline lives in `src/lib/import/` and has no database access, which is why it is testable on its own:

1. The route checks the session (401), then rejects an oversized `Content-Length` early (413), then parses the form and requires exactly one file.
2. `importFile` decides the type by extension (`.txt`, `.md`, `.docx` only), rejects empty files, and rejects files over 2 MB (413). The 2 MB cap sits below Vercel's roughly 4.5 MB request body limit.
3. A converter produces HTML: `.txt` escapes text and splits on blank lines; `.md` uses `marked` with a small renderer (code blocks become paragraphs with line breaks, blockquotes become plain paragraphs, headings deeper than H3 become H3, rules are dropped); `.docx` uses `mammoth` on an in-memory buffer, with a style mapping that keeps underlines and an image converter that never reads image data. Nothing is written to disk, since Vercel's filesystem is read-only.
4. The result always goes through the same sanitizer as saved content, then must contain visible text (400) and fit in 500 KB (413). The document is created only after all of that succeeds, so a failed import leaves nothing behind.
5. A corrupt `.docx` returns a plain 400 message, never a stack trace.

The dashboard's Import file button repeats the type, empty-file and size checks in the browser with the same messages (the constants live in `src/lib/import/constants.ts`), because the platform can reject a large body with a non-JSON 413 before it reaches the route. It treats any unreadable response as a generic upload error.

Known gaps: images are dropped, markdown tables lose their structure (text only), and a small `.docx` that expands hugely when unzipped is not detected. Fixtures for all three formats are in `tests/fixtures/`.

## Autosave

The logic is a pure state machine in `src/components/editor/autosave.ts`, driven by a hook (`useAutosave.ts`) that adds a 1 second debounce and `fetch`. Keeping the rules out of React means they can be unit tested.

- **One request in flight.** A new save never starts while another is pending. This prevents responses arriving out of order and an older save overwriting a newer one.
- **Edit counter.** Every local edit bumps `editVersion`. A save records the version it sent. "Saved" is shown only when the server confirmed a request and no newer edits exist, so typing during a save never shows a false "Saved".
- **Request sequence numbers.** A response only counts if it matches the current in-flight request, so stale responses are ignored.
- **Follow-up save.** Edits made during a request collapse into one follow-up request sent when the first finishes.
- **Uncontrolled editor.** The editor loads `initialHtml` once and owns its content afterward. Server responses are never pushed back into it, so a save cannot overwrite what the user typed while the request was running.
- **Failure.** On a network or server error the edits stay marked dirty, the indicator shows the error with a Retry button, and the text stays in the editor. The next edit or a click on Retry sends again. A `beforeunload` warning fires while anything is unsaved.
- **Access removed.** A 403 (downgraded to viewer) or 404 (share removed) puts the state machine in a terminal "blocked" state. Nothing is sent again, so there is no retry loop against a route that will keep refusing. The unsaved text stays on screen so the user can copy it, and the UI offers Reload or Back to dashboard.

## Security and privacy tradeoffs

- **Email enumeration on the share form.** Sharing with an unknown email returns "No user found with that email". That reveals which addresses are registered. I accepted this because only signed-in document owners can reach it, the user base is a small internal set, and a clear error is better UX than a silent no-op. A public product would need a different design, for example an invitation flow that behaves the same either way.
- **Login does not enumerate.** Wrong email and wrong password return the same message, and a dummy bcrypt hash is compared when the email is unknown so timing does not reveal it either.
- **Session cookie.** httpOnly, `SameSite=Lax`, `Secure` in production, 7 day expiry. The user is reloaded from the database on each request, so a deleted user loses access immediately.
- **No CSRF token.** The API only accepts JSON bodies and relies on `SameSite=Lax`. That is a reasonable baseline here, not a complete defense.
- **No rate limiting** on login or the API.
- **Demo credentials are shown on the login page.** The "Demo accounts" box lists the three seeded emails and the shared password, and each row fills the form. I accepted this because the deployment is a seeded review environment with no real users or data, and it removes friction for reviewers. A real product would not publish credentials. The password hashes are still bcrypt, and nothing else about authentication is relaxed.
- **Share list is owner-only,** and document queries use explicit `select` clauses so emails and other user fields are not returned by accident.
- **Database errors are not treated as signed out.** `getCurrentUser` returns `null` only for a missing, invalid or expired token, or a user who no longer exists. A failing database lookup propagates, so pages show the error page and API routes return 500. Treating an outage as "signed out" would have bounced users to the login page for no reason.
- **Error pages never render error details.** `not-found.tsx`, `error.tsx` and `global-error.tsx` show fixed text and a link back to the dashboard. The error object is not displayed, and server errors reach the logs only.
- **Last write wins** means an editor can overwrite another editor's work without warning. This is a known limit, not a security issue, but it affects trust in shared documents.

## Testing approach

I tested pure functions directly and kept them free of I/O so the tests need no database, mocks or server. That is why the access rule, the guard's status mapping, the sanitizer, the zod schemas, the share-target rule, the autosave state machine and the import pipeline are separate modules. Run `npm test` to run all of them:

| File | Covers |
|---|---|
| `tests/access.test.ts` | Access rules: `getAccess`, capability helpers, and `decideAccess` status mapping including the identical 404 |
| `tests/validation.test.ts` | zod schemas for title, document update, share and remove-share; the byte-counted 500 KB limit |
| `tests/sanitize.test.ts` | The allowlist, idempotence, and no double escaping |
| `tests/autosave.test.ts` | The autosave state machine, including stale responses and the blocked state |
| `tests/sharing.test.ts` | The share-target rule |
| `tests/session-token.test.ts` | Session JWT helpers: valid, wrong secret, expired, tampered, malformed, unsigned and wrong-algorithm tokens |
| `tests/import.test.ts` | `.txt` and `.md` converters, title from filename, the import pipeline checks, and the `project_notes.md` and `meeting_agenda.txt` sample files |
| `tests/docx.test.ts` | The `.docx` converter against `tests/fixtures/sample.docx`, including corrupt and truncated files |

These are the parts where a mistake is both likely and costly: access control leaks data, a sanitizer gap is an XSS risk, and autosave bugs lose user text. They are also cheap to test exhaustively.

Not covered by the suite: route handlers, Prisma queries, and React components. API behavior was exercised separately against a throwaway database, but that was not automated and is not in the repo. The share dialog, the Import file button and the full browser flow have no automated tests; I checked those by hand.

If I had more time, the next tests would be route-level integration tests against a disposable Neon branch, kept in the repo.

## Plan vs. as built

`docs/MVP.md` is the original plan. Where the two differ, the code is the source of truth.

| Topic | Plan (`docs/MVP.md`) | As built | Reason |
|---|---|---|---|
| Login route | `POST /api/auth/login` | `POST /api/auth` (logout stays at `/api/auth/logout`) | One handler for one action; no need for a sub-path. |
| Page routes | `/` dashboard, `/docs/[id]` | `/dashboard`, `/doc/[id]`; `/` redirects to `/dashboard` | Simpler naming; `/` just forwards. |
| Share endpoint | `POST /shares`, `PATCH` and `DELETE /shares/:userId` | One endpoint, `/api/documents/[id]/share`, with GET (list), POST (add or change role) and DELETE (body `{userId}`) | POST is an upsert, so adding and changing a role are the same call. Fewer routes to guard. |
| Upload route | `POST /api/documents/upload` | `POST /api/upload` | Kept separate from the per-document routes since it creates a document. |
| Document delete | `DELETE /api/documents/:id`, owner only | No delete endpoint | Cut for time. Listed under known limitations. |
| Content column | `content`, default `<p></p>` | `contentHtml`, default `""` | The name states the format. TipTap treats an empty string as an empty document. |
| Roles | `viewer`, `editor` | `VIEWER`, `EDITOR` (Prisma enum) | Prisma enum convention. |
| Content size cap | 1 MB | 500 KB, counted in UTF-8 bytes | Smaller cap keeps saves and sanitizing fast; plenty for this scope. |
| Autosave debounce | about 1.5 s | 1 s | Feels more responsive; the single-request-in-flight rule already bounds request volume. |
| Seed data | Users, "Welcome to Draftly" (Bob editor, Carol viewer), "Alice private notes", and "Bob's roadmap" | Users plus one sample document, "Welcome to Draftly", owned by Alice and shared with Bob as viewer and Carol as editor. Idempotent, with an empty `update` so re-runs never overwrite edits | One document is enough to show both roles on first login, and a fixed id makes the upsert safe. Roles are swapped so Bob demonstrates the read-only view. |
| Middleware | Redirects unauthenticated page visits to `/login` | No middleware; pages and route handlers each check access themselves | See "Access model". The check lives next to the data it protects. |
| Login page | Shows the test accounts | A "Demo accounts" box on `/login`; each row fills the form | Fewer steps for reviewers. See "Security and privacy tradeoffs". |
| Next.js version | "14+" | 16.4.6 | Current release when the project was created. |
| Markdown export | Stretch goal using `turndown` | Not built. The `turndown` dependency was removed; `src/lib/export/markdown.ts` is a comment-only stub | Nothing should be installed but unused. |
| Upload control | "Upload file" on the dashboard | "Import file" on the dashboard, with the supported types and size limit shown next to it | Wording only; behavior matches the plan. |
| Session lookup | Not specified | `getCurrentUser` returns `null` only for token problems or a missing user; database errors propagate | An outage should show an error page, not look like being signed out. |
| Error pages | A global `error.tsx` | `not-found.tsx`, `error.tsx` and `global-error.tsx`, none of which renders error details | Clean messages and no leaks. |
| App metadata | Not specified | Title "Draftly", a one-line description, and an SVG icon replacing the Next.js defaults | Removes leftover scaffold text. |
