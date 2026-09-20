import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
import { dashboardPath } from "@/lib/config";
import { getCurrentMember } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Role router: /dashboard sends each user to their own dashboard. */
export default async function DashboardIndex() {
  const member = await getCurrentMember();
  if (member) redirect(dashboardPath(member.role));

  // Signed in (middleware guarantees a session) but not linked to a members row.
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="space-y-3 p-6 pt-6 text-center">
        <h1 className="text-lg font-semibold">Account not set up yet</h1>
        <p className="text-sm text-muted-foreground">
          Your login isn&apos;t linked to a club member. Ask a club leader to add you, then sign in again.
        </p>
        <SignOutButton />
      </CardContent>
    </Card>
  );
}
