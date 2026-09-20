"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ListTodo, Search, Users } from "lucide-react";

import { CreateEventDialog } from "@/components/create-event-dialog";
import { EventCard } from "@/components/event-card";
import { StarDisplay } from "@/components/star-rating";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EVENT_STATUS, initials } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";
import type { ClubEvent, EventStatus, Member, Task } from "@/types/database";

type Filter = "all" | EventStatus;
const FILTERS: Filter[] = ["all", "planning", "confirmed", "in_progress", "completed"];

export function DashboardView({
  events,
  tasks,
  members,
  children,
}: {
  events: ClubEvent[];
  tasks: Task[];
  members: Member[];
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () =>
      events.filter(
        (e) =>
          (filter === "all" || e.status === filter) &&
          e.name.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [events, query, filter]
  );

  // `tone` picks the icon tile colour; these are theme tokens, so they follow light/dark.
  const stats = [
    { label: "Events", value: events.length, Icon: CalendarDays, tone: "bg-primary/10 text-primary" },
    { label: "Open tasks", value: tasks.filter((t) => t.status !== "done").length, Icon: ListTodo, tone: "bg-info/10 text-info" },
    { label: "Blocked", value: tasks.filter((t) => t.status === "blocked").length, Icon: AlertTriangle, tone: "bg-warning/10 text-warning" },
    { label: "Members", value: members.length, Icon: Users, tone: "bg-success/10 text-success" },
  ];

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
          <p className="text-sm text-muted-foreground">Everything your club is running, at a glance.</p>
        </div>
        <CreateEventDialog />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="animate-rise-in">
            <CardContent className="flex items-center gap-4 p-5 pt-5">
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", s.tone)}>
                <s.Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-3xl font-semibold leading-tight tracking-tight">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search events..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={cn(
                    "rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                    filter === f && "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  )}
                >
                  {f === "all" ? "All" : EVENT_STATUS[f].label}
                </button>
              ))}
            </div>
          </div>

          {visible.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {visible.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  tasks={tasks.filter((t) => t.event_id === event.id)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 pt-8 text-center text-sm text-muted-foreground">
                No events match your filters.
              </CardContent>
            </Card>
          )}
        </section>

        <aside>
          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold tracking-tight">Team</h2>
              <ul className="space-y-3">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback seed={m.full_name} className="text-xs">{initials(m.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      {m.rating_count > 0 && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <StarDisplay value={m.average_rating} className="scale-75 origin-left" />
                          {m.average_rating.toFixed(1)}
                        </p>
                      )}
                    </div>
                    <Badge variant={m.role === "leader" ? "soft" : "muted"} className="capitalize">{m.role}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>

      {children}
    </main>
  );
}
