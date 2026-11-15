# How I Built This (AI Workflow Log)

This is a running log of how I worked through the assessment, written as I go. I'm calling the project Draftly for now.

## How I split the work

I used two Claude sessions with different jobs. In a regular Claude chat, I talk through decisions and pressure-test them. In Claude Code, I hand off the actual coding once a decision is made. I wanted to be the one making the calls, so Claude Code never picks the architecture on its own. It documents and builds what I decided.

**Tools:** Claude (chat) for planning, review, and writing prompts. Claude Code for implementation. Neon, Vercel, and GitHub for the database, hosting, and source. I reviewed and committed every change myself.

## Planning (before any code)

I started by having Claude list every required feature from the assignment, so I had a checklist to build against and nothing sneaky buried in the text.

Then I had Claude Code draft an MVP.md. It proposed a stack: Next.js, Vercel, Neon Postgres, Prisma, TipTap, and a few small libraries for importing and sanitizing. I didn't just accept it. I reviewed each choice in chat, and most of it held up. The part I'm happiest about is that it avoided SQLite on Vercel, which would have quietly lost data.

I did tighten a few things:

- Shared documents render read-only through the editor, not as raw HTML.
- The sanitizer only allows the tags the editor actually needs.
- Every route checks access itself, using one pure function I can test.
- Uploads are capped at 2 MB with clear error messages.
- Seeded users only for auth, no signup or password reset.
- The README warns that the first request after idle can be slow.

I also made three product calls: viewer and editor roles for sharing, autosave with a visible saved indicator, and Markdown export as the one stretch feature, only if time allows.

## Step 1: Skeleton first, deploy early

Before building any real features, I started with a bare skeleton: a login page with seeded users, one database read, and a deploy to Vercel. The point was to find out early whether the whole pipeline works (database, environment variables, hosting) without getting invested in features sitting on a broken foundation. If something was going to go wrong with deployment, I wanted to find out in the first hour, not the last.

**Repo setup.** I had Claude Code create the folder structure first and stop for my review before writing any feature code. It scaffolded Next.js 16 and told me up front where it deviated from my instructions: it replaced some generated Turbopack config, added minimal code to the placeholder files so the build and test runner would not break, and dropped a types package that was no longer needed. I read the tree and the deviations before moving on, and they were all reasonable.

**Skeleton code.** Claude Code wrote the schema (users, documents, shares), an idempotent seed script with three test users, cookie-based login with a signed token, and a dashboard that shows how many documents the user owns. Before it wrote any auth code, I told it to read the bundled docs for the installed Next version instead of relying on memory, since some APIs had changed. I reviewed the auth code by hand, looking at the cookie flags, the generic error message for bad logins, and the fact that the dashboard checks the user itself instead of leaning on middleware.

**Something I caught.** When I checked my `.env` with Claude in chat, the direct database URL was still pointing at a local Postgres left over from Claude Code's own testing. Running the schema push with that would have created the tables on my laptop and left the real database empty. I fixed it, then confirmed in the Neon console that the three tables existed and the user table had three rows.

**Verification.** Production build passed, all three seeded users could log in locally, and I pushed the repo and deployed to Vercel with the environment variables set. Login works on the live URL.

**What I took from it.** The skeleton-first approach did its job: hosting, database, and auth were all proven before any real feature existed. Most of the friction was environment configuration, not code, which is exactly the kind of problem I wanted to hit early.

## Step 2: Access rules before features

Before building any document feature, I had permission logic written and tested. The core is one pure function that takes a user, a document, and its shares, and returns owner, editor, viewer, or none. It never touches the database, so it can be unit tested directly. A second small function turns that into an HTTP status.

Decisions I made here:
- A document that does not exist and a document you cannot access return the exact same 404, so the API never reveals which documents exist. Only someone who can view but not edit gets a 403.
- The guard returns a status as well as a ready-made response, so server pages can redirect or show not-found instead of returning JSON.
- The guard does not load the share list into the document object it returns, so a route cannot leak it by accident.

