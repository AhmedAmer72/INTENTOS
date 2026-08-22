"use client";

import * as React from "react";

import { RadioGroup as RadixRadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

type GroupProps = React.ComponentProps<typeof RadixRadioGroup> & { name?: string };

export function RadioGroup({ name, value, defaultValue, onValueChange, children, className, ...props }: GroupProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const current = value ?? internal;

  return (
    <RadixRadioGroup
      className={cn(className)}
      value={current}
      defaultValue={defaultValue}
      onValueChange={(next) => {
        setInternal(next);
        onValueChange?.(next);
      }}
      {...props}
    >
      {name ? <input type="hidden" name={name} value={current} /> : null}
      {children}
    </RadixRadioGroup>
  );
}

export const Radio = RadioGroupItem;
