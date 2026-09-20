import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { DEMO_CLUB_ID } from "@/lib/config";
import type { ClubEvent, Feedback, Member, Task } from "@/types/database";

/**
 * The logged-in user's members row, or null (no session, or the account is not
 * linked to a member yet). RLS lets every user read their own row.
 */
export const getCurrentMember = cache(async (): Promise<Member | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("members").select("*").eq("auth_user_id", user.id).maybeSingle();
  return (data as Member | null) ?? null;
});

/** RLS decides what comes back: leaders get the whole club, members only themselves. */
export async function getMembers(): Promise<Member[]> {
  const { data, error } = await createClient()
    .from("members")
    .select("*")
    .eq("club_id", DEMO_CLUB_ID)
    .order("full_name");
  if (error) throw new Error(`members: ${error.message}`);
  return data as Member[];
}

export async function getLeaderDashboardData() {
  const supabase = createClient();
  const [events, members, feedback] = await Promise.all([
    supabase.from("events").select("*").eq("club_id", DEMO_CLUB_ID).order("start_time"),
    getMembers(),
    supabase.from("feedback").select("*").order("created_at", { ascending: false }),
  ]);
  if (events.error) throw new Error(`events: ${events.error.message}`);
  if (feedback.error) throw new Error(`feedback: ${feedback.error.message}`);

  const ids = (events.data ?? []).map((e) => e.id);
  const tasks = ids.length
    ? await supabase.from("tasks").select("*").in("event_id", ids)
    : { data: [], error: null };
  if (tasks.error) throw new Error(`tasks: ${tasks.error.message}`);

  return {
    events: events.data as ClubEvent[],
    tasks: tasks.data as Task[],
    members,
    feedback: feedback.data as Feedback[],
  };
}

export async function getMemberDashboardData(member: Member) {
  const supabase = createClient();
  const [tasks, events, feedback] = await Promise.all([
    supabase.from("tasks").select("*").eq("assignee_id", member.id).order("due_date", { nullsFirst: false }),
    supabase.from("events").select("*"),
    supabase.from("feedback").select("*").eq("subject_member_id", member.id).order("created_at", { ascending: false }),
  ]);
  if (tasks.error) throw new Error(`tasks: ${tasks.error.message}`);
  if (events.error) throw new Error(`events: ${events.error.message}`);

  return {
    tasks: tasks.data as Task[],
    events: events.data as ClubEvent[],
    feedback: (feedback.data ?? []) as Feedback[],
  };
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
