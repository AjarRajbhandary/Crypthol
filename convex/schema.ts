import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,

  // Team-managed watchlist of subreddits. Keyword sets scoped to
  // "watchlist" search every active subreddit in this table.
  subreddits: defineTable({
    name: v.string(), // without the r/ prefix
    notes: v.optional(v.string()), // community rules, tone, etc.
    active: v.boolean(),
    addedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_name", ["name"]),

  // Keyword / query definitions used when polling Reddit
  queries: defineTable({
    label: v.string(),
    term: v.string(), // reddit search query string
    // watchlist = every active subreddit on the Subreddits page
    // custom    = only the subreddits listed below
    // all       = site-wide
    scope: v.optional(
      v.union(v.literal("watchlist"), v.literal("custom"), v.literal("all")),
    ),
    subreddits: v.array(v.string()),
    active: v.boolean(),
    lastRunAt: v.optional(v.number()),
    lastHitCount: v.optional(v.number()),
  }).index("by_active", ["active"]),

  // Reddit posts that matched
  hits: defineTable({
    redditId: v.string(),
    kind: v.string(), // "post"
    subreddit: v.string(),
    title: v.string(),
    body: v.string(),
    author: v.string(),
    url: v.string(),
    permalink: v.string(),
    createdUtc: v.number(),
    score: v.number(),
    numComments: v.number(),
    matchedQueryId: v.optional(v.id("queries")),
    matchedLabel: v.optional(v.string()),
    // scoring
    intent: v.optional(v.number()), // 1-5
    intentReason: v.optional(v.string()),
    theme: v.optional(v.string()),
    angle: v.optional(v.string()),
    icpFit: v.optional(v.boolean()),
    painMatch: v.optional(v.boolean()),
    communityOk: v.optional(v.boolean()),
    isSample: v.optional(v.boolean()),
    scoredAt: v.optional(v.number()),
    // workflow
    status: v.string(), // new | drafted | replied | ignored
    assignedTo: v.optional(v.id("users")),
    draft: v.optional(v.string()),
    draftUpdatedAt: v.optional(v.number()),
    draftedBy: v.optional(v.id("users")),
    repliedAt: v.optional(v.number()),
    repliedBy: v.optional(v.id("users")),
    replyUrl: v.optional(v.string()),
    ingestedAt: v.number(),
  })
    .index("by_redditId", ["redditId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdUtc"]),

  // Shared Reddit "script" app credential used for listening.
  credentials: defineTable({
    clientId: v.string(),
    clientSecret: v.string(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }),

  // Each teammate's own Reddit login, used only for "Post as me".
  redditAccounts: defineTable({
    userId: v.id("users"),
    username: v.string(),
    password: v.string(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  runs: defineTable({
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    queriesRun: v.number(),
    newHits: v.number(),
    scored: v.number(),
    ok: v.boolean(),
    error: v.optional(v.string()),
  }).index("by_started", ["startedAt"]),
});

export default schema;
