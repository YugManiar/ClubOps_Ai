import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";

import { AgentCommandBar } from "@/components/agent-command-bar";
import { TaskBoard } from "@/components/task-board";
import { Badge } from "@/components/ui/badge";
import { getEvent, getEventTasks, MEMBERS } from "@/lib/mock-data";
import { EVENT_STATUS, formatDate } from "@/lib/ui-meta";

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const event = getEvent(params.id);
  if (!event) notFound();

  const status = EVENT_STATUS[event.status];

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
      </div>

      <AgentCommandBar />

      <TaskBoard eventId={event.id} initialTasks={getEventTasks(event.id)} members={MEMBERS} />
    </main>
  );
}
