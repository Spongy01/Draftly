# Draftly: MVP Plan

## 1. Product summary

Draftly is a lightweight Google-Docs-style editor. Users log in with a seeded account, create and rename rich-text documents, and import `.txt`, `.md`, or `.docx` files as new editable documents. An owner can share any document with another user by email. The dashboard separates "My documents" from "Shared with me." Everything persists in Postgres as sanitized HTML, so formatting and sharing survive refreshes and are demonstrable between two accounts on a live URL.

**Assumptions (simplest reasonable choice):**
- Shared access = **edit** (no viewer role; that's a cut, see §2).
- No real-time co-editing. Last write wins. Two users can both open a doc, but changes are not live-merged.
- Login = seeded accounts with email + password. No signup.

## 2. Scope

### In scope (checklist)
- [ ] Seeded login/logout (signed cookie session)
- [ ] Create, rename, edit, save, reopen, delete (owner only) documents
- [ ] Rich text: bold, italic, underline, H1/H2/H3, bullet list, numbered list
- [ ] Upload `.txt` / `.md` / `.docx` → new editable doc
- [ ] Share by email (owner only), list/revoke shares
- [ ] Dashboard split: Owned vs Shared with me (with owner shown)
- [ ] Validation + error handling (see §8)
- [ ] 1 meaningful automated test (+1 cheap converter test)
- [ ] Live URL + test credentials
- [ ] Stretch (only one): **Export to Markdown** (see talkdoc.md §10)

### Explicitly out of scope

| Cut | Reason |
|---|---|
| Real-time co-editing / CRDT (Yjs) | Biggest time sink; not required. Last-write-wins is stated honestly in the README. |
| Viewer/editor roles | Optional stretch; Markdown export is cheaper. Schema leaves room (`role` column, always `editor`). |
| Signup, password reset, OAuth | "No real auth needed." Seeded users only. |
| Version history, comments, presence | Optional stretch items; only one allowed. |
| Images, tables, links, fonts, colors | Not in the required formatting list. |
| `.pdf`, `.doc`, `.rtf` import | Brief names only txt/md/docx. |
| Docx fidelity beyond headings/lists/bold/italic/underline | mammoth maps semantic styles only; that's the correct tradeoff. |
| Search, folders, pagination, trash/undo | Not needed for the demo. |
| Conflict detection (409 on stale save) | Documented limitation; first thing in "next 2-4 hours." |
| Mobile polish | Desktop-first. Usable on mobile, not optimized. |

## 3. Tech stack

| Layer | Choice | Why | Fallback |
|---|---|---|---|
| Framework | **Next.js 14+ (App Router) + TypeScript** | One repo for UI + API route handlers; one-click Vercel deploy | Vite React + Express on Render |
| Hosting | **Vercel Hobby (free)** | Free, zero-config, free for reviewers | Render free web service |
| Database | **Neon Postgres (free tier)** | Real persistent DB reachable from serverless. **No SQLite**: Vercel's filesystem is ephemeral and would silently lose data. | Supabase Postgres (just swap `DATABASE_URL`) |
| ORM | **Prisma** | Typed schema, migrations, seed script, fast to write | Drizzle |
| Editor | **TipTap** (`@tiptap/react`, `starter-kit`, `extension-underline`) | StarterKit already covers bold/italic/headings/lists; HTML in/out; I know it | **Quill** if TipTap bites (simpler, built-in toolbar) |
| Storage format | **Sanitized HTML** in a `TEXT` column | Matches TipTap `getHTML()` and mammoth/marked output; one format everywhere | n/a |
| .docx import | **mammoth** (`convertToHtml`) | Pure JS, runs in Node runtime, outputs clean semantic HTML | If it fails in prod: ship txt/md only and say so; do not burn time. Local dev fix is `serverExternalPackages`. |
| .md import | **marked** → HTML | Tiny, zero config | `markdown-it` |
| .txt import | Escape + split on blank lines into `<p>` | ~10 lines, no dependency | n/a |
| Sanitizing | **sanitize-html** on every write and import | Stored HTML must be safe to render (XSS) | `isomorphic-dompurify` |
| Auth | **bcryptjs + jose** (signed JWT in httpOnly cookie) | ~40 lines, no external service, no cost | NextAuth Credentials (only if time is spare; it won't be) |
| Validation | **zod** | One schema per endpoint | Hand-rolled checks |
| Tests | **Vitest** | Fast, TS-native | Jest |
| Styling | **Tailwind** | Fast to lay out toolbar + dashboard | Plain CSS |
| MD export (stretch) | **turndown** | HTML → Markdown in one call | Hand-rolled `<h1>`→`#` regex |

**Platform gotchas to respect:** route handlers that use mammoth/bcrypt/Prisma must set `export const runtime = 'nodejs'`. Vercel serverless request bodies cap at ~4.5 MB, so the upload limit is **2 MB**.

## 4. Data model (Prisma / Postgres)

```
User
  id           String  @id @default(cuid())
  email        String  @unique        // lowercased
  name         String
  passwordHash String
  createdAt    DateTime @default(now())

Document
  id        String  @id @default(cuid())
  title     String  // 1-120 chars, trimmed
  content   String  @default("<p></p>") // sanitized HTML
  ownerId   String  -> User.id (onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([ownerId])

Share
  id         String  @id @default(cuid())
  documentId String  -> Document.id (onDelete: Cascade)
  userId     String  -> User.id (onDelete: Cascade)   // grantee
  role       String  @default("editor")               // reserved; only "editor" in MVP
  createdAt  DateTime @default(now())
  @@unique([documentId, userId])   // enforces no duplicate shares
  @@index([userId])
```

**Access rule (single function, `lib/access.ts`):**
`getAccess(doc, userId) → 'owner' | 'editor' | null`. Every route calls it. No route re-implements permission logic.

## 5. API (Next.js route handlers)

All routes require a session (else `401`). All bodies validated with zod (invalid → `400` with `{error, fields?}`). Not found **and** no access both return `404` (don't leak existence) except where noted.

| Route | Purpose | Validation / authz |
|---|---|---|
| `POST /api/auth/login` | Set session cookie | email valid, password non-empty; generic `401 "Invalid email or password"` on failure |
| `POST /api/auth/logout` | Clear cookie | none |
| `GET /api/documents` | `{owned: [...], shared: [...]}` (id, title, updatedAt, owner name) | session only; queries scoped by `userId` |
| `POST /api/documents` | Create blank doc | `title` optional, default "Untitled document"; if present, trimmed 1-120 chars |
| `GET /api/documents/:id` | Fetch doc + `access` + shares (shares only if owner) | `getAccess` ≠ null else 404 |
| `PATCH /api/documents/:id` | Update `title` and/or `content` | access ∈ {owner, editor}; title trimmed 1-120 (empty → 400); content string ≤ 1 MB, sanitized server-side |
| `DELETE /api/documents/:id` | Delete | **owner only** (editor → 403) |
| `POST /api/documents/upload` | multipart `file` → new doc owned by caller | ext ∈ {.txt,.md,.docx} (checked on ext **and** non-empty); size ≤ 2 MB; result non-empty after conversion; title = filename minus ext (truncated to 120) |
| `POST /api/documents/:id/shares` | Share with `{email}` | **owner only** (403 otherwise); email valid + lowercased; user must exist (404 `"No user with that email"`); not self (400); not already shared (409) |
| `DELETE /api/documents/:id/shares/:userId` | Revoke | owner only |
| `GET /api/documents/:id/export?format=md` (stretch) | Download Markdown | any access; `Content-Disposition: attachment` |

Pages: `/login`, `/` (dashboard), `/docs/[id]` (editor). Unauthenticated → redirect to `/login`.

## 6. Main user flows

**Login**
1. [ ] Visit `/login` → see test accounts hint box (alice / bob).
2. [ ] Submit email + password → cookie set → redirect to `/`.
3. [ ] Wrong credentials → inline error, no redirect.

**Create**
1. [ ] Dashboard → "New document" → `POST /api/documents` → redirect to `/docs/:id`.

**Edit / rename / save / reopen**
1. [ ] Click title in header → edit inline → blur or Enter saves via PATCH (empty title reverts + shows error).
2. [ ] Type in editor; toolbar toggles bold/italic/underline/H1-H3/lists.
3. [ ] Autosave 1.5 s after last keystroke + manual Save button (Ctrl/Cmd+S). Status pill: `Saving… / Saved / Save failed (retry)`.
4. [ ] Refresh or reopen from dashboard → content and formatting identical.

**Upload**
1. [ ] Dashboard → "Upload file" (UI text: *"Supported: .txt, .md, .docx · max 2 MB"*).
2. [ ] Pick file → client pre-checks ext/size → `POST /api/documents/upload`.
3. [ ] Success → redirect to the new editable doc; failure → toast with the specific reason.

**Share**
1. [ ] Owner opens a doc → "Share" button → modal with email input + current-people list.
2. [ ] Enter `bob@draftly.test` → POST → Bob appears in list (with remove ✕).
3. [ ] Errors surfaced inline: unknown user, already shared, self-share.

**View a shared doc**
1. [ ] Log in as Bob → dashboard shows doc under "Shared with me" with "Shared by Alice" badge.
2. [ ] Open → editor loads, header shows "Shared · Alice" and **no** Share/Delete controls.
3. [ ] Bob edits and saves → log back in as Alice → sees Bob's change.

## 7. Sharing model and seeded users

- **Access = edit.** The grantee can edit content and title. Only the owner can share, revoke, or delete. A single `role` column is reserved for a future viewer role.
- **Dashboard:** two labelled sections, "My documents" and "Shared with me." Shared cards show owner name and an "Editor" chip. Visual difference: owned cards have the owner avatar/"You"; shared cards use an accent border and "Shared by X". Empty states for each section.
- **Seeded users** (password is the same for all, printed on `/login` and in README/SUBMISSION):

| Email | Name | Password |
|---|---|---|
| alice@draftly.test | Alice | `Draftly!2026` |
| bob@draftly.test | Bob | `Draftly!2026` |
| carol@draftly.test | Carol | `Draftly!2026` |

- **Seeded content:** Alice owns "Welcome to Draftly" (shared with Bob) and "Alice private notes" (not shared); Bob owns "Bob's roadmap". A reviewer sees both sections populated on first login. Carol exists to demo an unauthorized user.
- Seed script is idempotent (`upsert`) so it's safe to re-run in production.

## 8. Error handling and validation

- [ ] **Empty/whitespace title** → 400 `"Title is required (max 120 characters)"`; UI reverts to previous title.
- [ ] **Title > 120 chars** → 400 (upload truncates instead of failing).
- [ ] **Upload: wrong type** (ext not in list) → 400 `"Unsupported file type. Use .txt, .md or .docx"`.
- [ ] **Upload: too large** (> 2 MB) → 413 `"File too large (max 2 MB)"`; checked client-side first.
- [ ] **Upload: empty / unreadable / corrupt docx** → 422 `"Could not read this file"`; no partial doc is created (create only after successful conversion).
- [ ] **Upload: no file** → 400.
- [ ] **Share with nonexistent user** → 404 with message; modal shows it inline.
- [ ] **Duplicate share** → 409 (unique index is the backstop, not just a pre-check).
- [ ] **Share with self** → 400.
- [ ] **Non-owner tries to share/delete** → 403.
- [ ] **No access to doc** (or doc missing) → 404 page `"Document not found"`.
- [ ] **Not logged in** → 401 from API, redirect to `/login` from pages.
- [ ] **Save failure** (network/500) → status pill "Save failed," content stays in editor, retry on next change or button click; `beforeunload` warning if unsaved.
- [ ] **Oversized content** (> 1 MB) → 413.
- [ ] **Stored HTML always sanitized** (script tags, `on*` handlers, `javascript:` stripped) on PATCH and import.
- [ ] Global `error.tsx` boundary; API handlers wrapped so unexpected errors return `500 {error}` without stack traces.

## 9. Test plan

### The one meaningful automated test
**`access-and-sharing.test.ts` (Vitest, runs against a real Postgres via `DATABASE_URL`, cleans up its own rows):**
1. Alice creates a doc → `getAccess` for Alice = `owner`; Bob = `null` (stranger denied).
2. Alice shares with Bob → Bob's `getAccess` = `editor`; doc appears in Bob's `shared` list and *not* in his `owned` list.
3. Sharing the same doc with Bob again → rejected as duplicate.
4. Sharing with a nonexistent email → rejected.
5. Bob (editor) attempting share/delete → rejected; Bob editing content → allowed.
6. Alice revokes → Bob's access returns to `null`.

*Why this one:* it covers the core product promise (ownership + sharing + authorization) end-to-end through the same service functions the routes use.

### Second cheap test
`import.test.ts`: `.txt` → paragraphs, `.md` → headings/lists, small `.docx` fixture → `<strong>`/`<h1>`; script tags stripped.

### Manual QA checklist (run on the **deployed** URL before submitting)
- [ ] Login as Alice, Bob, Carol; wrong password rejected
- [ ] Create doc, rename, apply all 6 formats, wait for "Saved," hard-refresh → formatting intact
- [ ] Empty title rejected
- [ ] Upload a `.txt`, `.md`, `.docx` → each opens as editable doc with sensible formatting
- [ ] Upload a `.pdf` and a >2 MB file → clear errors
- [ ] Alice shares with Bob → Bob sees it under "Shared with me" (second browser/incognito)
- [ ] Bob edits → Alice reloads and sees it
- [ ] Bob has no Share/Delete controls; Bob hitting `DELETE` via URL gets 403
- [ ] Carol opening Alice's doc URL directly gets 404
- [ ] Share with `nobody@x.com`, duplicate, and self → correct errors
- [ ] Revoke Bob → Bob's refresh no longer lists it
- [ ] (Stretch) Export Markdown downloads valid `.md`
