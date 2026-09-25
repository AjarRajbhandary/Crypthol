import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { authenticatedAction } from "./functions";
import { aiStructured, USER_AGENT } from "./lib";

type Creds = Doc<"credentials"> | null;

// ---------------------------------------------------------------- auth

/**
 * App-only token (client_credentials) when no user login is given — enough
 * for searching. With a teammate's Reddit login it becomes a password-grant
 * token that can post as that user. Reddit only allows the password grant
 * for accounts listed as developers on the script app.
 */
async function getToken(
  creds: NonNullable<Creds>,
  user?: { username: string; password: string },
): Promise<string> {
  const basic = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const body = user
    ? new URLSearchParams({
        grant_type: "password",
        username: user.username,
        password: user.password,
      })
    : new URLSearchParams({ grant_type: "client_credentials" });

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok)
    throw new Error(
      `Reddit auth failed (${res.status}): ${text.slice(0, 200)}`,
    );
  const json = JSON.parse(text) as { access_token?: string; error?: string };
  if (!json.access_token)
    throw new Error(`Reddit auth: no token (${text.slice(0, 200)})`);
  return json.access_token;
}

type RawPost = {
  id: string;
  subreddit: string;
  title: string;
  selftext?: string;
  author: string;
  url?: string;
  permalink: string;
  created_utc: number;
  score: number;
  num_comments: number;
};

async function search(
  token: string,
  term: string,
  subreddits: string[],
  limit: number,
): Promise<RawPost[]> {
  const base =
    subreddits.length > 0
      ? `https://oauth.reddit.com/r/${subreddits.join("+")}/search`
      : "https://oauth.reddit.com/search";
  const params = new URLSearchParams({
    q: term,
    sort: "new",
    t: "month",
    limit: String(limit),
    raw_json: "1",
    ...(subreddits.length > 0 ? { restrict_sr: "1" } : {}),
  });
  const res = await fetch(`${base}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT },
  });
  if (!res.ok)
    throw new Error(
      `Reddit search failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
    );
  const json = (await res.json()) as {
    data?: { children?: { data: RawPost }[] };
  };
  return (json.data?.children ?? []).map(c => c.data);
}

// ---------------------------------------------------------------- db helpers

export const getCreds = internalQuery({
  args: {},
  handler: async (ctx): Promise<Creds> =>
    await ctx.db.query("credentials").first(),
});

export const redditAccountFor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) =>
    await ctx.db
      .query("redditAccounts")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first(),
});

export const activeQueries = internalQuery({
  args: {},
  handler: async ctx =>
    await ctx.db
      .query("queries")
      .withIndex("by_active", q => q.eq("active", true))
      .collect(),
});

export const upsertHit = internalMutation({
  args: {
    redditId: v.string(),
    subreddit: v.string(),
    title: v.string(),
    body: v.string(),
    author: v.string(),
    url: v.string(),
    permalink: v.string(),
    createdUtc: v.number(),
    score: v.number(),
    numComments: v.number(),
    matchedQueryId: v.id("queries"),
    matchedLabel: v.string(),
  },
  returns: v.union(v.id("hits"), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("hits")
      .withIndex("by_redditId", q => q.eq("redditId", args.redditId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        score: args.score,
        numComments: args.numComments,
      });
      return null;
    }
    return await ctx.db.insert("hits", {
      ...args,
      kind: "post",
      status: "new",
      ingestedAt: Date.now(),
    });
  },
});

export const markQueryRun = internalMutation({
  args: { id: v.id("queries"), hits: v.number() },
  handler: async (ctx, { id, hits }) =>
    await ctx.db.patch(id, { lastRunAt: Date.now(), lastHitCount: hits }),
});

export const saveScore = internalMutation({
  args: {
    id: v.id("hits"),
    intent: v.number(),
    intentReason: v.string(),
    theme: v.string(),
    angle: v.string(),
    icpFit: v.boolean(),
    painMatch: v.boolean(),
    communityOk: v.boolean(),
  },
  handler: async (ctx, { id, ...rest }) =>
    await ctx.db.patch(id, { ...rest, scoredAt: Date.now() }),
});

export const startRun = internalMutation({
  args: {},
  handler: async ctx =>
    await ctx.db.insert("runs", {
      startedAt: Date.now(),
      queriesRun: 0,
      newHits: 0,
      scored: 0,
      ok: true,
    }),
});

