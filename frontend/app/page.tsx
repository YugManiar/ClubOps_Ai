import { EventCard } from "@/components/event-card";
import { createClient } from "@/lib/supabase/server";
import type { ClubEvent } from "@/types/database";

// Hackathon shortcut: no auth flow scaffolded, so we pin to the seeded demo
// club. Swap for the authenticated user's club_id once auth exists.
const DEMO_CLUB_ID = "11111111-1111-1111-1111-111111111111";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("club_id", DEMO_CLUB_ID)
    .order("start_time", { ascending: true });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Events</h1>
        <p className="text-sm text-muted-foreground">
          ClubOps AI — every event below is driven by the agent, not a form.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(events as ClubEvent[] | null)?.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </main>
  );
}
