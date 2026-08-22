import { motion } from "motion/react";
import type { Constraint } from "@/lib/types";

export function ConstraintChips({
  hard,
  soft,
}: {
  hard: Constraint[];
  soft: Constraint[];
}) {
  const items = [
    ...hard.map((c) => ({ ...c, kind: "hard" as const })),
    ...soft.map((c) => ({ ...c, kind: "soft" as const })),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((c, i) => (
        <motion.span
          key={c.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className={`rounded-full border px-3 py-1 text-[11px] tracking-wide ${
            c.kind === "hard"
              ? "border-brass/30 bg-brass/10 text-white"
              : "border-white/10 text-mute"
          }`}
        >
          <span className="mr-2 uppercase text-[9px] tracking-[0.16em] text-mute">
            {c.kind}
          </span>
          {c.label}
        </motion.span>
      ))}
    </div>
  );
}
