import { redirect } from "next/navigation";

import { DeleteAccount } from "@/components/delete-account";
import { StarDisplay } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentMember } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await getCurrentMember();
  if (!me) redirect("/dashboard"); // signed in but not linked to a member row

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="text-sm text-muted-foreground">Your account details and settings.</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-5 pt-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium">{me.full_name}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{me.email}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd>
              <Badge variant={me.role === "leader" ? "default" : "muted"}>{me.role}</Badge>
            </dd>
            <dt className="text-muted-foreground">Rating</dt>
            <dd>
              {me.rating_count > 0 ? (
                <span className="flex items-center gap-2">
                  <StarDisplay value={me.average_rating} />
                  <span className="font-medium">{me.average_rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({me.rating_count})</span>
                </span>
              ) : (
                <span className="text-muted-foreground">No ratings yet</span>
              )}
            </dd>
          </dl>
        </CardContent>
      </Card>

      <DeleteAccount email={me.email} role={me.role} />
    </main>
  );
}
