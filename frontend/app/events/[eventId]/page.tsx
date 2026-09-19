import { notFound } from "next/navigation";

import { AgentCommandBar } from "@/components/agent-command-bar";
import { TaskBoard } from "@/components/task-board";
import { createClient } from "@/lib/supabase/server";
import type { ClubEvent, Task } from "@/types/database";

export default async function EventDetailPage({
  params,
}: {
  params: { eventId: string };
}) {
  const supabase = createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", params.eventId)
    .single();

  if (!event) notFound();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("event_id", params.eventId)
    .order("created_at", { ascending: true });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{(event as ClubEvent).name}</h1>
        <p className="text-sm text-muted-foreground">
          {(event as ClubEvent).location} · {new Date((event as ClubEvent).start_time).toLocaleString()}
        </p>
      </div>

      <AgentCommandBar eventId={params.eventId} />

      <TaskBoard tasks={(tasks as Task[] | null) ?? []} />
    </main>
  );
}
