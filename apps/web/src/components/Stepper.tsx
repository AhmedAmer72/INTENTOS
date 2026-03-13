import { CheckCircle2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

export function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: { id: string; label: string }[];
  current: number;
  onSelect?: (index: number) => void;
}) {
  const progress = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute top-3 right-6 left-6 h-px bg-border" />
        <div
          className="absolute top-3 left-6 h-px bg-primary transition-all"
          style={{ width: `calc(${progress}% - 0px)` }}
        />
        <ol className="relative grid grid-cols-5">
          {steps.map((step, i) => {
            const done = i < current;
            const active = i === current;
            const clickable = Boolean(onSelect) && i <= current;
            return (
              <li className="flex flex-col items-center gap-1.5" key={step.id}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onSelect?.(i)}
                  className="flex flex-col items-center gap-1.5 disabled:cursor-default"
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full bg-card font-semibold text-xs transition-colors",
                      done && "bg-primary text-primary-foreground",
                      active && "border-2 border-primary text-primary",
                      !done && !active && "border border-border text-muted-foreground",
                    )}
                  >
                    {done ? <CheckCircle2Icon className="size-3.5" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-medium sm:text-xs",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
