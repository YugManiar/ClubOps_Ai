import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function EventNotFound() {
  return (
    <main className="space-y-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Event not found</h1>
      <p className="text-sm text-muted-foreground">It may have been removed or the link is wrong.</p>
      <Link href="/dashboard">
        <Button>Back to dashboard</Button>
      </Link>
    </main>
  );
}
