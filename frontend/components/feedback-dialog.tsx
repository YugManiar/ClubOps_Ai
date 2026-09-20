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
import type { SubmitFeedbackRequest, SubmitFeedbackResponse } from "@/types/database";

export function FeedbackDialog({ eventId, memberId }: { eventId: string; memberId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: SubmitFeedbackRequest = {
        event_id: eventId,
        member_id: memberId,
        rating,
        comment: comment.trim(),
      };
      const res = await api.post<SubmitFeedbackResponse>("/api/feedback/submit", body);

      if (!res.accepted) {
        // Gemini flagged the comment; keep the dialog open so they can rewrite it.
        setError(res.message ?? "Please make your feedback more constructive and try again.");
        return;
      }
      setOpen(false);
      setRating(0);
      setComment("");
      router.refresh(); // re-read events.average_rating from Supabase
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
          <MessageSquarePlus className="mr-2 h-4 w-4" /> Give feedback
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Rate this event</DialogTitle>
            <DialogDescription>
              Your comment is checked by AI to keep feedback constructive before it is saved.
            </DialogDescription>
          </DialogHeader>
          <StarInput value={rating} onChange={setRating} />
          <Textarea
            placeholder="What worked, and what should we improve?"
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
            <Button type="submit" disabled={busy || rating === 0}>
              {busy ? "Checking..." : "Submit feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
