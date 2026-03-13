import { config as loadEnv } from "dotenv";
import { createCipheriv, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import canonicalize from "canonicalize";
import hre from "hardhat";

loadEnv({ path: resolve(__dirname, "../../../.env") });

function storageEndpoints() {
  const mainnet = hre.network.name === "mainnet";
  return {
    indexer: mainnet
      ? (process.env.ZEROG_STORAGE_INDEXER_MAINNET ?? "https://indexer-storage-turbo.0g.ai")
      : (process.env.ZEROG_STORAGE_INDEXER_TESTNET ?? "https://indexer-storage-testnet-turbo.0g.ai"),
    rpc: mainnet
      ? (process.env.ZEROG_MAINNET_RPC ?? "https://evmrpc.0g.ai")
      : (process.env.ZEROG_TESTNET_RPC ?? "https://evmrpc-testnet.0g.ai"),
  };
}

function agentIdNumber(): number {
  const raw = process.env.AGENT_ID ?? "";
  if (!raw) throw new Error("AGENT_ID is required in Agentic ID metadata (mainnet id from register-agent).");
  const n = raw.startsWith("0x") ? Number(BigInt(raw)) : Number(raw);
  if (!Number.isFinite(n)) throw new Error("AGENT_ID must be a decimal or 0x hex id.");
  return n;
}

async function uploadCipher(privateKey: string, data: Buffer, indexerUrl: string, rpc: string): Promise<string> {
  const { Indexer, MemData } = await import("@0gfoundation/0g-storage-ts-sdk");
  const { ethers } = await import("ethers");
  const indexer = new Indexer(indexerUrl);
  const signer = new ethers.Wallet(privateKey, new ethers.JsonRpcProvider(rpc));
  const file = new MemData(data);
  const [tree, treeErr] = await file.merkleTree();
  if (treeErr) throw new Error(String(treeErr));
  const rootHash = tree?.rootHash();
  if (!rootHash) throw new Error("merkle tree produced no root hash");
  const [, uploadErr] = await indexer.upload(file, rpc, signer);
  if (uploadErr) throw new Error(String(uploadErr));
  return rootHash.startsWith("0x") ? rootHash : `0x${rootHash}`;
}

function encrypt(plain: Buffer) {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { blob: Buffer.concat([iv, tag, ciphertext]), key };
}

async function main() {
  const address = process.env.AGENTIC_ID_V2_ADDRESS;
  if (!address) throw new Error("AGENTIC_ID_V2_ADDRESS is required — deploy wave6 first");
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error("DEPLOYER_PRIVATE_KEY is required to pay 0G Storage and mint");

  const [deployer] = await hre.ethers.getSigners();
  const { indexer, rpc } = storageEndpoints();
  const metadata = {
    agentId: agentIdNumber(),
    name: "INTENTOS Reference Yield Agent",
    model: "qwen2.5-omni",
    standard: "ERC-8004",
    systemPromptHash: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("intentos-reference-agent")),
    createdAt: Math.floor(Date.now() / 1000),
  };
  const plaintext = Buffer.from(canonicalize(metadata) ?? JSON.stringify(metadata), "utf8");
  const metadataHash = hre.ethers.keccak256(plaintext);
  const { blob, key: aesKey } = encrypt(plaintext);
  console.log("Uploading encrypted metadata to 0G Storage…");
  const encryptedURI = await uploadCipher(key, blob, indexer, rpc);
  console.log("encryptedURI", encryptedURI);

  const nft = await hre.ethers.getContractAt("IntentosAgenticIdV2", address);
  const tx = await nft.mint(deployer.address, encryptedURI, metadataHash);
  const receipt = await tx.wait();
  let minted = 1n;
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = nft.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "MetadataSet") minted = parsed.args.tokenId as bigint;
    } catch {
      /* ignore */
    }
  }

  const file = resolve(__dirname, "../deployments", `${hre.network.name}.json`);
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  writeFileSync(
    file,
    JSON.stringify(
      {
        ...prev,
        IntentosAgenticIdV2: address,
        agenticV2TokenId: minted.toString(),
        agenticV2EncryptedURI: encryptedURI,
        agenticV2MetadataHash: metadataHash,
        agenticV2MintTx: receipt?.hash,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("tokenId", minted.toString());
  console.log("metadataHash", metadataHash);
  console.log("Set AGENTIC_ID_V2_TOKEN=" + minted.toString());
  console.log("AES-256-GCM key (operator only, do not commit):", aesKey.toString("hex"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
