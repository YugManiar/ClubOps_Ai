import { DashboardView } from "@/components/dashboard-view";
import { EVENTS, MEMBERS, TASKS } from "@/lib/mock-data";

export default function DashboardPage() {
  return <DashboardView events={EVENTS} tasks={TASKS} members={MEMBERS} />;
}
