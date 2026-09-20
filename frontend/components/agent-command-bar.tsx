"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { AgentCommandResponse } from "@/types/database";

export function AgentCommandBar({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AgentCommandResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<AgentCommandResponse>("/agent/command", {
        event_id: eventId,
        prompt: prompt.trim(),
      });
      setResult(res);
      setPrompt("");
      router.refresh(); // task board re-reads from Supabase
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4 pt-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4" /> Agent
        </div>
        <Textarea
          className="min-h-24 resize-y"
          placeholder="Paste meeting notes or type a command, e.g. 'Assign venue booking to Priya, due Friday'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">The agent will turn this into tasks.</p>
          <Button disabled={busy || !prompt.trim()} onClick={run}>
            {busy ? "Running..." : "Run agent"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {result && (
          <div className="space-y-1 rounded-md border border-border p-3 text-sm">
            <p>{result.summary}</p>
            <ul className="list-disc pl-5 text-xs text-muted-foreground">
              {result.actions.map((a, i) => (
                <li key={i}>{a.tool}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
