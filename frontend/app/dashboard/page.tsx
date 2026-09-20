import { DashboardView } from "@/components/dashboard-view";
import { getDashboardData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { events, tasks, members } = await getDashboardData();
  return <DashboardView events={events} tasks={tasks} members={members} />;
}
