# Draftly: MVP Plan

## 1. Product summary

Draftly is a lightweight Google-Docs-style editor. Users log in with a seeded account, create and rename rich-text documents, and import `.txt`, `.md`, or `.docx` files as new editable documents. An owner shares a document with another user by email as either **viewer** or **editor**. The dashboard separates "My documents" from "Shared with me," with a role badge on shared docs. Everything persists in Postgres as sanitized HTML, so formatting and sharing survive refreshes and are demonstrable between two accounts on a live URL.

**Final decisions (override anything else):**
- Sharing has two roles per share: **viewer** (read-only) and **editor** (edit content and title).
- Saving = debounced autosave with a visible Saving / Saved indicator. Viewers get no save behavior.
- Read-only docs render through TipTap with `editable: false`. **Never `dangerouslySetInnerHTML`.**
- Auth = seeded users only, JWT in an httpOnly cookie. No signup, no password reset.
- No real-time co-editing. Last write wins.

## 2. Scope

### In scope (checklist)
- [ ] Seeded login/logout (JWT in httpOnly cookie)
- [ ] Create, rename, edit, reopen, delete (owner only) documents
- [ ] Rich text: bold, italic, underline, H1/H2/H3, bullet list, numbered list
- [ ] Debounced autosave + Saving/Saved indicator (not shown to viewers)
- [ ] Upload `.txt` / `.md` / `.docx` → new editable doc (types stated in UI and README)
- [ ] Share by email with viewer/editor role; change role; revoke
- [ ] Dashboard: "My documents" vs "Shared with me" (role badge + owner name)
- [ ] Authorization checked inside every route handler via `getAccess`
- [ ] Validation + error handling (see §8)
- [ ] Automated test: `getAccess` (owner / editor / viewer / stranger) + cheap sanitize/import test
- [ ] Live URL + test credentials
- [ ] Stretch (last, only if time remains): **Markdown export** via turndown

### Explicitly out of scope

| Cut | Reason |
|---|---|
| Real-time co-editing / CRDT (Yjs) | Biggest time sink; not required. Last-write-wins is stated in the README. |
| Conflict detection (409 on stale save) | Documented limitation; first item in "next 2-4 hours." |
| Signup, password reset, OAuth | Seeded users only. |
| Version history, comments, presence | Only one stretch allowed; export is cheapest. |
| Images, tables, links, fonts, colors | Not in the required formatting list. Sanitizer **strips images** (incl. mammoth base64 images); stated in the README. |
| `.pdf`, `.doc`, `.rtf` import | Brief names only txt/md/docx. |
| Docx fidelity beyond headings/lists/bold/italic/underline | mammoth maps semantic styles only. |
| Search, folders, pagination, trash/undo | Not needed for the demo. |
| Mobile polish | Desktop-first. |

## 3. Tech stack (unchanged, with decisions applied)

| Layer | Choice | Why | Fallback |
|---|---|---|---|
| Framework | **Next.js 14+ (App Router) + TypeScript** | UI + API route handlers in one repo; one-click Vercel deploy | Vite React + Express on Render |
| Hosting | **Vercel Hobby (free)** | Free, zero-config, free for reviewers | Render free web service |
| Database | **Neon Postgres (free)** | Persistent DB reachable from serverless. **No SQLite**: Vercel's filesystem is ephemeral. | Supabase Postgres (swap `DATABASE_URL`) |
| ORM | **Prisma** | Typed schema, migrations, seed | Drizzle |
| Editor | **TipTap** (`@tiptap/react`, `starter-kit`, `extension-underline`) | StarterKit covers every required format; HTML in/out; `editable: false` gives safe read-only rendering | **Quill** if TipTap bites |
| Storage | **Sanitized HTML** (`TEXT`) | Matches TipTap/mammoth/marked output | n/a |
| .docx import | **mammoth** `convertToHtml` | Pure JS, Node runtime, semantic HTML | If it fails in prod: txt/md only, documented |
| .md import | **marked** → HTML | Tiny | `markdown-it` |
| .txt import | Escape + split on blank lines → `<p>` | ~10 lines | n/a |
| Sanitizing | **sanitize-html**, allowlist only: `p, h1, h2, h3, strong, em, u, ul, ol, li, br`; no attributes, no other tags (strips `img`, `a`, `script`, styles) | Stored HTML is parsed by TipTap, never injected raw; images stripped to avoid base64 bloat | `isomorphic-dompurify` with the same allowlist |
| Auth | **bcryptjs + jose** (JWT, httpOnly, SameSite=Lax, Secure in prod) | ~40 lines, free | n/a |
| Validation | **zod** | One schema per endpoint | n/a |
| Tests | **Vitest** | TS-native, fast | Jest |
| Styling | **Tailwind** | Fast | Plain CSS |
| MD export (stretch) | **turndown** | HTML → Markdown | Hand-rolled regex |

