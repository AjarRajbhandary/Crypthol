import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalQuery } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";

export const DEFAULT_SUBREDDITS: string[] = [
  "projectmanagement",
  "ProductManagement",
  "productivity",
  "slack",
  "startups",
  "smallbusiness",
  "agency",
  "consulting",
  "managers",
  "ExperiencedDevs",
  "Entrepreneur",
  "msp",
  "ITManagers",
];

export function normalizeSubreddit(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/(www\.|old\.)?reddit\.com/i, "")
    .replace(/^\/?r\//i, "")
    .replace(/\/.*$/, "")
    .trim();
}

async function insertIfMissing(
  ctx: MutationCtx,
  name: string,
  addedBy?: Id<"users">,
) {
  const clean = normalizeSubreddit(name);
  if (!/^[A-Za-z0-9_]{2,21}$/.test(clean))
    throw new ConvexError(`"${name}" isn't a valid subreddit name`);
  const all = await ctx.db.query("subreddits").collect();
  if (all.some(s => s.name.toLowerCase() === clean.toLowerCase())) return null;
  return await ctx.db.insert("subreddits", {
    name: clean,
    active: true,
    addedBy,
    createdAt: Date.now(),
  });
}

export async function seedDefaultSubreddits(ctx: MutationCtx) {
  const existing = await ctx.db.query("subreddits").first();
  if (existing) return 0;
  let n = 0;
  for (const s of DEFAULT_SUBREDDITS) if (await insertIfMissing(ctx, s)) n += 1;
  return n;
}

export const list = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const subs = await ctx.db.query("subreddits").collect();
    const hits = await ctx.db
      .query("hits")
      .withIndex("by_created")
      .order("desc")
      .take(1000);
    const counts = new Map<
      string,
      { total: number; open: number; replied: number; highIntent: number }
    >();
    for (const h of hits) {
      const key = h.subreddit.toLowerCase();
      const c = counts.get(key) ?? {
        total: 0,
        open: 0,
        replied: 0,
        highIntent: 0,
      };
      c.total += 1;
      if (h.status === "new" || h.status === "drafted") c.open += 1;
      if (h.status === "replied") c.replied += 1;
      if ((h.intent ?? 0) >= 4) c.highIntent += 1;
      counts.set(key, c);
    }
    const rows = await Promise.all(
      subs.map(async s => {
        const u = s.addedBy ? await ctx.db.get(s.addedBy) : null;
        return {
          ...s,
          addedByName: u?.name ?? u?.email ?? null,
          stats: counts.get(s.name.toLowerCase()) ?? {
            total: 0,
            open: 0,
            replied: 0,
            highIntent: 0,
          },
        };
      }),
    );
    return rows.sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    );
  },
});

export const add = authenticatedMutation({
  args: { names: v.array(v.string()) },
  handler: async (ctx, { names }) => {
    let added = 0;
    for (const raw of names) {
      if (!normalizeSubreddit(raw)) continue;
      if (await insertIfMissing(ctx, raw, ctx.userId)) added += 1;
    }
    return added;
  },
});

export const update = authenticatedMutation({
  args: {
    id: v.id("subreddits"),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, patch);
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("subreddits") },
  handler: async (ctx, { id }) => await ctx.db.delete(id),
});

export const seedDefaults = authenticatedMutation({
  args: {},
  handler: async ctx => await seedDefaultSubreddits(ctx),
});

export const activeNames = internalQuery({
  args: {},
  handler: async ctx =>
    (await ctx.db.query("subreddits").collect())
      .filter(s => s.active)
      .map(s => s.name),
});
