import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export const LOGO_SRC = "/logo.png";

export function BrandMark({
  size = 36,
  wordmark = true,
  to = "/",
  className,
}: {
  size?: number;
  wordmark?: boolean;
  to?: string | null;
  className?: string;
}) {
  const mark = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src={LOGO_SRC}
        alt=""
        height={size}
        width={Math.round(size * 1.22)}
        className="shrink-0 object-contain mix-blend-screen"
        style={{ height: size, width: "auto", maxHeight: size }}
      />
      {wordmark && (
        <span className="text-[15px] font-semibold tracking-[0.18em] text-white">INTENTOS</span>
      )}
    </span>
  );

  if (!to) return mark;
  return (
    <Link to={to} className="shrink-0" aria-label="INTENTOS home">
      {mark}
    </Link>
  );
}
