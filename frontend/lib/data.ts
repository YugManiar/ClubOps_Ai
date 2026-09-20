import { createClient } from "@/lib/supabase/server";
import { DEMO_CLUB_ID, DEMO_MEMBER_EMAIL } from "@/lib/config";
import type { ClubEvent, Feedback, Member, Task } from "@/types/database";

export async function getMembers(): Promise<Member[]> {
  const { data, error } = await createClient()
    .from("members")
    .select("*")
    .eq("club_id", DEMO_CLUB_ID)
    .order("full_name");
  if (error) throw new Error(`members: ${error.message}`);
  return data as Member[];
}

export const currentMemberId = (members: Member[]) =>
  members.find((m) => m.email === DEMO_MEMBER_EMAIL)?.id ?? null;

export async function getDashboardData() {
  const supabase = createClient();
  const [events, members] = await Promise.all([
    supabase.from("events").select("*").eq("club_id", DEMO_CLUB_ID).order("start_time"),
    getMembers(),
  ]);
  if (events.error) throw new Error(`events: ${events.error.message}`);

  const ids = (events.data ?? []).map((e) => e.id);
  const tasks = ids.length
    ? await supabase.from("tasks").select("*").in("event_id", ids)
    : { data: [], error: null };
  if (tasks.error) throw new Error(`tasks: ${tasks.error.message}`);

  return { events: events.data as ClubEvent[], tasks: tasks.data as Task[], members };
}

export async function getEventDetail(id: string) {
  const supabase = createClient();
  const { data: event, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error || !event) return null; // includes malformed uuids -> 404

  const [tasks, feedback, members] = await Promise.all([
    supabase.from("tasks").select("*").eq("event_id", id).order("created_at"),
    supabase.from("feedback").select("*").eq("event_id", id).order("created_at", { ascending: false }),
    getMembers(),
  ]);
  if (tasks.error) throw new Error(`tasks: ${tasks.error.message}`);

  return {
    event: event as ClubEvent,
    tasks: tasks.data as Task[],
    feedback: (feedback.data ?? []) as Feedback[],
    members,
  };
}
