import * as React from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function Field({
  name,
  className,
  children,
}: {
  name?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)} data-field={name}>
      {children}
    </div>
  );
}

export function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label className={cn("text-foreground", className)} {...props} />;
}

export function FieldError({ className, children }: { className?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return <p className={cn("text-destructive text-xs", className)}>{children}</p>;
}
