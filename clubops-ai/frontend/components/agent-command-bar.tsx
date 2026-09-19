"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";

/**
 * UI shell for the agent command bar. Static for now: input + button states
 * only, no request is sent. Wire to POST /agent/command in a later pass.
 */
export function AgentCommandBar() {
  const [prompt, setPrompt] = useState("");
  const [submitted, setSubmitted] = useState(false);

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
          onChange={(e) => {
            setPrompt(e.target.value);
            setSubmitted(false);
          }}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {submitted ? "Agent is not connected yet." : "The agent will turn this into tasks."}
          </p>
          <Button disabled={!prompt.trim()} onClick={() => setSubmitted(true)}>
            Run agent
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
