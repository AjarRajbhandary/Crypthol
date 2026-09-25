import {
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";
import {
  authenticatedAction,
  authenticatedMutation,
  authenticatedQuery,
} from "./functions";

/** Everyone on the team, for assignment dropdowns and attribution. */
export const list = authenticatedQuery({
  args: {},
  handler: async ctx => {
    const users = await ctx.db.query("users").collect();
    return users
      .map(u => ({
        _id: u._id,
        name: u.name ?? u.email?.split("@")[0] ?? "Teammate",
        email: u.email ?? "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const updateName = authenticatedMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const trimmed = name.trim();
    if (!trimmed) throw new ConvexError("Name can't be empty");
    await ctx.db.patch(ctx.userId, { name: trimmed });
  },
});

export const emailById = internalQuery({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => (await ctx.db.get(id))?.email ?? null,
});

export const changePassword = authenticatedAction({
  args: { currentPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, { currentPassword, newPassword }) => {
    if (newPassword.length < 8)
      throw new ConvexError("New password must be at least 8 characters");
    const email = await ctx.runQuery(internal.users.emailById, {
      id: ctx.userId,
    });
    if (!email) throw new ConvexError("Your account has no email");
    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: email, secret: currentPassword },
      });
    } catch {
      throw new ConvexError("Current password is incorrect");
    }
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: newPassword },
    });
  },
});

/**
 * Admin escape hatch for forgotten passwords (there is no email sender):
 *   npx convex run users:adminSetPassword '{"email":"a@b.com","password":"..."}'
 */
export const adminSetPassword = internalAction({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email.trim().toLowerCase(), secret: password },
    });
    return "ok";
  },
});

export const deleteAccount = authenticatedMutation({
  args: {},
  handler: async ctx => {
    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", q => q.eq("userId", ctx.userId))
      .collect();
    for (const account of authAccounts) {
      await ctx.db.delete(account._id);
    }

    const authSessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", q => q.eq("userId", ctx.userId))
      .collect();
    for (const session of authSessions) {
      await ctx.db.delete(session._id);
    }

    const reddit = await ctx.db
      .query("redditAccounts")
      .withIndex("by_user", q => q.eq("userId", ctx.userId))
      .collect();
    for (const r of reddit) await ctx.db.delete(r._id);

    await ctx.db.delete(ctx.userId);

    return { success: true };
  },
});
