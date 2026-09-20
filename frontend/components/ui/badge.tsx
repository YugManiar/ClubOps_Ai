import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Tinted (not solid) colours with an inset ring: readable at 12px in both themes,
 * and distinguishable from one another, unlike the old grey-on-grey set.
 * `default` stays solid on purpose: it is the one emphasised badge (the leader role).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        // accent is a tweakcn token pair that is already contrast-checked, unlike primary-on-a-tint
        soft: "bg-accent text-accent-foreground ring-1 ring-inset ring-primary/20",
        muted: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
        outline: "border border-border text-foreground",
        success: "bg-success/10 text-success-foreground ring-1 ring-inset ring-success/25",
        warning: "bg-warning/10 text-warning-foreground ring-1 ring-inset ring-warning/25",
        danger: "bg-danger/10 text-danger-foreground ring-1 ring-inset ring-danger/25",
        info: "bg-info/10 text-info-foreground ring-1 ring-inset ring-info/25",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
