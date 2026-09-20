import { redirect } from "next/navigation";
import { CheckCircle2, ListTodo, Star } from "lucide-react";

import { MyTasks } from "@/components/my-tasks";
import { StarDisplay } from "@/components/star-rating";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentMember, getMemberDashboardData } from "@/lib/data";
import { formatDate } from "@/lib/ui-meta";

export const dynamic = "force-dynamic";

export default async function MemberDashboardPage() {
  const me = await getCurrentMember();
  if (!me) redirect("/dashboard");
  if (me.role === "leader") redirect("/dashboard/leader");

  const { tasks, events, feedback } = await getMemberDashboardData(me);
  const open = tasks.filter((t) => t.status !== "done").length;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hi, {me.full_name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Your tasks and how your leaders rate your work.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="animate-rise-in">
          <CardContent className="flex items-center gap-4 p-5 pt-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning">
              <Star className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Your rating</p>
              {me.rating_count > 0 ? (
                <>
                  <p className="text-3xl font-semibold leading-tight tracking-tight">{me.average_rating.toFixed(1)}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <StarDisplay value={me.average_rating} /> {me.rating_count} review{me.rating_count > 1 ? "s" : ""}
                  </div>
                </>
              ) : (
                <p className="pt-1 text-sm text-muted-foreground">No ratings yet</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="animate-rise-in">
          <CardContent className="flex items-center gap-4 p-5 pt-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-info/10 text-info">
              <ListTodo className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Open tasks</p>
              <p className="text-3xl font-semibold leading-tight tracking-tight">{open}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-rise-in">
          <CardContent className="flex items-center gap-4 p-5 pt-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-success/10 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-3xl font-semibold leading-tight tracking-tight">{tasks.length - open}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">My tasks</h2>
        <MyTasks tasks={tasks} events={events} />
      </section>

      {feedback.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Feedback about you</h2>
          {feedback.map((f) => (
            <Card key={f.id}>
              <CardContent className="space-y-1 p-4 pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <StarDisplay value={f.rating} />
                  <span className="text-muted-foreground">
                    {events.find((e) => e.id === f.event_id)?.name} · {formatDate(f.created_at)}
                  </span>
                </div>
                {(f.validated_comment ?? f.raw_comment) && (
                  <p className="text-sm">{f.validated_comment ?? f.raw_comment}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
