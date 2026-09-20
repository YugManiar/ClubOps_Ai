import { redirect } from "next/navigation";
import { CheckCircle2, ListTodo } from "lucide-react";

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
        <h1 className="text-2xl font-semibold">Hi, {me.full_name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Your tasks and how your leaders rate your work.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">Your rating</p>
            {me.rating_count > 0 ? (
              <>
                <p className="text-3xl font-semibold">{me.average_rating.toFixed(1)}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <StarDisplay value={me.average_rating} /> {me.rating_count} review{me.rating_count > 1 ? "s" : ""}
                </div>
              </>
            ) : (
              <p className="pt-1 text-sm text-muted-foreground">No ratings yet</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ListTodo className="h-4 w-4" /> Open tasks
            </p>
            <p className="text-3xl font-semibold">{open}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> Completed
            </p>
            <p className="text-3xl font-semibold">{tasks.length - open}</p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My tasks</h2>
        <MyTasks tasks={tasks} events={events} />
      </section>

      {feedback.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Feedback about you</h2>
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
