<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working agreement (Draftly)

### Architectural decisions belong to the user
- The agent does **not** make architectural decisions on its own. This includes: choice of libraries or frameworks, data model changes, auth/session strategy, API shape, folder/module structure, deployment setup, and anything that changes `docs/MVP.md`.
- The agent **may suggest** options, with clear reasons and trade-offs, then **waits for the user to accept** before implementing.
- If something is ambiguous and architectural, ask. If it is a small implementation detail inside an accepted design, pick the simplest reasonable choice and mention it in the summary.

### Review and commits
- **Never commit** (no `git commit`, `git push`, or branch changes) unless the user explicitly asks for it in that message.
- When a section of work is finished, report in this order, then **stop and wait** for the user to review and commit:
  1. A brief summary of what changes were made.
  2. The files affected (added / modified / removed).
  3. Any deviations from the instructions or assumptions made.
- Do not start the next section until the user has reviewed.
