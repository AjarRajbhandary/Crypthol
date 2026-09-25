import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("reddit ingest", { hours: 6 }, internal.reddit.ingest, {});

export default crons;
