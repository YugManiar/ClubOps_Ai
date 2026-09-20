"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";

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
import { Textarea } from "@/components/ui/input";
import { StarInput } from "@/components/star-rating";
import { api } from "@/lib/api";
import type { Member, SubmitFeedbackRequest, SubmitFeedbackResponse } from "@/types/database";

const selectClass =
  "flex h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary";

interface Props {
  events: { id: string; name: string }[];
  /** People who can be rated (the dialog offers "the event itself" as well). */
  members: Member[];
  defaultEventId?: string;
  label?: string;
}

/** Leader-only: rate an event or a member. The backend also enforces this (403 for members). */
export function FeedbackDialog({ events, members, defaultEventId, label = "Give feedback" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState(defaultEventId ?? events[0]?.id ?? "");
  const [subject, setSubject] = useState(""); // "" = the event itself
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: SubmitFeedbackRequest & { comment: string } = {
        event_id: eventId,
        subject_member_id: subject || null,
        rating,
        comment: comment.trim(),
      };
      const res = await api.post<SubmitFeedbackResponse>("/api/feedback/submit", body);

      if (!res.accepted) {
        // Gemini flagged the comment; keep the dialog open so it can be rewritten.
        setError(res.message ?? "Please make your feedback more constructive and try again.");
        return;
      }
      setOpen(false);
      setRating(0);
      setComment("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessageSquarePlus className="mr-2 h-4 w-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Give feedback</DialogTitle>
            <DialogDescription>
              Comments are checked by AI to keep feedback constructive before they are saved.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              Event
              <select className={selectClass} value={eventId} onChange={(e) => setEventId(e.target.value)}>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              About
              <select className={selectClass} value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">The event itself</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <StarInput value={rating} onChange={setRating} />
          <Textarea
            placeholder="What worked, and what should improve?"
            value={comment}
            maxLength={2000}
            onChange={(e) => setComment(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy || rating === 0 || !eventId}>
              {busy ? "Checking..." : "Submit feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
