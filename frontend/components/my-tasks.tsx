"use client";

import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { COLUMNS, PRIORITY, formatDate } from "@/lib/ui-meta";
import type { ClubEvent, Task, TaskStatus } from "@/types/database";

const selectClass =
  "h-8 rounded-md border border-border bg-transparent px-2 text-xs outline-none focus:ring-2 focus:ring-primary";

/** A member's own tasks (RLS already limits the query to what is assigned to them). */
export function MyTasks({ tasks: initial, events }: { tasks: Task[]; events: ClubEvent[] }) {
  const [tasks, setTasks] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(id: string, status: TaskStatus) {
    const previous = tasks.find((t) => t.id === id)?.status;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    setError(null);
    try {
      await api.patch(`/tasks/${id}`, { status });
    } catch (err) {
      if (previous) setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: previous } : t)));
      setError(err instanceof Error ? err.message : "Could not save the change.");
    }
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 pt-8 text-center text-sm text-muted-foreground">
          Nothing is assigned to you yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {tasks.map((t) => {
        const event = events.find((e) => e.id === t.event_id);
        return (
          <Card key={t.id}>
            <CardContent className="flex flex-col gap-3 p-4 pt-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {event && (
                    <Link href={`/events/${event.id}`} className="underline">
                      {event.name}
                    </Link>
                  )}
                  {t.due_date && ` · due ${formatDate(t.due_date)}`}
                </p>
              </div>
              <Badge variant={PRIORITY[t.priority].variant}>{PRIORITY[t.priority].label}</Badge>
              <select
                aria-label={`Status of ${t.title}`}
                className={selectClass}
                value={t.status}
                onChange={(e) => setStatus(t.id, e.target.value as TaskStatus)}
              >
                {COLUMNS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
