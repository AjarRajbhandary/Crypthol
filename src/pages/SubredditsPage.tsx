import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, NotebookPen, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type NotesTarget = { id: Id<"subreddits">; name: string; notes: string };

export function SubredditsPage() {
  const subs = useQuery(api.subreddits.list, {});
  const add = useMutation(api.subreddits.add);
  const update = useMutation(api.subreddits.update);
  const remove = useMutation(api.subreddits.remove);
  const seed = useMutation(api.subreddits.seedDefaults);

  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<NotesTarget | null>(null);
  // Separate from `editing` so the title survives the close animation.
  const [notesOpen, setNotesOpen] = useState(false);

  const activeCount = subs?.filter(s => s.active).length ?? 0;

  const submit = async () => {
    const names = input
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    try {
      const n = await add({ names });
      toast.success(
        n ? `Added ${n} subreddit${n === 1 ? "" : "s"}` : "Already watching",
      );
      setInput("");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Subreddits</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            The team's watchlist. Keyword sets scoped to{" "}
            <span className="font-medium">Watchlist</span> search every active
            subreddit here. Notes are shown to the AI when it drafts replies, so
            put community rules and tone there.
          </p>
        </div>
        {subs && subs.length === 0 ? (
          <Button
            variant="outline"
            onClick={async () => {
              const n = await seed({});
              toast.success(`Loaded ${n} Pondros subreddits`);
            }}
          >
            Load Pondros defaults
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-2 px-5 py-4">
          <Input
            placeholder="Add subreddits: agency, r/consulting, https://reddit.com/r/slack"
            className="min-w-64 flex-1"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") void submit();
            }}
          />
          <Button onClick={submit} disabled={!input.trim()}>
            <Plus className="size-4" />
            Add
          </Button>
        </CardContent>
      </Card>

      {subs === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : subs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
            No subreddits yet. Add some above or load the defaults.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {activeCount} of {subs.length} active
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {subs.map(s => (
              <Card
                key={s._id}
                className={`border-border/60 ${s.active ? "" : "opacity-60"}`}
              >
                <CardContent className="space-y-3 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={s.active}
                      onCheckedChange={v => update({ id: s._id, active: v })}
                      aria-label={`Watch r/${s.name}`}
                    />
                    <a
                      href={`https://www.reddit.com/r/${s.name}/new/`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate font-medium hover:underline"
                    >
                      r/{s.name}
                      <ArrowUpRight className="ml-0.5 inline size-3.5 text-muted-foreground" />
                    </a>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit notes"
                      onClick={() => {
                        setEditing({
                          id: s._id,
                          name: s.name,
                          notes: s.notes ?? "",
                        });
                        setNotesOpen(true);
                      }}
                    >
                      <NotebookPen className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove r/${s.name}`}
                      onClick={async () => {
                        await remove({ id: s._id });
                        toast.success(`Removed r/${s.name}`);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Badge variant="secondary">{s.stats.total} threads</Badge>
                    <Badge variant="outline">{s.stats.open} open</Badge>
                    <Badge variant="outline">
                      {s.stats.highIntent} high intent
                    </Badge>
                    <Badge variant="outline">{s.stats.replied} replied</Badge>
                  </div>
                  {s.notes ? (
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {s.notes}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {s.addedByName ? `Added by ${s.addedByName}` : "Default"}
                    </span>
                    {s.stats.total > 0 ? (
                      <Link
                        to={`/dashboard?subreddit=${encodeURIComponent(s.name)}`}
                        className="underline"
                      >
                        View threads
                      </Link>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes for r/{editing?.name}</DialogTitle>
            <DialogDescription>
              Community rules, self-promo policy, tone, mods to be careful with.
              AI drafts for this subreddit follow these notes.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-32"
            value={editing?.notes ?? ""}
            onChange={e =>
              setEditing(prev =>
                prev ? { ...prev, notes: e.target.value } : prev,
              )
            }
            placeholder="e.g. No links in top-level comments. Mods remove anything that reads like a vendor pitch."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNotesOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!editing) return;
                await update({ id: editing.id, notes: editing.notes.trim() });
                setNotesOpen(false);
                toast.success("Notes saved");
              }}
            >
              Save notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
