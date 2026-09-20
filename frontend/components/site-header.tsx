"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, UserRound } from "lucide-react";

import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { dashboardPath } from "@/lib/config";
import { initials } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";
import type { Member } from "@/types/database";

const navLink =
  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground";
const navActive = "bg-accent text-accent-foreground";

export function SiteHeader({ member }: { member: Member }) {
  const pathname = usePathname();
  const home = dashboardPath(member.role);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href={home} className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">ClubOps AI</span>
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          <Link
            href={home}
            className={cn(navLink, (pathname.startsWith("/dashboard") || pathname.startsWith("/events")) && navActive)}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <Link href="/profile" className={cn(navLink, pathname.startsWith("/profile") && navActive)}>
            <UserRound className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
        </nav>

        <ThemeToggle />
        <Badge variant={member.role === "leader" ? "default" : "muted"} className="capitalize">
          {member.role}
        </Badge>
        <Avatar title={member.full_name} className="h-8 w-8">
          <AvatarFallback seed={member.full_name}>{initials(member.full_name)}</AvatarFallback>
        </Avatar>
        <SignOutButton />
      </div>
    </header>
  );
}
