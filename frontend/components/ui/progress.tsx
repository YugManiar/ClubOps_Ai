import { cn } from "@/lib/utils";

/** `value` is 0-100. Turns green at 100 so a finished event reads as finished at a glance. */
export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          value >= 100 ? "bg-success" : "bg-primary"
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
