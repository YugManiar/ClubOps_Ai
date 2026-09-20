"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { dashboardPath } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import type { MemberRole } from "@/types/database";

type Mode = "login" | "signup";

// Only follow same-site paths; never an external URL from ?next=.
const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : null);

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const isSignup = mode === "signup";

  /** Look up the role for a fresh session and send the user to the right dashboard. */
  async function routeByRole(userId: string) {
    const { data: member } = await supabase
      .from("members")
      .select("role")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!member) {
      await supabase.auth.signOut();
      setError("Your account isn't linked to a club member yet. Ask a club leader for help.");
      return;
    }
    const next = safeNext(params.get("next"));
    router.replace(next?.startsWith("/events") ? next : dashboardPath(member.role as MemberRole));
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isSignup) {
      if (password.length < 8) return setError("Password must be at least 8 characters.");
      if (password !== confirm) return setError("Passwords don't match.");
    }

    setBusy(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) return setError(error.message);
        // With email confirmation on, an already-registered address returns a user with no identities.
        if (data.user && data.user.identities?.length === 0) {
          return setError("An account with this email already exists. Try logging in.");
        }
        if (data.session && data.user) return await routeByRole(data.user.id);
        setCheckEmail(true); // confirmation required: no session until they click the link
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        return setError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
      }
      await routeByRole(data.user.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-6">
      <div className="flex items-center justify-center gap-2 text-xl font-semibold">
        <Sparkles className="h-6 w-6" /> ClubOps AI
      </div>

      <Card>
        <CardContent className="space-y-4 p-6 pt-6">
          {checkEmail ? (
            <div className="space-y-2 text-center">
              <h1 className="text-lg font-semibold">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to <span className="font-medium">{email}</span>. Click it, then log in.
              </p>
              <Link href="/login" className="text-sm font-medium underline">
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold">{isSignup ? "Create your account" : "Log in"}</h1>
                <p className="text-sm text-muted-foreground">
                  {isSignup ? "Join your club on ClubOps AI." : "Welcome back."}
                </p>
              </div>

              {isSignup && (
                <label className="block space-y-1 text-sm font-medium">
                  Full name
                  <Input
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Priya Nair"
                  />
                </label>
              )}
              <label className="block space-y-1 text-sm font-medium">
                Email
                <Input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@college.edu"
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Password
                <Input
                  required
                  type="password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {isSignup && (
                <label className="block space-y-1 text-sm font-medium">
                  Confirm password
                  <Input
                    required
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
              )}

              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait..." : isSignup ? "Sign up" : "Log in"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {!checkEmail && (
        <p className="text-center text-sm text-muted-foreground">
          {isSignup ? "Already have an account? " : "New to ClubOps? "}
          <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-foreground underline">
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      )}
    </div>
  );
}
