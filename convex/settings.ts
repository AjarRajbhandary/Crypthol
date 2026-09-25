import { ConvexError, v } from "convex/values";
import { authenticatedMutation, authenticatedQuery } from "./functions";

/** Connection state for the Connections page. Never returns secrets. */
export const status = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const c = await ctx.db.query("credentials").first();
    const updatedBy = c?.updatedBy ? await ctx.db.get(c.updatedBy) : null;
    const mine = await ctx.db
      .query("redditAccounts")
      .withIndex("by_user", q => q.eq("userId", ctx.userId))
      .first();
    const accounts = await ctx.db.query("redditAccounts").collect();
    const team = await Promise.all(
      accounts.map(async a => {
        const u = await ctx.db.get(a.userId);
        return {
          name: u?.name ?? u?.email ?? "Teammate",
          username: a.username,
        };
      }),
    );
    return {
      configured: Boolean(c),
      clientIdHint: c ? `${c.clientId.slice(0, 4)}…` : null,
      updatedAt: c?.updatedAt ?? null,
      updatedByName: updatedBy?.name ?? updatedBy?.email ?? null,
      canPost: Boolean(mine),
      myUsername: mine?.username ?? null,
      team,
    };
  },
});

export const save = authenticatedMutation({
  args: { clientId: v.string(), clientSecret: v.string() },
  handler: async (ctx, args) => {
    const clientId = args.clientId.trim();
    const clientSecret = args.clientSecret.trim();
    if (!clientId || !clientSecret)
      throw new ConvexError("Client ID and secret are required");
    const existing = await ctx.db.query("credentials").first();
    const doc = {
      clientId,
      clientSecret,
      updatedAt: Date.now(),
      updatedBy: ctx.userId,
    };
    if (existing) await ctx.db.replace(existing._id, doc);
    else await ctx.db.insert("credentials", doc);
  },
});

export const clear = authenticatedMutation({
  args: {},
  handler: async ctx => {
    const existing = await ctx.db.query("credentials").first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const saveMyReddit = authenticatedMutation({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const username = args.username.trim().replace(/^u\//, "");
    if (!username || !args.password)
      throw new ConvexError("Reddit username and password are required");
    const existing = await ctx.db
      .query("redditAccounts")
      .withIndex("by_user", q => q.eq("userId", ctx.userId))
      .first();
    const doc = {
      userId: ctx.userId,
      username,
      password: args.password,
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.replace(existing._id, doc);
    else await ctx.db.insert("redditAccounts", doc);
  },
});

export const clearMyReddit = authenticatedMutation({
  args: {},
  handler: async ctx => {
    const existing = await ctx.db
      .query("redditAccounts")
      .withIndex("by_user", q => q.eq("userId", ctx.userId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});
