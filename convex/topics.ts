import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { authenticatedMutation, authenticatedQuery } from "./functions";
import { normalizeSubreddit, seedDefaultSubreddits } from "./subreddits";

const scopeValidator = v.union(
  v.literal("watchlist"),
  v.literal("custom"),
  v.literal("all"),
);

export const list = authenticatedQuery({
  args: {},
  handler: async ctx =>
    (await ctx.db.query("queries").collect()).map(q => ({
      ...q,
      scope: q.scope ?? (q.subreddits.length > 0 ? "custom" : "all"),
    })),
});

function cleanArgs(args: {
  label: string;
  term: string;
  scope: "watchlist" | "custom" | "all";
  subreddits: string[];
}) {
  const label = args.label.trim();
  const term = args.term.trim();
  if (!label || !term)
    throw new ConvexError("Label and search term are required");
  const subreddits =
    args.scope === "custom"
      ? args.subreddits.map(normalizeSubreddit).filter(Boolean)
      : [];
  if (args.scope === "custom" && subreddits.length === 0)
    throw new ConvexError("Pick at least one subreddit for a custom scope");
  return { label, term, scope: args.scope, subreddits };
}

export const add = authenticatedMutation({
  args: {
    label: v.string(),
    term: v.string(),
    scope: scopeValidator,
    subreddits: v.array(v.string()),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert("queries", { ...cleanArgs(args), active: true }),
});

export const update = authenticatedMutation({
  args: {
    id: v.id("queries"),
    label: v.string(),
    term: v.string(),
    scope: scopeValidator,
    subreddits: v.array(v.string()),
  },
  handler: async (ctx, { id, ...args }) =>
    await ctx.db.patch(id, cleanArgs(args)),
});

export const toggle = authenticatedMutation({
  args: { id: v.id("queries"), active: v.boolean() },
  handler: async (ctx, { id, active }) => await ctx.db.patch(id, { active }),
});

export const remove = authenticatedMutation({
  args: { id: v.id("queries") },
  handler: async (ctx, { id }) => await ctx.db.delete(id),
});

type Default = {
  label: string;
  term: string;
  scope: "watchlist" | "all";
};

const DEFAULTS: Default[] = [
  {
    label: "Project management in Slack",
    term: '"slack" ("project management" OR "project management tool" OR "project management software" OR "project manager")',
    scope: "watchlist",
  },
  {
    label: "Task management in Slack",
    term: 'slack ("task management" OR "task tracking" OR "task manager" OR "track tasks")',
    scope: "watchlist",
  },
  {
    label: "Reminders / nudges in Slack",
    term: 'slack (reminder OR slackbot OR "recurring reminder" OR "reminder bot")',
    scope: "watchlist",
  },
  {
    label: "Accountability & follow-through",
    term: '"team accountability" OR "follow up on tasks" OR "chasing my team" OR "follow-through"',
    scope: "watchlist",
  },
  {
    label: "Action items from meetings",
    term: '"action items" (meeting OR notes) (track OR "not getting done" OR missed)',
    scope: "watchlist",
  },
  {
    label: "Things falling through the cracks",
    term: '"falling through the cracks" OR "tasks getting lost" OR "messages getting lost" OR "missed deadlines"',
    scope: "watchlist",
  },
  {
    label: "Best PM tool recommendations",
    term: '"best project management" (tool OR software OR app) recommendation',
    scope: "watchlist",
  },
  {
    label: "Competitors (Chaser / Viktor / bots)",
    term: '"chaser" slack OR "viktor" slack bot OR "slack accountability bot"',
    scope: "all",
  },
  {
    label: "Agency / client deliverable tracking",
    term: '"client deliverables" OR "client tasks" (track OR accountability OR agency)',
    scope: "watchlist",
  },
  {
    label: "Site-wide: keeping track in Slack",
    term: 'slack "keep track" (tasks OR deadlines OR "follow ups" OR commitments)',
    scope: "all",
  },
];

async function seedDefaultQueries(ctx: MutationCtx) {
  await seedDefaultSubreddits(ctx);
  const existing = await ctx.db.query("queries").first();
  if (existing) return 0;
  for (const d of DEFAULTS)
    await ctx.db.insert("queries", { ...d, subreddits: [], active: true });
  return DEFAULTS.length;
}

export const seedIfEmpty = authenticatedMutation({
  args: {},
  handler: async ctx => await seedDefaultQueries(ctx),
});

// ---- demo data so the UI is reviewable before Reddit credentials exist ----
const SAMPLES = [
  {
    redditId: "sample1",
    subreddit: "agency",
    title:
      "Anyone have a good system for making sure follow-ups actually happen after client calls?",
    body: "We live in Slack but stuff still falls through the cracks. Notes get written, action items get agreed, and then nobody checks whether they happened until the client asks.",
    author: "sample_user",
    intent: 5,
    intentReason:
      "Explicitly asking for a system to enforce post-call follow-ups.",
    theme: "Action items / follow-through",
    angle:
      "Treat every commitment as a task with an owner, and review what is still open once a week as a team.",
    icpFit: true,
    painMatch: true,
    communityOk: true,
    matchedLabel: "Action items from meetings",
  },
  {
    redditId: "sample2",
    subreddit: "projectmanagement",
    title: "Is Slack enough for project management for a team of 12?",
    body: "We keep hearing we should add Asana or ClickUp but nobody opens them. Curious what small teams actually do.",
    author: "sample_user2",
    intent: 4,
    intentReason:
      "Evaluating whether Slack alone can carry PM for a small team.",
    theme: "Slack PM",
    angle:
      "The chat tool is fine; the gap is that nothing enforces the follow-through once the conversation scrolls away.",
    icpFit: true,
    painMatch: true,
    communityOk: true,
    matchedLabel: "Project management in Slack",
  },
  {
    redditId: "sample3",
    subreddit: "ITManagers",
    title: "Best enterprise PPM suite for 4,000 seats with SOC 2 and SSO?",
    body: "Evaluating Planview vs Clarity for a regulated environment.",
    author: "sample_user3",
    intent: 2,
    intentReason: "Enterprise PPM procurement, far outside the wedge.",
    theme: "Tool evaluation",
    angle: "Not a fit — log and move on.",
    icpFit: false,
    painMatch: false,
    communityOk: true,
    matchedLabel: "Best PM tool recommendations",
  },
];

export const seedSamples = authenticatedMutation({
  args: {},
  handler: async ctx => {
    let n = 0;
    for (const s of SAMPLES) {
      const existing = await ctx.db
        .query("hits")
        .withIndex("by_redditId", q => q.eq("redditId", s.redditId))
        .first();
      if (existing) continue;
      await ctx.db.insert("hits", {
        ...s,
        kind: "post",
        url: `https://www.reddit.com/r/${s.subreddit}/`,
        permalink: `https://www.reddit.com/r/${s.subreddit}/`,
        createdUtc: Date.now() - n * 36e5 - 72e5,
        score: 14 - n * 3,
        numComments: 6 - n,
        status: "new",
        scoredAt: Date.now(),
        isSample: true,
        ingestedAt: Date.now(),
      });
      n += 1;
    }
    return n;
  },
});

export const clearSamples = authenticatedMutation({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query("hits").collect();
    let n = 0;
    for (const r of rows)
      if (r.isSample) {
        await ctx.db.delete(r._id);
        n += 1;
      }
    return n;
  },
});
