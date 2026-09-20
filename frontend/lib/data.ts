import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { ClubEvent, Feedback, Member, Task } from "@/types/database";

/**
 * Every query here is scoped to the caller's own club, read from their session.
 *
 * These filters are defence in depth, NOT the control. The control is the
 * club-scoped RLS in supabase/migrations/004_tenant_rls.sql -- these queries run
 * with the anon key under the user's JWT, so a missing filter here would be
 * caught there. Before 004 neither layer existed and one login could read every
 * tenant's rows; keep both.
 */

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

/** Throws if the caller has no member row -- callers past the middleware always do. */
async function requireMember(): Promise<Member> {
  const me = await getCurrentMember();
  if (!me) throw new Error("This account is not linked to a club member.");
  return me;
}

/** RLS narrows this further: leaders get the whole club, members only themselves. */
export async function getMembers(): Promise<Member[]> {
  const me = await requireMember();
  const { data, error } = await createClient()
    .from("members")
    .select("*")
    .eq("club_id", me.club_id)
    .order("full_name");
  if (error) throw new Error(`members: ${error.message}`);
  return data as Member[];
}

export async function getLeaderDashboardData() {
  const supabase = createClient();
  const me = await requireMember();

  const [events, members] = await Promise.all([
    supabase.from("events").select("*").eq("club_id", me.club_id).order("start_time"),
    getMembers(),
  ]);
  if (events.error) throw new Error(`events: ${events.error.message}`);

  // Feedback has no club_id of its own; it is scoped through its event. Listing
  // it unfiltered (as this used to) returns every club's comments.
  const ids = (events.data ?? []).map((e) => e.id);
  const [tasks, feedback] = await Promise.all([
    ids.length
      ? supabase.from("tasks").select("*").in("event_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase
          .from("feedback")
          .select("*")
          .in("event_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (tasks.error) throw new Error(`tasks: ${tasks.error.message}`);
  if (feedback.error) throw new Error(`feedback: ${feedback.error.message}`);

  return {
    events: events.data as ClubEvent[],
    tasks: (tasks.data ?? []) as Task[],
    members,
    feedback: (feedback.data ?? []) as Feedback[],
  };
}

export async function getMemberDashboardData(member: Member) {
  const supabase = createClient();
  const [tasks, events, feedback] = await Promise.all([
    supabase.from("tasks").select("*").eq("assignee_id", member.id).order("due_date", { nullsFirst: false }),
    // Was an unfiltered select("*") -- i.e. every club's events.
    supabase.from("events").select("*").eq("club_id", member.club_id),
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
  const me = await getCurrentMember();
  if (!me) return null;

  // club_id in the filter, so another tenant's event id is a 404 rather than a read.
  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("club_id", me.club_id)
    .maybeSingle();
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
