import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";

import { AgentCommandBar } from "@/components/agent-command-bar";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { StarDisplay } from "@/components/star-rating";
import { TaskBoard } from "@/components/task-board";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentMember, getEventDetail } from "@/lib/data";
import { EVENT_STATUS, formatDate } from "@/lib/ui-meta";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const me = await getCurrentMember();
  const detail = await getEventDetail(params.id);
  if (!me || !detail) notFound();
  const isLeader = me.role === "leader";
  const { event, tasks, feedback, members } = detail;

  const status = EVENT_STATUS[event.status];
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.full_name ?? "a member";

  return (
    <main className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> {formatDate(event.start_time)}
          </span>
          {event.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {event.location}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {event.rating_count > 0 ? (
            <span className="flex items-center gap-2 text-sm">
              <StarDisplay value={event.average_rating} />
              <span className="font-medium">{event.average_rating.toFixed(1)}</span>
              <span className="text-muted-foreground">({event.rating_count})</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">No ratings yet</span>
          )}
          {isLeader && (
            <FeedbackDialog
              events={[event]}
              defaultEventId={event.id}
              members={members.filter((m) => m.role === "member")}
            />
          )}
        </div>
      </div>

      {isLeader && <AgentCommandBar eventId={event.id} />}

      <TaskBoard
        eventId={event.id}
        initialTasks={tasks}
        members={members}
        currentMemberId={me.id}
        isLeader={isLeader}
        eventStatus={event.status}
      />

      {feedback.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Feedback</h2>
          {feedback.map((f) => (
            <Card key={f.id}>
              <CardContent className="space-y-1 p-4 pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <StarDisplay value={f.rating} />
                  <span className="font-medium">
                    {f.subject_member_id ? `About ${nameOf(f.subject_member_id)}` : "About the event"}
                  </span>
                </div>
                {(f.validated_comment ?? f.raw_comment) && (
                  <p className="text-sm text-muted-foreground">{f.validated_comment ?? f.raw_comment}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
