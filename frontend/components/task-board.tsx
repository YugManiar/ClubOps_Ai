"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";
import { COLUMNS, PRIORITY, formatDate, initials } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";
import type { Member, Task, TaskPriority, TaskStatus } from "@/types/database";

const selectClass =
  "flex h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary";

interface TaskBoardProps {
  eventId: string;
  initialTasks: Task[];
  members: Member[];
  /** Demo-only stand-in for the logged-in user (no auth yet). */
  currentMemberId: string | null;
}

export function TaskBoard({ eventId, initialTasks, members, currentMemberId }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Server data changes after router.refresh() (agent ran, event re-planned).
  useEffect(() => setTasks(initialTasks), [initialTasks]);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<"all" | TaskPriority>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const memberById = (id: string | null) => members.find((m) => m.id === id) ?? null;
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  const visible = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(query.trim().toLowerCase()) &&
          (priority === "all" || t.priority === priority) &&
          (!mineOnly || t.assignee_id === currentMemberId)
      ),
    [tasks, query, priority, mineOnly]
  );

  // Optimistic update; status is persisted through PATCH /tasks/{id} and rolled
  // back on failure. Priority/assignee edits are still local-only (the backend
  // PATCH only accepts status).
  async function moveTask(id: string, status: TaskStatus) {
    const previous = tasks.find((t) => t.id === id)?.status;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    setSaveError(null);
    try {
      await api.patch(`/tasks/${id}`, { status });
    } catch (err) {
      if (previous) setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: previous } : t)));
      setSaveError(err instanceof Error ? err.message : "Could not save the change.");
    }
  }

  function updateTask(id: string, patch: Partial<Task>) {
    if (patch.status) return void moveTask(id, patch.status);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function addTask(task: Pick<Task, "title" | "description" | "priority" | "assignee_id">) {
    setTasks((prev) => [
      ...prev,
      {
        ...task,
        id: `local-${prev.length + 1}`,
        event_id: eventId,
        status: "todo",
        due_date: null,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  return (
    <section className="space-y-4">
      {saveError && (
        <p role="alert" className="text-sm text-red-600">
          {saveError}
        </p>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by priority"
          className={cn(selectClass, "lg:w-40")}
          value={priority}
          onChange={(e) => setPriority(e.target.value as "all" | TaskPriority)}
        >
          <option value="all">All priorities</option>
          {Object.entries(PRIORITY).map(([key, p]) => (
            <option key={key} value={key}>
              {p.label}
            </option>
          ))}
        </select>
        <Button
          variant={mineOnly ? "default" : "outline"}
          aria-pressed={mineOnly}
          onClick={() => setMineOnly((v) => !v)}
        >
          My tasks
        </Button>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" /> New task
        </Button>
      </div>

      {/* Columns stack on mobile, 2-up on tablet, 4-up on desktop */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col, colIdx) => {
          const items = visible.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="space-y-3 rounded-lg bg-muted p-3">
              <h3 className="flex items-center justify-between text-sm font-semibold">
                {col.label}
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  {items.length}
                </span>
              </h3>

              {items.length === 0 && (
                <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No tasks
                </p>
              )}

              {items.map((task) => {
                const assignee = memberById(task.assignee_id);
                const prev = COLUMNS[colIdx - 1];
                const next = COLUMNS[colIdx + 1];
                return (
                  <Card key={task.id} className="transition-shadow hover:shadow-md">
                    <CardContent className="space-y-3 p-3 pt-3">
                      <button
                        className="block w-full space-y-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        onClick={() => setSelectedId(task.id)}
                      >
                        <p className="text-sm font-medium">{task.title}</p>
                        {task.description && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {task.description}
                          </p>
                        )}
                      </button>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={PRIORITY[task.priority].variant}>
                            {PRIORITY[task.priority].label}
                          </Badge>
                          {task.due_date && (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(task.due_date)}
                            </span>
                          )}
                        </div>
                        {assignee ? (
                          <Avatar title={assignee.full_name}>
                            <AvatarFallback>{initials(assignee.full_name)}</AvatarFallback>
                          </Avatar>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </div>
                      <div className="flex justify-between border-t border-border pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!prev}
                          onClick={() => prev && moveTask(task.id, prev.key)}
                          aria-label={prev ? `Move to ${prev.label}` : "Already first column"}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!next}
                          onClick={() => next && moveTask(task.id, next.key)}
                          aria-label={next ? `Move to ${next.label}` : "Already last column"}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>
                  {selected.description ?? "No description provided."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium">
                  Status
                  <select
                    className={selectClass}
                    value={selected.status}
                    onChange={(e) => updateTask(selected.id, { status: e.target.value as TaskStatus })}
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Priority
                  <select
                    className={selectClass}
                    value={selected.priority}
                    onChange={(e) =>
                      updateTask(selected.id, { priority: e.target.value as TaskPriority })
                    }
                  >
                    {Object.entries(PRIORITY).map(([key, p]) => (
                      <option key={key} value={key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium sm:col-span-2">
                  Assignee
                  <select
                    className={selectClass}
                    value={selected.assignee_id ?? ""}
                    onChange={(e) => updateTask(selected.id, { assignee_id: e.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <NewTaskDialog
        open={creating}
        members={members}
        onOpenChange={setCreating}
        onCreate={addTask}
      />
    </section>
  );
}

function NewTaskDialog({
  open,
  members,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  onCreate: (task: Pick<Task, "title" | "description" | "priority" | "assignee_id">) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignee, setAssignee] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assignee_id: assignee || null,
    });
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAssignee("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Added to the To do column (local state only).</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              aria-label="Priority"
              className={selectClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {Object.entries(PRIORITY).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Assignee"
              className={selectClass}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
