import { redirect } from "next/navigation";

import { DashboardView } from "@/components/dashboard-view";
import { FeedbackManager } from "@/components/feedback-manager";
import { getCurrentMember, getLeaderDashboardData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LeaderDashboardPage() {
  const me = await getCurrentMember();
  if (!me) redirect("/dashboard");
  if (me.role !== "leader") redirect("/dashboard/member"); // members can't view this page

  const { events, tasks, members, feedback } = await getLeaderDashboardData();

  return (
    <DashboardView events={events} tasks={tasks} members={members}>
      <FeedbackManager feedback={feedback} events={events} members={members} />
    </DashboardView>
  );
}
