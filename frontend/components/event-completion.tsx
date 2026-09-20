"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import type { EventStatus } from "@/types/database";

/**
 * Leader-only: progress toward "every task done", and the button that completes
 * the event once it is.
 *
 * `done` / `total` are a live PREVIEW computed from the board the leader is
 * looking at, so the button lights up the moment they drag the last card. The
 * rule itself is enforced by POST /events/{id}/complete, which re-checks the
 * database and answers 409 if the board was stale. Show that message as-is.
 */
export function EventCompletion({
  eventId,
  status,
  done,
  total,
}: {
  eventId: string;
  status: EventStatus;
  done: number;
  total: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "cancelled") return null;

  if (status === "completed") {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-4 pt-4 text-sm">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="font-medium">This event is completed.</span>
          <span className="text-muted-foreground">
            {done} of {total} tasks done.
          </span>
        </CardContent>
      </Card>
    );
  }

  const allDone = total > 0 && done === total;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  async function complete() {
    if (!window.confirm("Mark this event as completed?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/events/${eventId}/complete`, {});
      router.refresh(); // header badge + this card re-render from the server
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete the event.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={allDone ? "border-success" : undefined}>
      <CardContent className="space-y-3 p-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="flex items-center gap-2 text-sm font-medium">
              {allDone && <PartyPopper className="h-4 w-4 text-success" />}
              {allDone
                ? "All tasks are done. Ready to wrap up?"
                : `${done} of ${total} tasks done`}
            </p>
            <p className="text-xs text-muted-foreground">
              {allDone
                ? `${total} of ${total} tasks done.`
                : total === 0
                  ? "Add or plan some tasks first."
                  : `Finish the remaining ${total - done} to complete this event.`}
            </p>
          </div>
          <Button onClick={complete} disabled={!allDone || busy}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {busy ? "Completing..." : "Mark event complete"}
          </Button>
        </div>
        <Progress value={percent} />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
