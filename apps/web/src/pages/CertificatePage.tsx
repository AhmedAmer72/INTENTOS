import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import canonicalize from "canonicalize";
import { BrandMark } from "@/components/BrandMark";
import { keccak256, stringToBytes } from "viem";
import { ApiError, api } from "@/lib/api";
import { GiveFeedback } from "@/components/GiveFeedback";
import { HashField } from "@/components/HashField";
import { PresentCertificate } from "@/components/PresentCertificate";
import type { Meta } from "@/lib/types";

type Cert = {
  serial: number;
  intentId: string;
  intentHash: string;
  actionHash: string;
  decisionHash: string;
  evidenceRoot: string;
  principal: string;
  agentId: string;
  objective: string;
  requestedCapital: string;
  actualCapital: string;
  requestedDuration: string;
  actualDuration: string;
  leverage: string;
  risk: string;
  alignmentScore: number;
  confidence: number;
  hardViolations: number;
  verdict: string;
  timestamp: number;
  chainId: number;
  explorerUrl?: string;
  storageRoot?: string;
  computeProvider?: string;
  teeAttested?: boolean;
  registerTxHash?: string;
  verifyTxHash?: string;
  settleTxHash?: string;
  agenticToken?: string;
  agenticUri?: string;
};

type Proof = {
  verification: { verdict: string; actionHash: string };
  evidence: unknown;
  evidenceRoot: string;
  localHash: string;
  contentHash?: string | null;
  matches: boolean;
  storageMatch?: boolean | null;
  storageError?: string | null;
  explorer: string;
  registerTxHash?: string | null;
  verifyTxHash?: string | null;
  settleTxHash?: string | null;
  reputationTx?: string | null;
  meterTx?: string | null;
  envelopeRoot?: string | null;
};

