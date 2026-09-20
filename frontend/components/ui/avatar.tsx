"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

export function Avatar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn("relative flex h-7 w-7 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}

/** Same seed, same colour, every time: a person keeps their tone across pages and reloads. */
function toneFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 5) + 1; // --chart-1 .. --chart-5
}

export function AvatarFallback({
  className,
  seed,
  style,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> & { seed?: string }) {
  const n = seed ? toneFor(seed) : null;
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted text-[10px] font-semibold",
        className
      )}
      style={
        n
          ? { backgroundColor: `hsl(var(--chart-${n}) / 0.15)`, color: `hsl(var(--chart-${n}))`, ...style }
          : style
      }
      {...props}
    />
  );
}
