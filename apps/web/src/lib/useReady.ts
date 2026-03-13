import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { targetChain } from "@/lib/chains";
import type { Meta, Ready } from "@/lib/types";

/**
 * Shared /ready + /meta probe for the transactional pages.
 *
 * `live` is deliberately `ready?.ok === true`: when the API is unreachable the
 * probe result is unknown, and treating unknown as live let users start flows
 * that could only fail later.
 */
export function useReady(pollMs = 15_000) {
  const [ready, setReady] = useState<Ready | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [probing, setProbing] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setReady(await api<Ready>("/ready"));
      setApiError(null);
    } catch (err) {
      setReady(null);
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setProbing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    api<Meta>("/meta")
      .then(setMeta)
      .catch(() => setMeta(null));
    if (!pollMs) return;
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  const chainMismatch = Boolean(meta && meta.chainId !== targetChain.id);

  return {
    ready,
    meta,
    apiError,
    probing,
    chainMismatch,
    live: ready?.ok === true && !chainMismatch,
    blockers: ready?.checks.filter((c) => c.required && !c.ok) ?? [],
    explorer: meta?.explorer ?? ready?.explorer,
    refresh,
  };
}