export const finishRun = internalMutation({
  args: {
    id: v.id("runs"),
    queriesRun: v.number(),
    newHits: v.number(),
    scored: v.number(),
    ok: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...rest }) =>
    await ctx.db.patch(id, { ...rest, finishedAt: Date.now() }),
});

export const unscored = internalQuery({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db
      .query("hits")
      .withIndex("by_created")
      .order("desc")
      .take(300);
    return rows.filter(r => r.scoredAt === undefined).slice(0, 40);
  },
});

// ---------------------------------------------------------------- scoring

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    intent: {
      type: "integer",
      description:
        "1-5. 5 = actively asking for a tool/help to track action items, follow-ups or projects in Slack. 4 = evaluating PM tools or complaining about follow-through/things falling through the cracks. 3 = general PM tooling discussion. 2 = adjacent chatter. 1 = irrelevant.",
    },
    reason: {
      type: "string",
      description: "One short sentence, max 20 words.",
    },
    theme: {
      type: "string",
      description:
        "One of: Slack PM, Tool evaluation, Action items / follow-through, Process advice, AI in PM, Other",
    },
    icpFit: {
      type: "boolean",
      description:
        "True if the poster looks like a 10-50 person client-facing / Slack-heavy team (agency, consultancy, ops, small business), not enterprise IT or a student.",
    },
    painMatch: {
      type: "boolean",
      description:
        "True if the pain is follow-through / commitments slipping, not merely note-taking or generic software shopping.",
    },
    communityOk: {
      type: "boolean",
      description:
        "True if a vendor-affiliated person could reasonably comment here (thread is asking for input, no obvious anti-promo framing).",
    },
    angle: {
      type: "string",
      description:
        "One sentence: the most useful, non-salesy thing a project-management practitioner could add to this thread.",
    },
  },
  required: [
    "intent",
    "reason",
    "theme",
    "angle",
    "icpFit",
    "painMatch",
    "communityOk",
  ],
};

export const scorePending = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const rows = await ctx.runQuery(internal.reddit.unscored, {});
    let n = 0;
    for (const row of rows) {
      try {
        const out = await aiStructured<{
          intent?: number;
          reason?: string;
          theme?: string;
          angle?: string;
          icpFit?: boolean;
          painMatch?: boolean;
          communityOk?: boolean;
        }>({
          prompt:
            "You triage Reddit threads for Pondros, a tool that tracks action items and follow-through inside Slack. Score this thread.",
          input: `Subreddit: r/${row.subreddit}\nTitle: ${row.title}\n\n${row.body.slice(0, 4000)}`,
          schema: SCORE_SCHEMA,
        });
        await ctx.runMutation(internal.reddit.saveScore, {
          id: row._id,
          intent: Number(out.intent ?? 1),
          intentReason: String(out.reason ?? ""),
          theme: String(out.theme ?? "Other"),
          angle: String(out.angle ?? ""),
          icpFit: Boolean(out.icpFit),
          painMatch: Boolean(out.painMatch),
          communityOk: Boolean(out.communityOk),
        });
        n += 1;
      } catch (e) {
        console.error("score failed", row.redditId, String(e));
      }
    }
    return n;
  },
});

// ---------------------------------------------------------------- ingest

