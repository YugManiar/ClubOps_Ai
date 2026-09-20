"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { PlanAccepted, PlanEventRequest, PlanJob } from "@/types/database";

/** Planning is queued server-side, so the browser polls instead of holding a
 *  request open past every proxy's timeout. */
const POLL_MS = 2000;
const POLL_CEILING = 90; // 90 * 2s = 3 minutes, then we stop and tell the user

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function CreateEventDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling must stop if the component goes away mid-plan.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // No club_id: the backend takes it from the token.
      const body: PlanEventRequest = {
        prompt: prompt.trim(),
        ...(startTime && { start_time: new Date(startTime).toISOString() }),
        ...(location.trim() && { location: location.trim() }),
      };
      const { job_id } = await api.post<PlanAccepted>("/api/events/plan", body);

      for (let i = 0; i < POLL_CEILING; i++) {
        await sleep(POLL_MS);
        if (!alive.current) return;
        const job = await api.get<PlanJob>(`/api/events/plan/${job_id}`);
        if (job.status === "done" && job.event_id) {
          setOpen(false);
          router.push(`/events/${job.event_id}`);
          router.refresh();
          return;
        }
        if (job.status === "failed") {
          setError(job.error ?? "Planning failed. Please try again.");
          return;
        }
      }
      // The job may still land; don't imply it was lost.
      setError("Still planning. Check your dashboard in a minute.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Create event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Create event</DialogTitle>
            <DialogDescription>
              Describe the event. The AI drafts the plan and a task list for you.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-1 text-sm font-medium">
            What are you planning?
            <Textarea
              required
              minLength={3}
              maxLength={5000}
              className="min-h-28 font-normal"
              placeholder="A 24-hour hackathon for 150 first-years with sponsor workshops..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              Start (optional)
              <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Location (optional)
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lab 204" />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy || prompt.trim().length < 3}>
              {busy ? "Planning... (can take ~30s)" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
