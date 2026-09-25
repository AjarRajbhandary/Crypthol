declare const process: { env: Record<string, string | undefined> };

export const USER_AGENT = "web:pondros-signal:1.2 (by /u/pondros)";

/**
 * Structured-output call to an OpenAI-compatible chat completions API.
 * Configure on the Convex deployment:
 *   OPENAI_API_KEY      (required)
 *   OPENAI_MODEL        (optional, default gpt-4.1-mini — used for scoring)
 *   OPENAI_SMART_MODEL  (optional, defaults to OPENAI_MODEL — used for drafts)
 *   OPENAI_BASE_URL     (optional, for any OpenAI-compatible provider)
 */
export async function aiStructured<T>(opts: {
  prompt: string;
  input: string;
  schema: Record<string, unknown>;
  smart?: boolean;
}): Promise<T> {
  const key = process.env.OPENAI_API_KEY;
  if (!key)
    throw new Error(
      "OPENAI_API_KEY is not set on the Convex deployment (npx convex env set OPENAI_API_KEY ...)",
    );
  const base = (
    process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const fastModel = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const model = opts.smart
    ? (process.env.OPENAI_SMART_MODEL ?? fastModel)
    : fastModel;

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: opts.prompt },
        { role: "user", content: opts.input },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "result",
          schema: { ...opts.schema, additionalProperties: false },
          strict: false,
        },
      },
    }),
  });
  if (!res.ok)
    throw new Error(
      `OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content) as T;
}
