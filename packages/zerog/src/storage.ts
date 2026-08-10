import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import { resolveNetwork, type ZeroGNetworkName } from "./networks.js";

export type StorageConfig = {
  network: ZeroGNetworkName;
  privateKey: `0x${string}`;
  rpcUrl?: string;
  indexerUrl?: string;
};

export type UploadResult = {
  rootHash: string;
  txHash?: string;
};

function indexerOf(cfg: StorageConfig) {
  const net = resolveNetwork(cfg.network);
  return {
    indexer: new Indexer(cfg.indexerUrl ?? net.storageIndexer),
    rpc: cfg.rpcUrl ?? net.rpc,
    net,
  };
}

function signerOf(cfg: StorageConfig, rpc: string) {
  const provider = new ethers.JsonRpcProvider(rpc);
  return new ethers.Wallet(cfg.privateKey, provider);
}

export async function uploadJson(cfg: StorageConfig, value: unknown): Promise<UploadResult> {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  return uploadBytes(cfg, body);
}

export async function uploadBytes(cfg: StorageConfig, data: Uint8Array): Promise<UploadResult> {
  const { indexer, rpc } = indexerOf(cfg);
  const signer = signerOf(cfg, rpc);
  const file = new MemData(Buffer.from(data));
  const [tree, treeErr] = await file.merkleTree();
  if (treeErr) throw new Error(String(treeErr));
  const rootHash = tree?.rootHash();
  if (!rootHash) throw new Error("merkle tree produced no root hash");
  const [tx, uploadErr] = await indexer.upload(file, rpc, signer);
  if (uploadErr) throw new Error(String(uploadErr));
  const txHash =
    tx && typeof tx === "object" && "txHash" in tx
      ? String((tx as { txHash: string }).txHash)
      : typeof tx === "string"
        ? tx
        : undefined;
  return { rootHash, txHash };
}

export async function downloadBytes(cfg: StorageConfig, rootHash: string): Promise<Buffer> {
  const { indexer } = indexerOf(cfg);
  const tmpName = `intentos-${rootHash.slice(2, 10)}-${Date.now()}`;
  const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "intentos-"));
  const out = join(dir, tmpName);
  try {
    const err = await indexer.download(rootHash, out, true);
    if (err) throw new Error(String(err));
    return readFileSync(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function downloadJson<T>(cfg: StorageConfig, rootHash: string): Promise<T> {
  const buf = await downloadBytes(cfg, rootHash);
  return JSON.parse(buf.toString("utf8")) as T;
}

/** Merkle-root preview without paying for upload — useful in tests. */
export async function merkleRootOf(data: Uint8Array): Promise<string> {
  const file = new MemData(Buffer.from(data));
  const [tree, treeErr] = await file.merkleTree();
  if (treeErr) throw new Error(String(treeErr));
  const root = tree?.rootHash();
  if (!root) throw new Error("no root");
  return root;
}
