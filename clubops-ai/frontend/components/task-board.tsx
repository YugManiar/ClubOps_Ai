"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Task, TaskStatus } from "@/types/database";

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {COLUMNS.map((col) => (
        <div key={col.key} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {col.label} ({tasks.filter((t) => t.status === col.key).length})
          </h3>
          {tasks
            .filter((t) => t.status === col.key)
            .map((task) => (
              <Card key={task.id}>
                <CardContent className="space-y-2 p-3">
                  <p className="text-sm font-medium">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-muted-foreground">{task.description}</p>
                  )}
                  <Badge variant="outline">{task.priority}</Badge>
                </CardContent>
              </Card>
            ))}
        </div>
      ))}
    </div>
  );
}
