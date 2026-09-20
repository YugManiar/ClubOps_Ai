export type EventStatus =
  | "planning"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Member {
  id: string;
  club_id: string;
  full_name: string;
  email: string;
  role: MemberRole;
  auth_user_id: string | null;
  /** Average of leader feedback about this member; maintained by a DB trigger. */
  average_rating: number;
  rating_count: number;
}

export type MemberRole = "leader" | "member";

export interface ClubEvent {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string | null;
  status: EventStatus;
  /** Maintained by a DB trigger on `feedback`; 0 when there are no ratings. */
  average_rating: number;
  rating_count: number;
  created_at: string;
}

export interface Feedback {
  id: string;
  event_id: string;
  /** Author (a leader). */
  member_id: string | null;
  /** The member being rated; null = a rating of the event itself. */
  subject_member_id: string | null;
  rating: number;
  raw_comment: string | null;
  validated_comment: string | null;
  is_constructive: boolean | null;
  created_at: string;
}

/**
 * Contract for POST /api/events/plan.
 *
 * No club_id: the backend takes the club from the caller's verified token, so
 * there is nothing here that could disagree with it. Planning is asynchronous
 * (a Gemini generation of ~15 tasks outlives any proxy's request ceiling), so
 * this returns a job to poll rather than the finished event.
 */
export interface PlanEventRequest {
  prompt: string;
  start_time?: string;
  location?: string;
}

export interface PlanAccepted {
  job_id: string;
  status: string;
}

export type PlanJobStatus = "pending" | "running" | "done" | "failed";

/** GET /api/events/plan/{job_id} */
export interface PlanJob {
  id: string;
  status: PlanJobStatus;
  /** Set once status is "done". */
  event_id: string | null;
  error: string | null;
  created_at: string;
}

/** Contract for POST /api/feedback/submit (backend, phase 3). */
export interface SubmitFeedbackRequest {
  event_id: string;
  /** Member being rated; null = the event itself. The author comes from the auth token. */
  subject_member_id: string | null;
  rating: number;
  comment: string;
}
export interface SubmitFeedbackResponse {
  accepted: boolean;
  validated_comment: string | null;
  /** Explanation shown to the user when Gemini rejects the comment. */
  message: string | null;
  average_rating: number;
  rating_count: number;
}

export interface Task {
  id: string;
  event_id: string;
  assignee_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
}

export interface AgentAction {
  tool: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface AgentCommandResponse {
  summary: string;
  actions: AgentAction[];
  /** Actions that did not succeed. The agent writes row by row with no
   *  transaction, so a partial run must be shown, not hidden behind a summary
   *  the model wrote before it knew the outcome. */
  failed: number;
  /** True when the agent hit its tool-turn ceiling with work outstanding. */
  truncated: boolean;
}

// Alias matching the UI issue's naming; `ClubEvent` avoids shadowing the DOM
// `Event` global elsewhere in the codebase.
export type Event = ClubEvent;
