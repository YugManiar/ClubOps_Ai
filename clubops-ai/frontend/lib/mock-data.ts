import type { ClubEvent, Member, Task } from "@/types/database";

// Static mock data for the UI-only pass. Replace with API data later.
const CLUB_ID = "11111111-1111-1111-1111-111111111111";

export const MEMBERS: Member[] = [
  { id: "m1", club_id: CLUB_ID, full_name: "Priya Sharma", email: "priya@campus.edu", role: "lead" },
  { id: "m2", club_id: CLUB_ID, full_name: "Arjun Mehta", email: "arjun@campus.edu", role: "officer" },
  { id: "m3", club_id: CLUB_ID, full_name: "Sara Khan", email: "sara@campus.edu", role: "officer" },
  { id: "m4", club_id: CLUB_ID, full_name: "Leo Fernandes", email: "leo@campus.edu", role: "member" },
  { id: "m5", club_id: CLUB_ID, full_name: "Nina Patel", email: "nina@campus.edu", role: "member" },
];

export const EVENTS: ClubEvent[] = [
  {
    id: "e1", club_id: CLUB_ID, name: "HackNight 2026",
    description: "24-hour campus hackathon with sponsor workshops and demos.",
    location: "Engineering Hall B", start_time: "2026-10-10T09:00:00Z", end_time: "2026-10-11T09:00:00Z",
    status: "planning", created_at: "2026-09-01T10:00:00Z",
  },
  {
    id: "e2", club_id: CLUB_ID, name: "Freshers' Mixer",
    description: "Welcome social for new members.",
    location: "Student Union Lounge", start_time: "2026-09-27T17:30:00Z", end_time: "2026-09-27T20:00:00Z",
    status: "confirmed", created_at: "2026-09-03T10:00:00Z",
  },
  {
    id: "e3", club_id: CLUB_ID, name: "Career Panel: Startups",
    description: "Alumni founders talk about early-stage careers.",
    location: "Auditorium 2", start_time: "2026-09-18T15:00:00Z", end_time: "2026-09-18T17:00:00Z",
    status: "in_progress", created_at: "2026-08-20T10:00:00Z",
  },
  {
    id: "e4", club_id: CLUB_ID, name: "Open Source Sprint",
    description: "Contribute to OSS projects together.",
    location: "Lab 204", start_time: "2026-08-30T10:00:00Z", end_time: "2026-08-30T16:00:00Z",
    status: "completed", created_at: "2026-08-01T10:00:00Z",
  },
];

export const TASKS: Task[] = [
  { id: "t1", event_id: "e1", assignee_id: "m1", title: "Book Engineering Hall B", description: "Confirm with facilities for 24h access.", status: "done", priority: "high", due_date: "2026-09-20", created_at: "2026-09-02T10:00:00Z" },
  { id: "t2", event_id: "e1", assignee_id: "m2", title: "Secure sponsor deck", description: "Send tiered sponsorship PDF to 5 companies.", status: "in_progress", priority: "urgent", due_date: "2026-09-24", created_at: "2026-09-02T11:00:00Z" },
  { id: "t3", event_id: "e1", assignee_id: "m3", title: "Design posters and socials", description: null, status: "in_progress", priority: "medium", due_date: "2026-09-30", created_at: "2026-09-02T12:00:00Z" },
  { id: "t4", event_id: "e1", assignee_id: "m4", title: "Order food for 150 people", description: "Waiting on budget approval.", status: "blocked", priority: "high", due_date: "2026-10-05", created_at: "2026-09-03T10:00:00Z" },
  { id: "t5", event_id: "e1", assignee_id: null, title: "Recruit 10 volunteers", description: "Post in club channels.", status: "todo", priority: "medium", due_date: "2026-10-01", created_at: "2026-09-03T11:00:00Z" },
  { id: "t6", event_id: "e1", assignee_id: "m5", title: "Set up registration form", description: null, status: "todo", priority: "low", due_date: null, created_at: "2026-09-04T10:00:00Z" },
  { id: "t7", event_id: "e1", assignee_id: "m1", title: "Prepare judging rubric", description: "Criteria: impact, technical depth, polish.", status: "todo", priority: "low", due_date: "2026-10-08", created_at: "2026-09-04T11:00:00Z" },
  { id: "t8", event_id: "e2", assignee_id: "m3", title: "Buy snacks and drinks", description: null, status: "todo", priority: "medium", due_date: "2026-09-26", created_at: "2026-09-05T10:00:00Z" },
  { id: "t9", event_id: "e2", assignee_id: "m4", title: "Create playlist", description: null, status: "done", priority: "low", due_date: null, created_at: "2026-09-05T11:00:00Z" },
  { id: "t10", event_id: "e3", assignee_id: "m2", title: "Confirm panelists", description: null, status: "in_progress", priority: "urgent", due_date: "2026-09-17", created_at: "2026-09-06T10:00:00Z" },
];

export const getMember = (id: string | null) => MEMBERS.find((m) => m.id === id) ?? null;
export const getEvent = (id: string) => EVENTS.find((e) => e.id === id) ?? null;
export const getEventTasks = (eventId: string) => TASKS.filter((t) => t.event_id === eventId);
