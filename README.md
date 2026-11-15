# Draftly

## Overview

## Supported upload types

## Local setup

Requirements: Node.js 20+, npm, and a Postgres database (a free Neon project, or a local Postgres).

```bash
npm install                # also runs `prisma generate` (postinstall)
cp .env.example .env       # then fill in the values (see below)
npm run db:push            # create tables in the database
npm run db:seed            # create the 3 test users (idempotent, safe to re-run)
npm run dev                # http://localhost:3000
```

Quick local Postgres with Docker (optional, instead of Neon):

```bash
docker run -d --name draftly-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=draftly -p 5432:5432 postgres:16-alpine
# DATABASE_URL and DIRECT_URL both: postgresql://postgres:devpass@localhost:5432/draftly
```

Other scripts: `npm run build`, `npm start`, `npm run lint`, `npm test`, `npm run db:studio`.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string used by the app. On Neon, use the **pooled** string (host contains `-pooler`) and append `&pgbouncer=true` if it is not present. |
| `DIRECT_URL` | Direct (non-pooled) Postgres connection string, used by Prisma for `db:push` / migrations. |
| `JWT_SECRET` | Random string (min 16 chars) used to sign session cookies. Generate with `openssl rand -base64 32`. |

Never commit `.env` or `.env.local` (both are gitignored). `.env.example` has placeholders only.

## Seeded test users

All three share one password: `Draftly!2026`

| Email | Name |
|---|---|
| alice@draftly.test | Alice |
| bob@draftly.test | Bob |
| carol@draftly.test | Carol |

There is no signup and no password reset; these are the only accounts.

## Running tests

## Deployment

Target: Vercel (free Hobby plan) + Neon Postgres (free tier).

**1. Create the Neon database**
1. Sign up at neon.tech and create a project (pick a region close to your Vercel region).
2. In the project dashboard, click **Connect**. Copy two connection strings:
   - **Pooled connection** (host contains `-pooler`) → this is `DATABASE_URL`. Append `&pgbouncer=true` to it.
   - **Direct connection** (turn off "Connection pooling") → this is `DIRECT_URL`.

**2. Push the schema and seed Neon (from your machine)**

```bash
# set the values for this shell only, so they are never written to disk
export DATABASE_URL="<pooled string>"
export DIRECT_URL="<direct string>"
export JWT_SECRET="<any 16+ char string; not used by these two commands>"
npm run db:push
npm run db:seed
```

(Alternatively put them in a local `.env` file, which is gitignored.)

**3. Deploy on Vercel**
1. Push this repo to GitHub, then in Vercel choose **Add New → Project** and import it. The Next.js preset is auto-detected.
2. Under **Environment Variables**, add `DATABASE_URL` (pooled), `DIRECT_URL` (direct) and `JWT_SECRET` (`openssl rand -base64 32`) for Production (and Preview if you use it).
3. Deploy. `postinstall` runs `prisma generate`, so no extra build setup is needed.
4. Open the deployment URL and sign in as `alice@draftly.test` / `Draftly!2026`. The dashboard should show "Signed in as Alice".

If the schema changes later, re-run `npm run db:push` against Neon; the Vercel build does not touch the database.

**Neon cold starts:** the free tier suspends the database when idle, so the first request after a quiet period can take a few seconds (or briefly fail). Refresh once; later requests are fast.

## Known limitations

## What I'd build next
