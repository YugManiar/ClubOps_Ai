"use client";

import { useState } from "react";
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
import { DEMO_CLUB_ID } from "@/lib/config";
import type { PlanEventRequest, PlanEventResponse } from "@/types/database";

export function CreateEventDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: PlanEventRequest = {
        club_id: DEMO_CLUB_ID,
        prompt: prompt.trim(),
        ...(startTime && { start_time: new Date(startTime).toISOString() }),
        ...(location.trim() && { location: location.trim() }),
      };
      const { event } = await api.post<PlanEventResponse>("/api/events/plan", body);
      setOpen(false);
      router.push(`/events/${event.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
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
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy || prompt.trim().length < 3}>
              {busy ? "Planning... (can take ~20s)" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
