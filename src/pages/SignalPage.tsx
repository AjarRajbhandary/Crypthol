import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  Check,
  CheckCheck,
  Copy,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type Hit = {
  _id: Id<"hits">;
  redditId: string;
  subreddit: string;
  title: string;
  body: string;
  author: string;
  permalink: string;
  createdUtc: number;
  score: number;
  numComments: number;
  matchedLabel?: string;
  intent?: number;
  intentReason?: string;
  theme?: string;
  angle?: string;
  icpFit?: boolean;
  painMatch?: boolean;
  communityOk?: boolean;
  isSample?: boolean;
  scoredAt?: number;
  status: string;
  draft?: string;
  replyUrl?: string;
  assignedTo?: Id<"users">;
  assignedToName?: string;
  repliedByName?: string;
  draftedByName?: string;
  repliedAt?: number;
};

type Teammate = { _id: Id<"users">; name: string; email: string };

const INTENT_STYLES: Record<number, string> = {
  5: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  4: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  3: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
};

function timeAgo(ms: number) {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-border/60">
      <CardContent className="px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function HitCard({ hit, team }: { hit: Hit; team: Teammate[] }) {
  const [draft, setDraft] = useState(hit.draft ?? "");
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [replyUrl, setReplyUrl] = useState("");

  const generateDraft = useAction(api.hits.generateDraft);
  const postReply = useAction(api.reddit.postReply);
  const saveDraft = useMutation(api.hits.saveDraft);
  const setStatus = useMutation(api.hits.setStatus);
  const assign = useMutation(api.hits.assign);
  const markReplied = useMutation(api.hits.markRepliedManually);

  useEffect(() => {
    setDraft(hit.draft ?? "");
  }, [hit.draft]);

  const intent = hit.intent ?? 0;

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge
            variant="outline"
            className={INTENT_STYLES[intent] ?? "text-muted-foreground"}
          >
            Intent {intent || "–"}
          </Badge>
          <span className="font-medium text-foreground">r/{hit.subreddit}</span>
          <span>u/{hit.author}</span>
          <span>{timeAgo(hit.createdUtc)}</span>
          <span>▲ {hit.score}</span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3" /> {hit.numComments}
          </span>
          {hit.theme ? <Badge variant="secondary">{hit.theme}</Badge> : null}
          {hit.isSample ? <Badge variant="outline">sample</Badge> : null}
          {hit.status === "replied" ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              replied{hit.repliedByName ? ` by ${hit.repliedByName}` : ""}
            </Badge>
          ) : null}
          {hit.status === "ignored" ? (
            <Badge variant="outline">ignored</Badge>
          ) : null}
          <div className="ml-auto">
            <Select
              value={hit.assignedTo ?? "none"}
              onValueChange={v =>
                assign({
                  id: hit._id,
                  userId: v === "none" ? undefined : (v as Id<"users">),
                })
              }
            >
              <SelectTrigger size="sm" className="h-7 w-40 text-xs">
                <UserRound className="size-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {team.map(t => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <a
            href={hit.permalink}
            target="_blank"
            rel="noreferrer"
            className="text-base font-semibold leading-snug hover:underline"
          >
            {hit.title}
          </a>
          {hit.body ? (
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
              {hit.body}
            </p>
          ) : null}
        </div>

        {hit.scoredAt !== undefined || hit.icpFit !== undefined ? (
          <div className="flex flex-wrap gap-3 text-xs">
            {[
              { ok: hit.icpFit, label: "ICP fit (10–50, client-facing)" },
              { ok: hit.painMatch, label: "Pain matches the wedge" },
              { ok: hit.communityOk, label: "Community allows this" },
            ].map(c => (
              <span
                key={c.label}
                className={`inline-flex items-center gap-1 ${c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
              >
                {c.ok ? (
                  <Check className="size-3.5" />
                ) : (
                  <X className="size-3.5" />
                )}
                {c.label}
              </span>
            ))}
            <span className="font-medium">
              {hit.icpFit && hit.painMatch && hit.communityOk
                ? "→ Respond — helpful, no pitch"
                : "→ Log & monitor"}
            </span>
          </div>
        ) : null}

        {hit.angle ? (
          <p className="rounded-md border border-dashed border-border/70 bg-muted/40 px-3 py-2 text-sm">
            <span className="font-medium">Angle: </span>
            {hit.angle}
          </p>
        ) : null}

        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="No draft yet — generate one, then edit it in your own voice."
            className="min-h-24 text-sm"
          />
          {hit.draftedByName && hit.draft ? (
            <p className="text-xs text-muted-foreground">
              Last draft by {hit.draftedByName}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={generating}
              onClick={async () => {
                setGenerating(true);
                try {
                  const reply = await generateDraft({ id: hit._id });
                  setDraft(reply);
                } catch (e) {
                  toast.error(`Draft failed: ${errorMessage(e)}`);
                } finally {
                  setGenerating(false);
                }
              }}
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {hit.draft ? "Regenerate" : "AI draft"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await saveDraft({ id: hit._id, draft });
                toast.success("Draft saved");
              }}
            >
              Save edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(draft);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              Copy
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={hit.permalink} target="_blank" rel="noreferrer">
                <ArrowUpRight className="size-4" />
                Open thread
              </a>
            </Button>
            <Button
              size="sm"
              disabled={posting || !draft.trim()}
              onClick={async () => {
                setPosting(true);
                try {
                  await saveDraft({ id: hit._id, draft });
                  const res = await postReply({ hitId: hit._id });
                  if (res.ok) toast.success(res.message);
                  else toast.error(res.message);
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setPosting(false);
                }
              }}
            >
              {posting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Post as me
            </Button>
            {hit.status !== "replied" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setReplyUrl("");
                  setMarkOpen(true);
                }}
              >
                <CheckCheck className="size-4" />
                Mark replied
              </Button>
            ) : null}
            {hit.status === "ignored" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setStatus({
                    id: hit._id,
                    status: hit.draft ? "drafted" : "new",
                  })
                }
              >
                <Undo2 className="size-4" />
                Restore
              </Button>
            ) : hit.status !== "replied" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStatus({ id: hit._id, status: "ignored" })}
              >
                <X className="size-4" />
                Ignore
              </Button>
            ) : null}
            {hit.status === "replied" && hit.replyUrl ? (
              <a
                className="self-center text-xs underline text-muted-foreground"
                href={hit.replyUrl}
                target="_blank"
                rel="noreferrer"
              >
                view my reply
              </a>
            ) : null}
          </div>
        </div>
      </CardContent>

      <Dialog open={markOpen} onOpenChange={setMarkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as replied</DialogTitle>
            <DialogDescription>
              For replies you posted on Reddit yourself. Paste the link to your
              comment so the team can find it (optional).
            </DialogDescription>
          </DialogHeader>
          <Input
            value={replyUrl}
            onChange={e => setReplyUrl(e.target.value)}
            placeholder="https://www.reddit.com/r/.../comment/..."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMarkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (draft !== (hit.draft ?? ""))
                  await saveDraft({ id: hit._id, draft });
                await markReplied({ id: hit._id, replyUrl });
                setMarkOpen(false);
                toast.success("Marked as replied");
              }}
            >
              Mark replied
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function SignalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatusFilter] = useState("open");
  const [minIntent, setMinIntent] = useState("3");
  const [assignee, setAssignee] = useState("all");
  const [running, setRunning] = useState(false);
  const subreddit = searchParams.get("subreddit") ?? "all";
  const setSubreddit = (v: string) =>
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (v === "all") next.delete("subreddit");
        else next.set("subreddit", v);
        return next;
      },
      { replace: true },
    );

  const stats = useQuery(api.hits.stats, {});
  const team = useQuery(api.users.list, {}) ?? [];
  const hits = useQuery(api.hits.list, {
    status,
    minIntent: Number(minIntent),
    subreddit,
    assignee,
  }) as Hit[] | undefined;
  const clearSamples = useMutation(api.topics.clearSamples);
  const runIngest = useAction(api.reddit.runIngestNow);
  const settings = useQuery(api.settings.status, {});
  const seedSamples = useMutation(api.topics.seedSamples);
  const seedTopics = useMutation(api.topics.seedIfEmpty);

  const subreddits = useMemo(() => {
    const list = stats?.subreddits ?? [];
    return subreddit !== "all" && !list.includes(subreddit)
      ? [...list, subreddit]
      : list;
  }, [stats, subreddit]);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Signal</h1>
          <p className="text-sm text-muted-foreground">
            Reddit conversations about Slack, project management and
            follow-through — scored, drafted, ready to answer.
          </p>
        </div>
        <div className="flex gap-2">
          {stats && stats.total === 0 ? (
            <Button
              variant="outline"
              onClick={async () => {
                await seedTopics({});
                const n = await seedSamples({});
                toast.success(
                  n ? `Loaded ${n} sample threads` : "Samples already loaded",
                );
              }}
            >
              Load samples
            </Button>
          ) : null}
          {stats && stats.samples > 0 ? (
            <Button
              variant="outline"
              onClick={async () => {
                const n = await clearSamples({});
                toast.success(`Removed ${n} sample threads`);
              }}
            >
              Clear samples
            </Button>
          ) : null}
          <Button
            disabled={running}
            onClick={async () => {
              setRunning(true);
              try {
                const r = await runIngest({});
                toast.success(
                  `${r.newHits} new threads from ${r.queriesRun} keyword sets (${r.scored} scored)`,
                );
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setRunning(false);
              }
            }}
          >
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Pull now
          </Button>
        </div>
      </div>

      {settings && !settings.configured ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="px-5 py-4 text-sm">
            <span className="font-medium">Reddit not connected yet.</span> Add
            the team's Reddit app credentials on the{" "}
            <Link to="/connections" className="underline">
              Connections
            </Link>{" "}
            page to start pulling threads.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <StatCard label="Tracked threads" value={stats?.total ?? "–"} />
        <StatCard label="High intent (4–5)" value={stats?.highIntent ?? "–"} />
        <StatCard label="New this week" value={stats?.newThisWeek ?? "–"} />
        <StatCard label="Replied" value={stats?.replied ?? "–"} />
        <StatCard label="Open & mine" value={stats?.assignedToMe ?? "–"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open (new + drafted)</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="drafted">Drafted</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
          </SelectContent>
        </Select>
        <Select value={minIntent} onValueChange={setMinIntent}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any intent</SelectItem>
            <SelectItem value="3">Intent 3+</SelectItem>
            <SelectItem value="4">Intent 4+ (worth replying)</SelectItem>
            <SelectItem value="5">Intent 5 only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={subreddit} onValueChange={setSubreddit}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subreddits</SelectItem>
            {subreddits.map(s => (
              <SelectItem key={s} value={s}>
                r/{s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {team.map(t => (
              <SelectItem key={t._id} value={t._id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {stats?.lastRunAt ? (
          <span className="self-center text-xs text-muted-foreground">
            last pull {timeAgo(stats.lastRunAt)}
            {stats.lastRunOk === false ? (
              <span
                className="text-destructive"
                title={stats.lastRunError ?? ""}
              >
                {" "}
                — failed
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      {hits === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : hits.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nothing here yet. Hit <span className="font-medium">Pull now</span>{" "}
            or loosen the filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {hits.map(hit => (
            <HitCard key={hit._id} hit={hit} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}