export function CertificatePage() {
  const { hash } = useParams<{ hash: string }>();
  const [cert, setCert] = useState<Cert | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [clientHash, setClientHash] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!hash) return;
    const decoded = decodeURIComponent(hash);
    Promise.all([
      api<Proof>(`/proof/${decoded}`),
      api<Cert>(`/certificate/action/${encodeURIComponent(decoded)}`).catch(() => null),
      api<Meta>("/meta").catch(() => null),
    ])
      .then(([p, c, m]) => {
        setProof(p);
        setCert(c);
        setMeta(m);
        try {
          setClientHash(keccak256(stringToBytes(canonicalize(p.evidence) ?? "")));
        } catch {
          setClientHash("");
        }
      })
      .catch((e: unknown) => {
        setNotFound(e instanceof ApiError && e.status === 404);
        setErr(e instanceof Error ? e.message : String(e));
      });
  }, [hash]);

  const contentMatch = useMemo(() => {
    if (!proof || !clientHash) return null;
    return clientHash === proof.localHash || (proof.contentHash ? clientHash === proof.contentHash : false);
  }, [proof, clientHash]);

  if (err) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Certificate</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {notFound ? "No certificate for this action" : "Certificate could not be loaded"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {notFound
            ? "A certificate is minted when a verify completes. Check the action hash in the URL, or run a verify in Gate first."
            : err}
        </p>
        <Link
          className="mt-6 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          to="/studio"
        >
          Go to Gate
        </Link>
      </div>
    );
  }
  if (!proof) return <p className="p-10 text-center text-mute">Loading certificate…</p>;

  const v = cert?.verdict ?? proof.verification.verdict;

  return (
    <div className="px-4 py-10 sm:py-14">
      <article className="mx-auto max-w-3xl rounded-[2rem] border border-[#231233]/10 bg-paper p-8 text-[#231233] shadow-[0_20px_80px_rgba(12,4,20,0.55)] sm:p-12">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] opacity-50">
          <BrandMark size={22} wordmark={false} to={null} /> Intent Certificate
        </p>
        <h1 className="mt-2 font-serif text-4xl italic">
          INTENTOS #{String(cert?.serial ?? 0).padStart(6, "0")}
        </h1>
        <p className="mt-2 text-sm opacity-70">{cert?.objective ?? "Verified intent execution"}</p>

        <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
          <Field k="Principal" v={cert?.principal} />
          <Field k="Agent" v={cert?.agentId} />
          <Field k="Requested capital" v={cert?.requestedCapital} />
          <Field k="Actual capital" v={cert?.actualCapital} />
          <Field k="Requested duration" v={cert?.requestedDuration} />
          <Field k="Actual duration" v={cert?.actualDuration} />
          <Field k="Leverage" v={cert?.leverage} />
          <Field k="Risk" v={cert?.risk} />
          <Field k="Alignment" v={cert ? `${(cert.alignmentScore * 100).toFixed(1)}%` : "—"} />
          <Field k="Hard violations" v={String(cert?.hardViolations ?? "—")} />
        </div>

        <p className={`mt-10 font-serif text-3xl italic ${v === "APPROVE" ? "" : "text-reject"}`}>
          {v === "APPROVE" ? "Verified" : v}
        </p>
        <p className="mt-2 text-sm opacity-70">
          {v === "APPROVE" ? (
            <>This stamp can settle. If you have not deposited yet, go back to Gate and press Deposit.</>
          ) : (
            <>
              This plan cannot settle.{" "}
              <Link className="underline" to="/studio">
                Back to Gate — replan, then verify
              </Link>
              .
            </>
          )}
        </p>

        <div className="mt-8 space-y-3 border-t border-ink/20 pt-6">
          <HashField label="Intent hash" value={cert?.intentHash} />
          <HashField label="Action hash" value={proof.verification.actionHash} />
          <HashField label="0G Storage merkle root" value={proof.evidenceRoot} />
          {proof.envelopeRoot && <HashField label="Envelope root" value={proof.envelopeRoot} />}
          <HashField label="Evidence content hash" value={proof.localHash} />
          <HashField label="Client re-hash" value={clientHash || undefined} />
          <Field
            k="Integrity"
            v={
              contentMatch === null
                ? "computing"
                : contentMatch
                  ? "MATCH — evidence JSON re-hashes to the recorded content hash"
                  : "MISMATCH — indexed evidence does not match the recorded content hash"
            }
          />
          <Field
            k="0G Storage download"
            v={
              proof.storageMatch === true
                ? "MATCH — re-downloaded blob hashes to the indexed evidence"
                : proof.storageMatch === false
                  ? "MISMATCH — storage blob differs from the index"
                  : proof.storageError
                    ? `Not retrieved — ${proof.storageError}`
                    : "Not checked this request"
            }
          />
          {cert?.computeProvider && <Field k="TEE provider" v={cert.computeProvider} />}
          {typeof cert?.teeAttested === "boolean" && (
            <Field k="TEE attested" v={cert.teeAttested ? "yes" : "no"} />
          )}
          {cert?.agenticToken && <Field k="Agentic ID" v={`#${cert.agenticToken}`} />}
          {cert?.agenticUri && (
            <p className="text-xs">
              <a className="underline" href={cert.agenticUri} target="_blank" rel="noreferrer">
                Agentic ID on explorer
              </a>
            </p>
          )}
        </div>

        <div className="mt-8 space-y-3">
          <GiveFeedback
            agentId={cert?.agentId ?? meta?.agentId}
            verdict={v}
            actionHash={proof.verification.actionHash}
            evidenceHash={proof.localHash}
            identityRegistry={meta?.identityRegistry}
            reputationRegistry={meta?.reputationRegistry}
            explorer={proof.explorer}
          />
          {v === "APPROVE" && (
            <PresentCertificate
              consumer={meta?.consumer}
              intentId={cert?.intentId}
              actionHash={proof.verification.actionHash}
              explorer={proof.explorer}
            />
          )}
        </div>

        <p className="mt-10 text-xs opacity-60">
          Chain {cert?.chainId ?? "—"} · Storage root is a 0G merkle commitment, not keccak.
          {proof.explorer && (
            <>
              {" "}
              <a className="underline" href={proof.explorer} target="_blank" rel="noreferrer">
                0G explorer
              </a>
            </>
          )}
          {proof.registerTxHash && proof.explorer && (
            <>
              {" · "}
              <a className="underline" href={`${proof.explorer}/tx/${proof.registerTxHash}`} target="_blank" rel="noreferrer">
                register tx
              </a>
            </>
          )}
          {proof.verifyTxHash && proof.explorer && (
            <>
              {" · "}
              <a className="underline" href={`${proof.explorer}/tx/${proof.verifyTxHash}`} target="_blank" rel="noreferrer">
                attestation tx
              </a>
            </>
          )}
          {(proof.settleTxHash || cert?.settleTxHash) && proof.explorer && (
            <>
              {" · "}
              <a
                className="underline"
                href={`${proof.explorer}/tx/${proof.settleTxHash ?? cert?.settleTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                settle tx
              </a>
            </>
          )}
          {proof.reputationTx && proof.explorer && (
            <>
              {" · "}
              <a className="underline" href={`${proof.explorer}/tx/${proof.reputationTx}`} target="_blank" rel="noreferrer">
                reputation tx
              </a>
            </>
          )}
          {proof.meterTx && proof.explorer && (
            <>
              {" · "}
              <a className="underline" href={`${proof.explorer}/tx/${proof.meterTx}`} target="_blank" rel="noreferrer">
                meter tx
              </a>
            </>
          )}
        </p>
        <Link className="mt-8 inline-block text-xs tracking-wide opacity-60 hover:opacity-100" to="/studio">
          Return to studio
        </Link>
      </article>
    </div>
  );
}

function Field({ k, v }: { k: string; v?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.18em] opacity-50">{k}</dt>
      <dd className="break-words">{v ?? "—"}</dd>
    </div>
  );
}