Claude Code wrote the code and 20 tests. I checked that the access file has no database or framework imports and that the tests cover the awkward cases (signed out, a share on a different document, an owner who also has a share row), not just the happy path. One thing went wrong: Claude Code stopped my dev server with an overly broad process kill. I added a rule to my prompts to only stop processes it started itself.

## Step 3: Documents API and dashboard

This step added creating, listing, opening, and renaming documents, plus a dashboard that separates "My documents" from "Shared with me" with role badges.

Decisions and changes:
- Editors can rename a document, as in Google Docs. Delete is deliberately cut for now and goes on the "what I'd build next" list.
- I caught that formatting dates on the server would show UTC on Vercel, so timestamps are rendered in the browser instead.
- The API returns only the owner's display name, never emails or password hashes, and queries select explicit fields.
- Updates that include unexpected fields are rejected with a 400 instead of silently ignored, so nothing can sneak content through before the editor exists.

How it was verified: Claude Code ran the checks against a throwaway local Postgres so nothing touched my real database. A second user got the identical 404 on someone else's document, viewers got a 403 on edits, and signed-out requests were redirected or rejected. It could not test the browser interactions, so I restarted the dev server, clicked through them myself, and confirmed my `.env` still pointed at Neon.

## Step 4: Editor and autosave

The editor is TipTap with a toolbar for bold, italic, underline, headings 1 to 3, and bullet and numbered lists. Documents autosave about a second after typing stops.

Decisions:
- Content is stored as sanitized HTML. The importers for Markdown and Word both produce HTML, so one format end to end means fewer conversions.
- The server sanitizes every save with a strict allowlist of tags and no attributes, and rejects content over 500 KB before doing any work on it.
- The editor is configured to allow exactly the formatting the sanitizer allows. Otherwise formatting could silently disappear after a refresh.
- Claude Code noticed that the newer TipTap already bundles underline, so I had it remove the separate package instead of leaving an unused dependency.
- Autosave design: one save in flight at a time, an edit counter so "Saved" only shows when nothing changed during the request, and an editor that never gets overwritten by server responses while the user types.
- I cut Claude Code's five commit checkpoints down to two, to save time while keeping a review point after the server side.

Where I pushed back: autosave sends editor HTML through the sanitizer over and over, so I asked for tests showing that repeated saves do not corrupt text (no double-escaped ampersands, same output on every pass). I also asked that the autosave logic live in plain functions, so the tricky cases could be tested without a browser: an edit during a save, a failed save then retry, and a stale response arriving late.

How it was checked: Claude Code ran the API against a throwaway database (formatting round trips, sanitizing, size limits, permissions) and wrote the state machine tests. It could not drive a browser, so I clicked through the editor myself and tested the shared-document view as a second user.

## Step 5: Sharing

Owners can share a document by email as viewer or editor. Only the owner can see or change who has access.

Decisions so far:
- One endpoint handles both adding someone and changing their role, so there is no separate update route.
- Entering an unknown email returns a clear error. That reveals which emails exist, which I accepted for an internal tool with seeded users, and I will say so in the architecture note.
- The share dialog uses the browser's built-in modal element instead of a library, which gives focus trapping and Escape to close for free.
- If an owner downgrades or removes someone while they are mid-edit, the autosave stops and tells them why, instead of retrying forever. I asked for the removal case to be handled too, not only the downgrade, after reading Claude Code's plan.

How it was checked: Claude Code ran the full permission matrix against a throwaway database (share, change role, remove, and every wrong-user case), and the autosave blocked states have their own unit tests. It could not drive a browser, so I tested the dialog myself on the live site with two windows. Downgrading Bob from editor to viewer while he was typing showed the "no longer have edit access" message and stopped further saves, which was the behavior I wanted to see.

## Step 6: File upload

Users can import a `.txt`, `.md`, or `.docx` file from the dashboard and get a new editable document titled from the filename.

