import type { EventStatus, TaskPriority, TaskStatus } from "@/types/database";

export type BadgeVariant = "default" | "muted" | "outline" | "success" | "warning" | "danger";

export const EVENT_STATUS: Record<EventStatus, { label: string; variant: BadgeVariant }> = {
  planning: { label: "Planning", variant: "outline" },
  confirmed: { label: "Confirmed", variant: "success" },
  in_progress: { label: "Live", variant: "warning" },
  completed: { label: "Completed", variant: "muted" },
  cancelled: { label: "Cancelled", variant: "danger" },
};

export const PRIORITY: Record<TaskPriority, { label: string; variant: BadgeVariant }> = {
  low: { label: "Low", variant: "muted" },
  medium: { label: "Medium", variant: "outline" },
  high: { label: "High", variant: "warning" },
  urgent: { label: "Urgent", variant: "danger" },
};

export const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Fixed locale/timezone so server and client render identical strings.
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