export const ingest = internalAction({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    newHits: v.number(),
    scored: v.number(),
    queriesRun: v.number(),
  }),
  handler: async (
    ctx,
    { limit },
  ): Promise<{ newHits: number; scored: number; queriesRun: number }> => {
    const runId = await ctx.runMutation(internal.reddit.startRun, {});
    try {
      const creds = await ctx.runQuery(internal.reddit.getCreds, {});
      if (!creds)
        throw new Error(
          "No Reddit API credentials saved yet (Connections page).",
        );
      const token = await getToken(creds);
      const queries = await ctx.runQuery(internal.reddit.activeQueries, {});
      const watchlist = await ctx.runQuery(internal.subreddits.activeNames, {});
      let newHits = 0;
      for (const q of queries) {
        let found = 0;
        try {
          const scope = q.scope ?? (q.subreddits.length > 0 ? "custom" : "all");
          const subs =
            scope === "watchlist"
              ? watchlist
              : scope === "custom"
                ? q.subreddits
                : [];
          if (scope === "watchlist" && subs.length === 0) {
            await ctx.runMutation(internal.reddit.markQueryRun, {
              id: q._id,
              hits: 0,
            });
            continue;
          }
          // Reddit caps URL length, so search big watchlists in batches.
          const batches: string[][] = [];
          for (let i = 0; i < Math.max(subs.length, 1); i += 20)
            batches.push(subs.slice(i, i + 20));
          const posts: RawPost[] = [];
          for (const batch of batches)
            posts.push(...(await search(token, q.term, batch, limit ?? 25)));
          for (const p of posts) {
            const id = await ctx.runMutation(internal.reddit.upsertHit, {
              redditId: p.id,
              subreddit: p.subreddit,
              title: p.title ?? "",
              body: (p.selftext ?? "").slice(0, 8000),
              author: p.author ?? "",
              url: p.url ?? `https://www.reddit.com${p.permalink}`,
              permalink: `https://www.reddit.com${p.permalink}`,
              createdUtc: Math.round((p.created_utc ?? 0) * 1000),
              score: p.score ?? 0,
              numComments: p.num_comments ?? 0,
              matchedQueryId: q._id as Id<"queries">,
              matchedLabel: q.label,
            });
            found += 1;
            if (id) newHits += 1;
          }
        } catch (e) {
          console.error("query failed", q.label, String(e));
        }
        await ctx.runMutation(internal.reddit.markQueryRun, {
          id: q._id,
          hits: found,
        });
      }
      const scored: number = await ctx.runAction(
        internal.reddit.scorePending,
        {},
      );
      await ctx.runMutation(internal.reddit.finishRun, {
        id: runId,
        queriesRun: queries.length,
        newHits,
        scored,
        ok: true,
      });
      return { newHits, scored, queriesRun: queries.length };
    } catch (e) {
      await ctx.runMutation(internal.reddit.finishRun, {
        id: runId,
        queriesRun: 0,
        newHits: 0,
        scored: 0,
        ok: false,
        error: String(e),
      });
      throw e;
    }
  },
});

export const runIngestNow = authenticatedAction({
  args: {},
  returns: v.object({
    newHits: v.number(),
    scored: v.number(),
    queriesRun: v.number(),
  }),
  handler: async (
    ctx,
  ): Promise<{ newHits: number; scored: number; queriesRun: number }> =>
    await ctx.runAction(internal.reddit.ingest, {}),
});

// ---------------------------------------------------------------- replying

export const postReply = authenticatedAction({
  args: { hitId: v.id("hits") },
  returns: v.object({ ok: v.boolean(), message: v.string() }),
  handler: async (
    ctx,
    { hitId },
  ): Promise<{ ok: boolean; message: string }> => {
    const hit = await ctx.runQuery(internal.hits.byId, { id: hitId });
    if (!hit) return { ok: false, message: "Thread not found." };
    if (!hit.draft || hit.draft.trim().length === 0)
      return { ok: false, message: "Nothing to send — the draft is empty." };
    const creds = await ctx.runQuery(internal.reddit.getCreds, {});
    if (!creds)
      return {
        ok: false,
        message: "The team's Reddit app isn't connected yet (Connections).",
      };
    const account = await ctx.runQuery(internal.reddit.redditAccountFor, {
      userId: ctx.userId,
    });
    if (!account)
      return {
        ok: false,
        message:
          "Add your own Reddit login under Connections to post from the app, or use Copy + Open thread and then Mark replied.",
      };
    let token: string;
    try {
      token = await getToken(creds, account);
    } catch (e) {
      return { ok: false, message: String(e) };
    }
    const res = await fetch("https://oauth.reddit.com/api/comment", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        api_type: "json",
        thing_id: `t3_${hit.redditId}`,
        text: hit.draft,
      }),
    });
    const text = await res.text();
    if (!res.ok)
      return {
        ok: false,
        message: `Reddit rejected the reply (${res.status}).`,
      };
    let replyUrl: string | undefined;
    try {
      const json = JSON.parse(text);
      const errors = json?.json?.errors ?? [];
      if (errors.length > 0)
        return { ok: false, message: `Reddit: ${JSON.stringify(errors[0])}` };
      const thing = json?.json?.data?.things?.[0]?.data;
      if (thing?.permalink)
        replyUrl = `https://www.reddit.com${thing.permalink}`;
    } catch {
      /* ignore */
    }
    await ctx.runMutation(internal.hits.markReplied, {
      id: hitId,
      replyUrl,
      userId: ctx.userId,
    });
    return { ok: true, message: `Posted to Reddit as u/${account.username}.` };
  },
});
