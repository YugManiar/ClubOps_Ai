import Link from "next/link";
import { Calendar, CheckCircle2, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StarDisplay } from "@/components/star-rating";
import { Progress } from "@/components/ui/progress";
import { EVENT_STATUS, formatDate } from "@/lib/ui-meta";
import type { ClubEvent, Task } from "@/types/database";

export function EventCard({ event, tasks }: { event: ClubEvent; tasks: Task[] }) {
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const status = EVENT_STATUS[event.status];

  return (
    <Link
      href={`/events/${event.id}`}
      className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <CardTitle className="leading-snug transition-colors group-hover:text-accent-foreground">{event.name}</CardTitle>
          <Badge variant={status.variant} className="shrink-0">{status.label}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {event.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{event.description}</p>
          )}
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> {formatDate(event.start_time)}
            </p>
            {event.location && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> {event.location}
              </p>
            )}
          </div>
          {event.rating_count > 0 && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <StarDisplay value={event.average_rating} />
              {event.average_rating.toFixed(1)} ({event.rating_count})
            </p>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> {done}/{tasks.length} tasks
              </span>
              <span>{pct}%</span>
            </div>
            <Progress value={pct} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
