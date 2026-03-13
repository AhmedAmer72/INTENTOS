import { config as loadEnv } from "dotenv";
import { createCipheriv, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import canonicalize from "canonicalize";
import hre from "hardhat";

loadEnv({ path: resolve(__dirname, "../../../.env") });

const INDEXER = process.env.ZEROG_STORAGE_INDEXER_TESTNET ?? "https://indexer-storage-testnet-turbo.0g.ai";
const RPC = process.env.ZEROG_TESTNET_RPC ?? "https://evmrpc-testnet.0g.ai";

async function uploadCipher(privateKey: string, data: Buffer): Promise<string> {
  const { Indexer, MemData } = await import("@0gfoundation/0g-storage-ts-sdk");
  const { ethers } = await import("ethers");
  const indexer = new Indexer(INDEXER);
  const signer = new ethers.Wallet(privateKey, new ethers.JsonRpcProvider(RPC));
  const file = new MemData(data);
  const [tree, treeErr] = await file.merkleTree();
  if (treeErr) throw new Error(String(treeErr));
  const rootHash = tree?.rootHash();
  if (!rootHash) throw new Error("merkle tree produced no root hash");
  const [, uploadErr] = await indexer.upload(file, RPC, signer);
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
  const metadata = {
    agentId: 361,
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
  const encryptedURI = await uploadCipher(key, blob);
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

  const file = resolve(__dirname, "../deployments/galileo.json");
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
