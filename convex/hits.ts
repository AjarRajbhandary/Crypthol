import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  authenticatedAction,
  authenticatedMutation,
  authenticatedQuery,
} from "./functions";
import { aiStructured } from "./lib";

export const byId = internalQuery({
  args: { id: v.id("hits") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

export const markReplied = internalMutation({
  args: {
    id: v.id("hits"),
    replyUrl: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, { id, replyUrl, userId }) =>
    await ctx.db.patch(id, {
      status: "replied",
      repliedAt: Date.now(),
      repliedBy: userId,
      replyUrl,
    }),
});

/** For teammates who post by hand: record the reply against the thread. */
export const markRepliedManually = authenticatedMutation({
  args: { id: v.id("hits"), replyUrl: v.optional(v.string()) },
  handler: async (ctx, { id, replyUrl }) =>
    await ctx.db.patch(id, {
      status: "replied",
      repliedAt: Date.now(),
      repliedBy: ctx.userId,
      replyUrl: replyUrl?.trim() || undefined,
    }),
});

export const assign = authenticatedMutation({
  args: { id: v.id("hits"), userId: v.optional(v.id("users")) },
  handler: async (ctx, { id, userId }) =>
    await ctx.db.patch(id, { assignedTo: userId }),
});

export const list = authenticatedQuery({
  args: {
    status: v.optional(v.string()),
    minIntent: v.optional(v.number()),
    subreddit: v.optional(v.string()),
    // "all" | "me" | "unassigned" | a user id
    assignee: v.optional(v.string()),
  },
  handler: async (ctx, { status, minIntent, subreddit, assignee }) => {
    const rows = await ctx.db
      .query("hits")
      .withIndex("by_created")
      .order("desc")
      .take(500);
    const filtered = rows
      .filter(r =>
        status === "open"
          ? r.status === "new" || r.status === "drafted"
          : status && status !== "all"
            ? r.status === status
            : true,
      )
      .filter(r => (minIntent ? (r.intent ?? 0) >= minIntent : true))
      .filter(r =>
        subreddit && subreddit !== "all"
          ? r.subreddit.toLowerCase() === subreddit.toLowerCase()
          : true,
      )
      .filter(r =>
        !assignee || assignee === "all"
          ? true
          : assignee === "me"
            ? r.assignedTo === ctx.userId
            : assignee === "unassigned"
              ? !r.assignedTo
              : r.assignedTo === assignee,
      )
      .sort(
        (a, b) =>
          (b.intent ?? 0) - (a.intent ?? 0) || b.createdUtc - a.createdUtc,
      );
    const names = new Map<string, string>();
    const nameOf = async (id?: Id<"users">) => {
      if (!id) return undefined;
      if (!names.has(id)) {
        const u = await ctx.db.get(id);
        names.set(id, u?.name ?? u?.email ?? "Teammate");
      }
      return names.get(id);
    };
    return await Promise.all(
      filtered.map(async r => ({
        ...r,
        assignedToName: await nameOf(r.assignedTo),
        repliedByName: await nameOf(r.repliedBy),
        draftedByName: await nameOf(r.draftedBy),
      })),
    );
  },
});

export const stats = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db
      .query("hits")
      .withIndex("by_created")
      .order("desc")
      .take(1000);
    const week = Date.now() - 7 * 864e5;
    const lastRun = await ctx.db
      .query("runs")
      .withIndex("by_started")
      .order("desc")
      .first();
    return {
      total: rows.length,
      samples: rows.filter(r => r.isSample).length,
      highIntent: rows.filter(r => (r.intent ?? 0) >= 4).length,
      newThisWeek: rows.filter(r => r.createdUtc >= week).length,
      replied: rows.filter(r => r.status === "replied").length,
      assignedToMe: rows.filter(
        r =>
          r.assignedTo === ctx.userId &&
          (r.status === "new" || r.status === "drafted"),
      ).length,
      subreddits: Array.from(new Set(rows.map(r => r.subreddit))).sort(),
      lastRunAt: lastRun?.startedAt ?? null,
      lastRunOk: lastRun?.ok ?? null,
      lastRunError: lastRun?.error ?? null,
    };
  },
});

const statusValidator = v.union(
  v.literal("new"),
  v.literal("drafted"),
  v.literal("replied"),
  v.literal("ignored"),
);

export const setStatus = authenticatedMutation({
  args: { id: v.id("hits"), status: statusValidator },
  handler: async (ctx, { id, status }) => await ctx.db.patch(id, { status }),
});

export const saveDraft = authenticatedMutation({
  args: { id: v.id("hits"), draft: v.string() },
  handler: async (ctx, { id, draft }) => {
    const hit = await ctx.db.get(id);
    await ctx.db.patch(id, {
      draft,
      draftUpdatedAt: Date.now(),
      draftedBy: ctx.userId,
      status: hit?.status === "replied" ? "replied" : "drafted",
    });
  },
});

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description:
        "The Reddit comment. 60-140 words, plain text, no markdown headings, no links unless clearly useful, no emoji.",
    },
  },
  required: ["reply"],
};

const DRAFT_PROMPT = `You are a project-management practitioner and co-founder of Pondros, writing a Reddit comment.

Rules:
- Be genuinely useful first: answer the person's actual question with a concrete practice or opinion.
- Founder "we" voice, plain, no hype, no invented statistics, no emoji, no marketing language.
- The recurring thesis you can draw on: follow-through is the real work of management, and almost nobody instruments it (capture -> chase -> complete).
- Mention Pondros at most once, only if the thread is explicitly asking for a tool, and disclose it ("full disclosure, I work on one of these").
- If mentioning Pondros would be spammy, do not mention it at all.
- Match Reddit register: short paragraphs, no bullet-point sales deck.`;

export const generateDraft = authenticatedAction({
  args: { id: v.id("hits"), tone: v.optional(v.string()) },
  returns: v.string(),
  handler: async (ctx, { id, tone }): Promise<string> => {
    const hit = await ctx.runQuery(internal.hits.byId, { id });
    if (!hit) throw new Error("Thread not found");
    const notes = await ctx.runQuery(internal.hits.subredditNotes, {
      name: hit.subreddit,
    });
    const out = await aiStructured<{ reply?: string }>({
      prompt:
        DRAFT_PROMPT +
        (notes
          ? `\n- Our team's notes on r/${hit.subreddit} (follow them): ${notes}`
          : "") +
        (tone ? `\n- Extra instruction from the user: ${tone}` : ""),
      input: `Subreddit: r/${hit.subreddit}\nTitle: ${hit.title}\n\n${hit.body.slice(0, 4000)}\n\nSuggested angle: ${hit.angle ?? ""}`,
      schema: DRAFT_SCHEMA,
      smart: true,
    });
    const reply = String(out.reply ?? "").trim();
    if (!reply) throw new Error("Draft generation returned nothing");
    await ctx.runMutation(internal.hits.saveDraftInternal, {
      id,
      draft: reply,
      userId: ctx.userId,
    });
    return reply;
  },
});

export const subredditNotes = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const subs = await ctx.db.query("subreddits").collect();
    return (
      subs.find(s => s.name.toLowerCase() === name.toLowerCase())?.notes ?? null
    );
  },
});

export const saveDraftInternal = internalMutation({
  args: { id: v.id("hits"), draft: v.string(), userId: v.id("users") },
  handler: async (ctx, { id, draft, userId }) => {
    const hit = await ctx.db.get(id);
    await ctx.db.patch(id, {
      draft,
      draftUpdatedAt: Date.now(),
      draftedBy: userId,
      status: hit?.status === "replied" ? "replied" : "drafted",
    });
  },
});
