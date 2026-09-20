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
  role: "lead" | "officer" | "member";
}

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
  member_id: string | null;
  rating: number;
  raw_comment: string | null;
  validated_comment: string | null;
  is_constructive: boolean | null;
  created_at: string;
}

/** Contract for POST /api/events/plan (backend, phase 3). */
export interface PlanEventRequest {
  club_id: string;
  prompt: string;
  start_time?: string;
  location?: string;
}
export interface PlanEventResponse {
  event: ClubEvent;
  tasks: Task[];
}

/** Contract for POST /api/feedback/submit (backend, phase 3). */
export interface SubmitFeedbackRequest {
  event_id: string;
  member_id: string | null;
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
}

// Alias matching the UI issue's naming; `ClubEvent` avoids shadowing the DOM
// `Event` global elsewhere in the codebase.
export type Event = ClubEvent;
