"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, UserRound } from "lucide-react";

import { SignOutButton } from "@/components/sign-out-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { dashboardPath } from "@/lib/config";
import { initials } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";
import type { Member } from "@/types/database";

export function SiteHeader({ member }: { member: Member }) {
  const pathname = usePathname();
  const home = dashboardPath(member.role);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href={home} className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-5 w-5" />
          ClubOps AI
        </Link>
        <nav className="flex flex-1 items-center gap-1">
          <Link
            href={home}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted",
              (pathname.startsWith("/dashboard") || pathname.startsWith("/events")) && "bg-muted text-foreground"
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <Link
            href="/profile"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted",
              pathname.startsWith("/profile") && "bg-muted text-foreground"
            )}
          >
            <UserRound className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
        </nav>
        <Badge variant={member.role === "leader" ? "default" : "muted"}>{member.role}</Badge>
        <Avatar title={member.full_name}>
          <AvatarFallback>{initials(member.full_name)}</AvatarFallback>
        </Avatar>
        <SignOutButton />
      </div>
    </header>
  );
}
