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
  created_at: string;
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
