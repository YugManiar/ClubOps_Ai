"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import type { MemberRole } from "@/types/database";

/**
 * Irreversible, so the button stays disabled until the person types their own
 * email. That guards against a stray click; it is not re-authentication. The
 * server checks the same thing and is the one that actually deletes.
 */
export function DeleteAccount({ email, role }: { email: string; role: MemberRole }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/me/delete", { confirm_email: typed.trim() });
      // The account no longer exists, so a server-side sign-out would fail;
      // clear the local session only.
      await createClient().auth.signOut({ scope: "local" }).catch(() => {});
      router.replace("/login?deleted=1");
      router.refresh();
    } catch (err) {
      // e.g. the 409 for a club's only leader arrives here with its explanation.
      setError(err instanceof Error ? err.message : "Could not delete your account.");
      setBusy(false);
    }
  }

  return (
    <Card className="border-destructive/30 bg-destructive/[0.03]">
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex items-center gap-2 font-semibold text-danger">
          <AlertTriangle className="h-4 w-4" /> Delete account
        </div>

        <div className="space-y-2 text-sm">
          <p>This permanently deletes your login and your profile. It cannot be undone.</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Tasks assigned to you stay on their events and become unassigned.</li>
            <li>Feedback written about you is deleted.</li>
            {role === "leader" && (
              <li>Feedback you wrote about others is kept, with your name removed.</li>
            )}
          </ul>
        </div>

        <label className="block space-y-1 text-sm font-medium">
          Type <span className="font-mono font-semibold">{email}</span> to confirm
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={email}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <Button
          onClick={remove}
          disabled={!matches || busy}
          variant="destructive"
        >
          {busy ? "Deleting..." : "Delete my account"}
        </Button>
      </CardContent>
    </Card>
  );
}
