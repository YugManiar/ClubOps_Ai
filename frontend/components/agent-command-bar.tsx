"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AgentCommandResponse } from "@/types/database";

/**
 * The core interaction of the whole product. Type a command or paste raw
 * meeting notes -> POST /agent/command -> Gemini function-calls into
 * Supabase -> board refreshes.
 */
export function AgentCommandBar({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentCommandResponse | null>(null);

  async function runCommand() {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agent/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, prompt }),
      });
      const data: AgentCommandResponse = await res.json();
      setResult(data);
      setPrompt("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <textarea
          className="min-h-24 w-full resize-y rounded-md border border-border bg-transparent p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          placeholder="Paste meeting notes or type a command, e.g. 'Assign venue booking to Priya, due Friday'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <Button onClick={runCommand} disabled={loading}>
          {loading ? "Running agent..." : "Run agent"}
        </Button>

        {result && (
          <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">{result.summary}</p>
            {result.actions.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {result.actions.map((a, i) => (
                  <li key={i}>
                    <code>{a.tool}</code> → {JSON.stringify(a.result)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
