import { motion } from "motion/react";

export function VerdictStamp({
  verdict,
}: {
  verdict: "APPROVE" | "REJECT" | "CHALLENGE";
}) {
  const tone =
    verdict === "APPROVE"
      ? "border-brass/70 text-brass shadow-[0_0_40px_rgba(192,105,255,0.28)]"
      : verdict === "REJECT"
        ? "border-reject/70 text-reject shadow-[0_0_40px_rgba(251,113,133,0.2)]"
        : "border-challenge/70 text-challenge";

  return (
    <motion.div
      initial={{ scale: 1.35, rotate: -12, opacity: 0 }}
      animate={{ scale: 1, rotate: -6, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className={`inline-flex select-none items-center justify-center rounded-2xl border-2 px-6 py-3 font-serif text-3xl italic tracking-wide ${tone}`}
    >
      {verdict}
    </motion.div>
  );
}