**Platform gotchas:** routes using mammoth/bcrypt/Prisma set `export const runtime = 'nodejs'`. Vercel's body limit is 4.5 MB, so the upload cap is **2 MB**. Sanitization runs on every write (PATCH, upload); stored HTML is only ever loaded into TipTap.

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
  role       Role    @default(viewer)                 // enum Role { viewer editor }
  createdAt  DateTime @default(now())
  @@unique([documentId, userId])   // no duplicate shares
  @@index([userId])
```

**Access rule: one pure function, `lib/access.ts`:**
```ts
type Access = 'owner' | 'editor' | 'viewer' | 'none'
getAccess(user: {id} | null, doc: {ownerId}, shares: {userId, role}[]): Access
```
- No DB calls inside; the route loads the doc + its shares and passes them in.
- `user.id === doc.ownerId` → `owner`; else matching share → its role; else `none`. No user → `none`.
- Capabilities derived in one place: **read** = owner/editor/viewer; **write content/title** = owner/editor; **share/delete** = owner.

## 5. API (Next.js route handlers)

**Every handler** does: read session from cookie (else `401`) → load doc + shares → `getAccess` → enforce. Middleware only redirects unauthenticated page visits to `/login`; it is **not** the security boundary. Server-rendered pages (`/docs/[id]`) call `getAccess` too. Bodies validated with zod (invalid → `400 {error, fields?}`). `none` → `404` (don't leak existence); insufficient role → `403`.

| Route | Purpose | Validation / authz |
|---|---|---|
| `POST /api/auth/login` | Set JWT cookie | email valid, password non-empty; generic `401 "Invalid email or password"` |
| `POST /api/auth/logout` | Clear cookie | none |
| `GET /api/documents` | `{owned: [...], shared: [{..., role, ownerName}]}` | session only; queries scoped to the user |
| `POST /api/documents` | Create blank doc | `title` optional (default "Untitled document"); trimmed 1-120 |
| `GET /api/documents/:id` | Doc + `access`; shares list only for owner | `getAccess ≠ none` else 404 |
| `PATCH /api/documents/:id` | Update `title` and/or `content` | owner/editor only (viewer → 403); title trimmed 1-120; content string ≤ 1 MB, sanitized server-side |
| `DELETE /api/documents/:id` | Delete | owner only (else 403) |
| `POST /api/documents/upload` | multipart `file` → new doc owned by caller | ext ∈ {.txt,.md,.docx}; size ≤ 2 MB; non-empty after conversion; title = filename minus ext, truncated to 120 |
| `POST /api/documents/:id/shares` | `{email, role}` | owner only; email valid + lowercased; `role ∈ {viewer, editor}`; user must exist (404); not self (400); not already shared (409) |
| `PATCH /api/documents/:id/shares/:userId` | Change `{role}` | owner only; `role` valid; share must exist (404) |
| `DELETE /api/documents/:id/shares/:userId` | Revoke | owner only |
| `GET /api/documents/:id/export?format=md` (stretch) | Download Markdown | any access ≠ none; `Content-Disposition: attachment` |

Pages: `/login`, `/` (dashboard), `/docs/[id]` (editor or read-only view by access).

## 6. Main user flows

**Login**
1. [ ] `/login` shows the test accounts hint.
2. [ ] Submit email + password → JWT cookie → redirect to `/`.
3. [ ] Wrong credentials → inline error, no redirect.

**Create**
1. [ ] Dashboard → "New document" → `POST /api/documents` → `/docs/:id`.

**Edit / rename / reopen**
1. [ ] Click title → inline edit → blur/Enter saves via PATCH (empty reverts + error).
2. [ ] Toolbar toggles bold/italic/underline/H1-H3/bullets/numbers.
3. [ ] Debounced autosave (~1.5 s after last change); indicator shows `Saving…` → `Saved` (or `Save failed, retrying on next change`).
4. [ ] Refresh/reopen → content and formatting identical.

**Upload**
1. [ ] Dashboard → "Upload file", with visible text *"Supported: .txt, .md, .docx · max 2 MB"*.
2. [ ] Client pre-checks ext/size → `POST /api/documents/upload`.
3. [ ] Success → redirect to the new doc; failure → clear message (unsupported type / too large / unreadable).

**Share**
1. [ ] Owner opens doc → "Share" → modal: email input + role select (viewer/editor) + people list with role dropdown and remove ✕.
2. [ ] Share `bob@draftly.test` as editor → Bob appears in list.
3. [ ] Inline errors: unknown user, already shared, self-share, invalid role.

**View a shared doc**
1. [ ] Editor (Bob): dashboard shows doc under "Shared with me" with "Editor" badge and "Alice" as owner; opens full editor with autosave; no Share/Delete.
2. [ ] Viewer (Carol): "Viewer" badge; doc opens in TipTap `editable: false`, no toolbar, no save indicator, "View only" label.
3. [ ] Bob's edits are visible to Alice and Carol on reload.

## 7. Sharing model and seeded users

- **Roles:** `owner` (implicit, not stored) · `editor` (read + edit content/title) · `viewer` (read only). Only the owner shares, changes roles, revokes, or deletes.
- **Dashboard:** two labelled sections, "My documents" (owner "You") and "Shared with me" (owner name + colored role badge, accent border). Empty state for each.
- **Seeded users** (same password, shown on `/login` and in README/SUBMISSION):

| Email | Name | Password |
|---|---|---|
| alice@draftly.test | Alice | `Draftly!2026` |
| bob@draftly.test | Bob | `Draftly!2026` |
| carol@draftly.test | Carol | `Draftly!2026` |

- **Seeded content:** Alice owns "Welcome to Draftly" (shared: Bob = editor, Carol = viewer) and "Alice private notes" (unshared, demos stranger/404). Bob owns "Bob's roadmap" (shared: Alice = viewer).
- Seed is idempotent (`upsert`), safe to re-run in prod.

## 8. Error handling and validation

- [ ] **Empty/whitespace title** → 400 `"Title is required (max 120 characters)"`; UI reverts.
- [ ] **Title > 120 chars** → 400 (upload truncates instead).
- [ ] **Upload: unsupported type** → 400 `"Unsupported file type. Use .txt, .md or .docx"`.
- [ ] **Upload: > 2 MB** → 413 `"File too large (max 2 MB)"`; client pre-check too.
- [ ] **Upload: empty / corrupt / unreadable** → 422 `"Could not read this file"`; doc created only after successful conversion.
- [ ] **Upload: no file** → 400.
- [ ] **Sanitizer strips images** and everything outside the allowlist; import of an image-only docx → 422 (empty after sanitize).
- [ ] **Share: nonexistent user** → 404 `"No user with that email"`.
- [ ] **Share: duplicate** → 409 (unique index is the backstop).
- [ ] **Share: self** → 400. **Invalid role** → 400.
- [ ] **Non-owner share/role change/revoke/delete** → 403.
- [ ] **Viewer PATCH (title/content)** → 403; client also never sends saves for viewers.
- [ ] **No access / missing doc** → 404 `"Document not found"`.
- [ ] **Not logged in** → 401 (API), redirect to `/login` (pages).
- [ ] **Save failure** → indicator "Save failed", content stays in editor, retried on next change; `beforeunload` warning if unsaved.
- [ ] **Content > 1 MB** → 413.
- [ ] Global `error.tsx`; handlers return `500 {error}` with no stack traces.

## 9. Test plan

### The one meaningful automated test (write first)
**`access.test.ts`** (Vitest, pure, no DB, no network, runs in milliseconds). Tests `getAccess(user, doc, shares)`:
- [ ] **owner** → `owner`, even if also (wrongly) listed in shares
- [ ] **editor** share → `editor`
- [ ] **viewer** share → `viewer`
- [ ] **stranger** (no share) → `none`
- [ ] **shared on a different user** (another user's share does not grant access) → `none`
- [ ] **no user / null session** → `none`
- [ ] capability helpers: viewer cannot write; editor cannot share/delete; owner can do all

*Why this one:* every route's security rests on this function, and being pure it's fast and deterministic for reviewers to run with no database.

### Second cheap test (only if time permits)
`sanitize.test.ts`: `<script>`, `<img src="data:...">`, `onclick`, and `<a href="javascript:...">` are stripped; `p/h1-h3/strong/em/u/ul/ol/li/br` survive. Optional `.txt`/`.md` import checks.

### Manual QA checklist (on the **deployed** URL)
- [ ] Login as Alice, Bob, Carol; wrong password rejected
- [ ] Create, rename, apply all 6 formats, see Saving → Saved, hard-refresh → formatting intact
- [ ] Empty title rejected
- [ ] Upload `.txt`, `.md`, `.docx` → each opens editable with sensible formatting
- [ ] Upload `.pdf` and a >2 MB file → clear errors
- [ ] Docx with an image imports without the image (no crash)
- [ ] Alice shares with Bob (editor) and Carol (viewer) → both see it under "Shared with me" with correct badges (second browser/incognito)
- [ ] Bob edits → Alice reloads and sees it
- [ ] Carol sees read-only view: no toolbar, no save indicator, typing does nothing; direct `PATCH` as Carol → 403
- [ ] Bob/Carol have no Share/Delete controls; direct `DELETE` → 403
- [ ] A non-shared user opening Alice's private doc URL → 404
- [ ] Share with `nobody@x.com`, duplicate, self, bad role → correct errors
- [ ] Change Bob's role to viewer → Bob's editor becomes read-only on reload; revoke → disappears from his dashboard
- [ ] (Stretch) Export Markdown downloads valid `.md`

---
Build order, deployment, architecture/video notes, and risks (§10-13): see [talkdoc.md](talkdoc.md).
