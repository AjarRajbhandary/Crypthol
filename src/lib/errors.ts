import { ConvexError } from "convex/values";

/** Human-readable message from a Convex call failure. */
export function errorMessage(e: unknown, fallback = "Something went wrong") {
  if (e instanceof ConvexError && typeof e.data === "string") return e.data;
  if (e instanceof Error) {
    // Server errors arrive as "[CONVEX ...] Uncaught Error: <message> at ..."
    const m = e.message.match(
      /Uncaught (?:Convex)?Error: (.*?)(?:\n|\s+at |$)/,
    );
    return m?.[1] ?? e.message ?? fallback;
  }
  return fallback;
}
