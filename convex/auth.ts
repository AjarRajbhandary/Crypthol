import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { query } from "./_generated/server";

declare const process: { env: Record<string, string | undefined> };

/**
 * Comma-separated list of email domains allowed to sign up / sign in,
 * e.g. "pondros.com,herd-group.com". Leave unset to allow any email
 * (only do that for local development).
 */
function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map(d => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "")
          .trim()
          .toLowerCase();
        const domains = allowedDomains();
        const domain = email.split("@")[1] ?? "";
        if (domains.length > 0 && !domains.includes(domain)) {
          throw new ConvexError(
            `Only ${domains.map(d => `@${d}`).join(", ")} emails can use this app.`,
          );
        }
        const name = params.name ? String(params.name).trim() : undefined;
        return { email, ...(name ? { name } : {}) };
      },
    }),
  ],
});

export const currentUser = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
