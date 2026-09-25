# Pondros Signal

Reddit social listening for the Pondros team. Signal searches the subreddits
you care about for conversations about Slack, project management and
follow-through, scores each thread for intent with AI, drafts a helpful reply,
and tracks who on the team is handling what.

**Stack:** React 19 + Vite + Tailwind/shadcn on the frontend, [Convex](https://convex.dev)
for the database, auth, scheduled jobs and server functions.

## What the team gets

| Page | What it's for |
| --- | --- |
| **Signal** | The feed. Filter by status, intent, subreddit and assignee. Assign threads to teammates, generate/edit AI drafts, post from your own Reddit account, or copy the draft, reply on Reddit, then **Mark replied** with a link. |
| **Subreddits** | The shared watchlist. Add/remove/pause subreddits (paste names, `r/names` or URLs). Per-subreddit **notes** (rules, tone, self-promo policy) go to the AI when it drafts replies there. Shows thread/open/replied counts. |
| **Keyword sets** | Reddit search queries (quotes, `OR`, parentheses). Each set runs against the **Watchlist**, a **specific** list of subreddits, or **all of Reddit**. |
| **Connections** | The team's shared Reddit app credential (for reading) and each person's own Reddit login (only for "Post as me"). |
| **Settings** | Display name, password, theme. |

Ingestion runs every 6 hours (`convex/crons.ts`), and anyone can hit **Pull now**.

Only emails on the domains in `ALLOWED_EMAIL_DOMAINS` can sign up or sign in.

## Setup (one-time, ~15 minutes)

You need Node 22+ (or Bun), a free Convex account, an OpenAI API key, and a
Reddit account to own the Reddit app.

```bash
bun install            # or: npm install
npx convex dev         # log in, create a project; leave this running in a terminal
```

`convex dev` writes `VITE_CONVEX_URL` to `.env.local` and pushes the backend.
In a second terminal, configure the deployment:

```bash
npx @convex-dev/auth                                   # generates JWT keys + SITE_URL for sign-in
npx convex env set ALLOWED_EMAIL_DOMAINS "pondros.com,herd-group.com"
npx convex env set OPENAI_API_KEY sk-...
# optional
npx convex env set OPENAI_MODEL gpt-4.1-mini           # scoring model
npx convex env set OPENAI_SMART_MODEL gpt-4.1          # drafting model
npx convex env set OPENAI_BASE_URL https://...         # any OpenAI-compatible API

bun run dev            # http://localhost:5173
```

Then in the app:

1. **Sign up** with your work email.
2. **Connections → Team Reddit app**: at <https://www.reddit.com/prefs/apps>,
   create a **script** app (redirect URI `http://localhost:8080`) and paste its
   client ID and secret. Reddit now reviews new API apps, so approval may take
   a little while.
3. On that Reddit app page, add each teammate's Reddit username under
   **developers**. Reddit only lets developers of a script app post through it.
   Each teammate then adds their own Reddit login under
   **Connections → Your Reddit account**. Skip this if you'd rather reply by
   hand and use **Mark replied**.
4. **Keyword sets → Load Pondros defaults** (this also fills the Subreddits
   watchlist), then edit freely.
5. **Signal → Pull now**.

## Deploying for the team

Production is a Convex production deployment plus a static frontend. On
Vercel:

1. In the Convex dashboard, go to **Settings → Deploy keys** and generate a
   **production** deploy key.
2. Import this repo into Vercel and set:
   - Build command: `npx convex deploy --cmd 'npm run build'`
   - Environment variable: `CONVEX_DEPLOY_KEY=<the key>`

   `convex deploy` pushes the backend and passes the right `VITE_CONVEX_URL`
   into the frontend build.
3. Configure the **production** deployment the same way as dev (prod needs its
   own settings):
   ```bash
   npx @convex-dev/auth --prod        # when asked for SITE_URL, give the Vercel URL
   npx convex env set --prod ALLOWED_EMAIL_DOMAINS "pondros.com,herd-group.com"
   npx convex env set --prod OPENAI_API_KEY sk-...
   ```

`vercel.json` already rewrites all routes to `index.html`. Netlify or
Cloudflare Pages work the same way, but they need an equivalent SPA rewrite.

## Admin notes

- **Forgotten password.** There's no email sender, so an admin resets it:
  `npx convex run --prod users:adminSetPassword '{"email":"a@pondros.com","password":"new-password"}'`
- **Removing someone.** Delete their row in the Convex dashboard's `users`
  table, or have them use Settings → Delete account. Remove them from the
  Reddit app's developers list too.
- **Secrets.** Reddit passwords and the app secret are stored in the Convex
  database. The app never sends them back to the browser, but anyone with
  Convex dashboard access can read them. Keep dashboard access to admins.
- **Logs.** `npx convex logs` (add `--prod` for production). Failed pulls also
  show as "— failed" next to "last pull" on the Signal page (hover for the
  error).

## Code map

```
convex/
  schema.ts       tables: subreddits, queries, hits, credentials, redditAccounts, runs
  auth.ts         email/password auth + ALLOWED_EMAIL_DOMAINS gate
  reddit.ts       Reddit OAuth, search/ingest, AI scoring, posting replies
  hits.ts         feed queries, assignment, drafts, mark replied
  subreddits.ts   watchlist CRUD + defaults
  topics.ts       keyword sets + defaults + sample data
  settings.ts     Reddit app + per-user Reddit login
  users.ts        team list, change/reset password, delete account
  lib.ts          OpenAI-compatible structured output helper
  crons.ts        6-hourly ingest
src/pages/        Signal, Subreddits, Keyword sets, Connections, Settings, auth pages
```

Handy scripts: `bun run typecheck`, `bun run check` (Biome), `bun run build`.
