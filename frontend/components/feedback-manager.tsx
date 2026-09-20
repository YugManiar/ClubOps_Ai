"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { FeedbackDialog } from "@/components/feedback-dialog";
import { StarDisplay } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/ui-meta";
import type { ClubEvent, Feedback, Member } from "@/types/database";

/** Leader-only "Manage Feedback" section: everything given so far, plus give / delete. */
export function FeedbackManager({
  feedback,
  events,
  members,
}: {
  feedback: Feedback[];
  events: ClubEvent[];
  members: Member[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const eventName = (id: string) => events.find((e) => e.id === id)?.name ?? "Unknown event";
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.full_name;

  async function remove(id: string) {
    if (!window.confirm("Delete this feedback? Ratings are recalculated.")) return;
    setDeleting(id);
    setError(null);
    try {
      await api.delete(`/api/feedback/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Manage feedback</h2>
        <FeedbackDialog events={events} members={members.filter((m) => m.role === "member")} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {feedback.length === 0 ? (
        <Card>
          <CardContent className="p-8 pt-8 text-center text-sm text-muted-foreground">
            No feedback yet.
          </CardContent>
        </Card>
      ) : (
        feedback.map((f) => (
          <Card key={f.id}>
            <CardContent className="flex items-start gap-3 p-4 pt-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <StarDisplay value={f.rating} />
                  <span className="font-medium">
                    {f.subject_member_id ? `About ${memberName(f.subject_member_id) ?? "a member"}` : "About the event"}
                  </span>
                  <span className="text-muted-foreground">
                    · {eventName(f.event_id)} · by {memberName(f.member_id) ?? "Anonymous"} · {formatDate(f.created_at)}
                  </span>
                </div>
                {(f.validated_comment ?? f.raw_comment) && (
                  <p className="text-sm text-muted-foreground">{f.validated_comment ?? f.raw_comment}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Delete feedback"
                disabled={deleting === f.id}
                onClick={() => remove(f.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </section>
  );
}