Decisions:
- Every converter feeds the same sanitizer, so imported content gets the same safety rules as typed content.
- Images are dropped on import instead of stored, to keep documents small and avoid base64 blobs.
- Markdown tables lose their structure and code blocks become plain paragraphs, because the editor only supports a small set of formatting. I documented this instead of expanding the editor.
- A malicious or oversized zip inside a `.docx` is not mitigated. I wrote it down as a known limitation.

Things AI caught or I caught in review:
- Claude Code noticed that the Word converter ignores underlines by default and added the mapping, so underlined text survives.
- I pointed out that Vercel rejects request bodies over 4.5 MB before they reach my code, with a non-JSON response. That led to browser-side size and type checks and an error handler that never assumes the response is JSON.
- Claude Code built a real `.docx` fixture instead of mocking the converter, so the Word path is tested against an actual file.

How it was checked: 174 automated tests at the end of the build, plus API checks for every file type and every failure case (too large, wrong type, empty, corrupt, signed out). On the live site, a Word file kept its headings, bold, italic, underline, and both list types, and a Markdown file imported correctly.

## Step 7: Polish and documentation

What I added: demo account buttons on the login page, a seeded "Welcome to Draftly" document shared with Bob and Carol, friendly error pages, and a proper page title. I removed the unused dependencies and default files left over from scaffolding.

Two things from review worth noting:
- Claude Code flagged that the session lookup treated any database error as "signed out". With a free Neon database that can pause when idle, a slow first request would have bounced signed-in reviewers to the login page. I had it narrow the check so database errors show an error page instead.
- Claude Code tested its error pages by throwing a fake error containing a secret, a file path, and a SQL string, then confirming none of it reached the response.

I wrote the README, architecture note, and submission file in a second Claude Code window while the upload feature was being built, then ran a follow-up pass once the features were done. I told it to mark anything it could not verify, and it did: it refused to write that features were tested on the live site, so I added only the claims I could stand behind. It also made one git mistake (staging a deleted file in my index), flagged it right away, and reverted it, which is why I kept the rule that I make every commit.

## Changed or rejected so far

- Chose HTML storage over JSON after weighing both, because the importer outputs made HTML the simpler choice.
- Fixed a leftover local database URL in my `.env` that would have created tables in the wrong place.
- Changed server-side date formatting to browser-side.
- Told Claude Code to read the bundled docs for the installed Next.js version instead of relying on memory.
- Forbade broad process kills after one stopped my dev server.
- Added sanitizer idempotence tests and moved autosave logic into testable plain functions.
- Extended Claude Code's autosave plan to cover access being removed, not only downgraded.
- Added browser-side upload checks after spotting Vercel's request size limit.
- Narrowed the session lookup so database errors are not mistaken for being signed out.
- Cut the Markdown export stretch feature, and removed the dependency I had installed for it.

## Summary

**Where AI sped me up most.** Writing and testing the many small pieces: schema, auth, routes, converters, and the 170-plus automated tests. The permission logic, autosave state machine, and importers were written as plain functions, which made them quick to test and quick to trust. Running a second Claude Code window for the documentation saved real time while features were still being built.

**Where I kept the judgment.** I made the architecture decisions in a separate chat before any code was written: Postgres on Neon instead of SQLite on Vercel, HTML storage, a strict sanitizer, authorization in every route, and what to cut. Claude Code proposed, I reviewed, and I changed things where I disagreed (see the list above). I read and committed every change myself.

**What I rejected or changed.** See the list above. The common thread: AI output was usually correct for the happy path, and my review time went to access rules, failure cases, and production-only issues.

**How I verified.** Automated tests for the pure logic, API checks against throwaway databases for every permission and error case, my own click-throughs in the browser, and testing on the live Vercel deployment as multiple users. Claude Code could not drive a browser in this setup, so UI behavior was verified by me, and the docs only claim what I could confirm.

**What I would do differently.** Set up the second-window documentation workflow earlier, and ask for a browser-capable test setup so UI checks are automated instead of manual.