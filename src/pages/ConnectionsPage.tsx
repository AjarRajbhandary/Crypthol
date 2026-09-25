import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/errors";
import { api } from "../../convex/_generated/api";

export function ConnectionsPage() {
  const status = useQuery(api.settings.status, {});
  const save = useMutation(api.settings.save);
  const clear = useMutation(api.settings.clear);
  const saveMine = useMutation(api.settings.saveMyReddit);
  const clearMine = useMutation(api.settings.clearMyReddit);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="max-w-3xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Signal reads Reddit through one shared app credential. Each teammate
          can add their own Reddit login to post replies from here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Team Reddit app
            {status?.configured ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                connected
              </Badge>
            ) : (
              <Badge variant="outline">not connected</Badge>
            )}
          </CardTitle>
          <CardDescription>
            One person creates a <span className="font-medium">script</span> app
            at{" "}
            <a
              className="underline"
              href="https://www.reddit.com/prefs/apps"
              target="_blank"
              rel="noreferrer"
            >
              reddit.com/prefs/apps
            </a>{" "}
            (redirect URI <code className="text-xs">http://localhost:8080</code>
            ), then adds each teammate's Reddit username under{" "}
            <span className="font-medium">developers</span> so they can post.
            The client ID + secret below are shared by the whole team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="client-id">Client ID</Label>
              <Input
                id="client-id"
                value={clientId}
                placeholder={status?.clientIdHint ?? ""}
                onChange={e => setClientId(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="client-secret">Client secret</Label>
              <Input
                id="client-secret"
                type="password"
                value={clientSecret}
                onChange={e => setClientSecret(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                try {
                  await save({ clientId, clientSecret });
                  setClientId("");
                  setClientSecret("");
                  toast.success("Saved. Try Pull now on the Signal page.");
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Save app credentials
            </Button>
            {status?.configured ? (
              <Button variant="ghost" onClick={() => clear({})}>
                Disconnect
              </Button>
            ) : null}
          </div>
          {status?.updatedAt ? (
            <p className="text-xs text-muted-foreground">
              Last updated {new Date(status.updatedAt).toLocaleString()}
              {status.updatedByName ? ` by ${status.updatedByName}` : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Your Reddit account
            {status?.canPost ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                u/{status.myUsername}
              </Badge>
            ) : (
              <Badge variant="outline">not set</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Optional. Enables "Post as me" on the Signal page; replies go out
            from this account only when you click. Accounts with two-factor auth
            need <code className="text-xs">password:123456</code> (your current
            2FA code), so for those it's easier to Copy, reply on Reddit, then
            Mark replied.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="reddit-username">Reddit username</Label>
              <Input
                id="reddit-username"
                value={username}
                placeholder={status?.myUsername ?? ""}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reddit-password">Reddit password</Label>
              <Input
                id="reddit-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                try {
                  await saveMine({ username, password });
                  setUsername("");
                  setPassword("");
                  toast.success("Saved your Reddit login");
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Save my login
            </Button>
            {status?.canPost ? (
              <Button variant="ghost" onClick={() => clearMine({})}>
                Remove
              </Button>
            ) : null}
          </div>
          {status && status.team.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
              <span className="text-muted-foreground">Can post:</span>
              {status.team.map(t => (
                <Badge key={t.username} variant="outline">
                  {t.name} · u/{t.username}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
