"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ListChecks, ShieldCheck, Sparkles, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { dashboardPath } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { MemberRole } from "@/types/database";

type Mode = "login" | "signup";

/**
 * The role picked here is sent as user metadata and read by the
 * handle_auth_user trigger (supabase/migrations/008_signup_role_choice.sql).
 *
 * It is NOT verified. Anyone reaching this form can pick "Club leader" and get
 * read access to the whole club plus the agent's write tools. That is a
 * deliberate choice for the demo -- see the banner in 008 for the three ways
 * to gate it before real data lands in the database.
 *
 * Three things still override this choice, all server-side:
 *   - an existing member row keeps the role it already has;
 *   - a club_invites row wins (a leader's explicit grant beats a self-claim);
 *   - the first account in a club with no leader becomes the leader anyway.
 */
const ROLE_OPTIONS: { value: MemberRole; label: string; blurb: string; Icon: typeof User }[] = [
  {
    value: "member",
    label: "Member",
    blurb: "See the tasks assigned to you and the feedback on your work.",
    Icon: User,
  },
  {
    value: "leader",
    label: "Club leader",
    blurb: "Plan events with AI, assign tasks, and review the whole club.",
    Icon: ShieldCheck,
  },
];

/** Turn Supabase auth errors into something a person can act on. */
function friendlyAuthError(err: { message: string; code?: string; status?: number }) {
  if (err.code === "over_email_send_rate_limit" || err.status === 429) {
    return "Too many sign-up emails have been sent recently. Please wait about an hour and try again, or ask your club admin to turn off email confirmation.";
  }
  if (err.code === "email_address_invalid") return "That email address isn't accepted. Try a different one.";
  if (err.code === "weak_password") return "That password is too weak. Use at least 8 characters with a mix of letters and numbers.";
  return err.message;
}

// Only follow same-site paths; never an external URL from ?next=.
const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : null);

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const isSignup = mode === "signup";
  // /login?deleted=1 is where DeleteAccount sends people once the account is gone.
  const justDeleted = !isSignup && params.get("deleted") === "1";

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
            // `role` is read by the handle_auth_user trigger. Unverified by
            // design -- see ROLE_OPTIONS above.
            data: { full_name: fullName.trim(), role },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) return setError(friendlyAuthError(error));
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
    <div className="flex min-h-[calc(100vh-8rem)] items-center">
    <div className="mx-auto grid min-h-[34rem] w-full max-w-4xl animate-rise-in overflow-hidden rounded-2xl border border-border bg-card shadow-lg lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <div className="flex flex-col justify-center gap-6 p-6 sm:p-10">
      <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight lg:hidden">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="h-4 w-4" />
        </span>
        ClubOps AI
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardContent className="space-y-4 p-0">
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
                <>
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

                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">I am joining as</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ROLE_OPTIONS.map(({ value, label, blurb, Icon }) => (
                        <label
                          key={value}
                          className={cn(
                            "cursor-pointer rounded-md border p-3 transition",
                            "focus-within:ring-2 focus-within:ring-primary",
                            role === value
                              ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary/30"
                              : "border-border bg-card hover:bg-accent/50"
                          )}
                        >
                          <input
                            type="radio"
                            name="role"
                            value={value}
                            checked={role === value}
                            onChange={() => setRole(value)}
                            className="sr-only"
                          />
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <Icon className="h-4 w-4 shrink-0" />
                            {label}
                          </span>
                          <span className="mt-1 block text-xs font-normal text-muted-foreground">
                            {blurb}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </>
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

              {justDeleted && !error && (
                <p role="status" className="text-sm text-success">
                  Your account has been deleted.
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-danger">
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
          <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-accent-foreground hover:underline">
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      )}
      </div>
    </div>
    </div>
  );
}

/** Left half of the auth screen (hidden on phones, where the form has the whole width). */
function BrandPanel() {
  const points = [
    { Icon: Sparkles, text: "Describe an event in a sentence and the AI drafts the plan and its tasks." },
    { Icon: ListChecks, text: "Assign work, then watch it move across the board to done." },
    { Icon: ShieldCheck, text: "Every club's data stays separate from every other's." },
  ];
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
      {/* soft light blobs: pure decoration, aria-hidden */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-black/20 blur-3xl" />

      <div className="relative flex items-center gap-2.5 text-lg font-semibold tracking-tight">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 ring-1 ring-inset ring-white/25">
          <Sparkles className="h-5 w-5" />
        </span>
        ClubOps AI
      </div>

      <div className="relative space-y-6">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight">
          Run every club event
          <br />
          from one place.
        </h2>
        <ul className="space-y-4">
          {points.map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-primary-foreground/85">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/15">
                <Icon className="h-3.5 w-3.5" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-primary-foreground/60">Agentic event operations for college clubs.</p>
    </div>
  );
}
