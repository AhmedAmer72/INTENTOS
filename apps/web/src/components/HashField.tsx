import { Copy, Check } from "lucide-react";
import { useState } from "react";

export function HashField({ label, value }: { label: string; value?: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!value) {
    return (
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-mute">{label}</p>
        <p className="font-mono text-[11px] opacity-50">—</p>
      </div>
    );
  }
  return (
    <div className="group">
      <p className="text-[10px] uppercase tracking-[0.18em] opacity-50">{label}</p>
      <p className="flex items-start gap-2 break-all font-mono text-[11px] leading-relaxed opacity-90">
        {value}
        <button
          type="button"
          className="mt-0.5 shrink-0 opacity-50 hover:opacity-100"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </p>
    </div>
  );
}
