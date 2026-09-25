import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "@/lib/errors";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type Scope = "watchlist" | "custom" | "all";

type FormState = {
  id?: Id<"queries">;
  label: string;
  term: string;
  scope: Scope;
  subs: string;
};

const EMPTY: FormState = { label: "", term: "", scope: "watchlist", subs: "" };

const SCOPE_LABELS: Record<Scope, string> = {
  watchlist: "Watchlist subreddits",
  custom: "Specific subreddits",
  all: "All of Reddit",
};

export function KeywordsPage() {
  const topics = useQuery(api.topics.list, {});
  const watchlist = useQuery(api.subreddits.list, {});
  const add = useMutation(api.topics.add);
  const update = useMutation(api.topics.update);
  const toggle = useMutation(api.topics.toggle);
  const remove = useMutation(api.topics.remove);
  const seed = useMutation(api.topics.seedIfEmpty);

  const [form, setForm] = useState<FormState>(EMPTY);
  const activeWatch = watchlist?.filter(s => s.active).length ?? 0;

  const submit = async () => {
    const payload = {
      label: form.label,
      term: form.term,
      scope: form.scope,
      subreddits: form.subs.split(/[\s,]+/).filter(Boolean),
    };
    try {
      if (form.id) {
        await update({ id: form.id, ...payload });
        toast.success("Keyword set updated");
      } else {
        await add(payload);
        toast.success("Keyword set added");
      }
      setForm(EMPTY);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Keyword sets</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Each set is a Reddit search that runs every 6 hours (or when anyone
            hits Pull now). Supports quotes, OR and parentheses.
          </p>
        </div>
        {topics && topics.length === 0 ? (
          <Button
            variant="outline"
            onClick={async () => {
              const n = await seed({});
              toast.success(n ? `Seeded ${n} sets` : "Already seeded");
            }}
          >
            Load Pondros defaults
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Label"
              className="w-48"
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
            />
            <Input
              placeholder='Search term e.g. slack "task tracking"'
              className="min-w-64 flex-1"
              value={form.term}
              onChange={e => setForm({ ...form, term: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={form.scope}
              onValueChange={v => setForm({ ...form, scope: v as Scope })}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="watchlist">
                  Watchlist ({activeWatch} subreddits)
                </SelectItem>
                <SelectItem value="custom">Specific subreddits</SelectItem>
                <SelectItem value="all">All of Reddit</SelectItem>
              </SelectContent>
            </Select>
            {form.scope === "custom" ? (
              <Input
                placeholder="Subreddits, comma separated"
                className="min-w-64 flex-1"
                value={form.subs}
                onChange={e => setForm({ ...form, subs: e.target.value })}
              />
            ) : (
              <div className="flex-1" />
            )}
            {form.id ? (
              <Button variant="ghost" onClick={() => setForm(EMPTY)}>
                Cancel
              </Button>
            ) : null}
            <Button onClick={submit}>
              {form.id ? (
                "Save changes"
              ) : (
                <>
                  <Plus className="size-4" />
                  Add
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(topics ?? []).map(t => (
          <Card key={t._id} className="border-border/60">
            <CardContent className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Switch
                checked={t.active}
                onCheckedChange={v => toggle({ id: t._id, active: v })}
                aria-label={`Run ${t.label}`}
              />
              <div className="min-w-64 flex-1">
                <p className="font-medium">{t.label}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {t.term}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {t.scope === "custom" ? (
                    t.subreddits.map(s => (
                      <Badge key={s} variant="outline">
                        r/{s}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">{SCOPE_LABELS[t.scope]}</Badge>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {t.lastHitCount ?? 0} hits last pull
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Edit"
                onClick={() =>
                  setForm({
                    id: t._id,
                    label: t.label,
                    term: t.term,
                    scope: t.scope,
                    subs: t.subreddits.join(", "),
                  })
                }
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete"
                onClick={() => remove({ id: t._id })}
              >
                <Trash2 className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
