// The seeded club; the members/tasks/feedback queries are further scoped by RLS.
export const DEMO_CLUB_ID = "11111111-1111-1111-1111-111111111111";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const dashboardPath = (role: "leader" | "member") => `/dashboard/${role}`;
