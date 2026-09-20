// There is deliberately no club id constant here.
//
// A hardcoded DEMO_CLUB_ID used to be the filter for every dashboard query and
// the club_id sent to /api/events/plan. That is wrong twice over: it leaks the
// demo club to every tenant's queries, and it makes the product fail outright
// for club number two (the backend rejects a club_id that isn't the caller's).
//
// The club always comes from the session -- getCurrentMember().club_id on the
// frontend, and the verified JWT on the backend.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const dashboardPath = (role: "leader" | "member") => `/dashboard/${role}`;
