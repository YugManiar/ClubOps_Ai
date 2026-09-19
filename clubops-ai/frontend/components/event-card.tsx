import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClubEvent } from "@/types/database";

const STATUS_VARIANT: Record<ClubEvent["status"], "default" | "muted" | "outline"> = {
  planning: "outline",
  confirmed: "default",
  in_progress: "default",
  completed: "muted",
  cancelled: "muted",
};

export function EventCard({ event }: { event: ClubEvent }) {
  return (
    <Link href={`/events/${event.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <CardTitle>{event.name}</CardTitle>
          <Badge variant={STATUS_VARIANT[event.status]}>{event.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{new Date(event.start_time).toLocaleString()}</p>
          {event.location && <p>{event.location}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}
