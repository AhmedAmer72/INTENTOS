import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  intentRegistrationTypes,
  verificationAttestationTypes,
} from "./eip712";

const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";

function domain(chainId: bigint, verifyingContract: string) {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId,
    verifyingContract,
  };
}

describe("IntentRegistry", () => {
  async function deploy() {
    const [admin, oracle, principal, stranger] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("IntentRegistry");
    const registry = await Registry.deploy(admin.address, oracle.address);
    await registry.waitForDeployment();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const address = await registry.getAddress();
    return { registry, admin, oracle, principal, stranger, chainId, address };
  }

  it("registers an intent with a valid EIP-712 signature", async () => {
    const { registry, principal, chainId, address } = await deploy();
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent-a"));
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const record = {
      intentHash,
      principal: principal.address,
      agentId: ZERO,
      createdAt: now,
      expiresAt: now + 86400n,
      status: 0,
    };
    const nonce = 0n;
    const sig = await principal.signTypedData(
      domain(chainId, address),
      intentRegistrationTypes,
      {
        intentHash: record.intentHash,
        principal: record.principal,
        agentId: record.agentId,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        nonce,
      },
    );
    await expect(registry.registerIntent(record, nonce, sig)).to.emit(registry, "IntentRegistered");
    const stored = await registry.getIntent(intentHash);
    expect(stored.status).to.equal(1);
    expect(stored.principal).to.equal(principal.address);
  });

  it("rejects a replayed registration nonce", async () => {
    const { registry, principal, chainId, address } = await deploy();
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent-b"));
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const record = {
      intentHash,
      principal: principal.address,
      agentId: ZERO,
      createdAt: now,
      expiresAt: now + 86400n,
      status: 0,
    };
    const sig = await principal.signTypedData(domain(chainId, address), intentRegistrationTypes, {
      intentHash: record.intentHash,
      principal: record.principal,
      agentId: record.agentId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      nonce: 0n,
    });
    await registry.registerIntent(record, 0n, sig);
    await expect(registry.registerIntent(record, 0n, sig)).to.be.reverted;
  });

  it("rejects a signature from the wrong principal", async () => {
    const { registry, principal, stranger, chainId, address } = await deploy();
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent-c"));
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const record = {
      intentHash,
      principal: principal.address,
      agentId: ZERO,
      createdAt: now,
      expiresAt: now + 86400n,
      status: 0,
    };
    const sig = await stranger.signTypedData(domain(chainId, address), intentRegistrationTypes, {
      intentHash: record.intentHash,
      principal: record.principal,
      agentId: record.agentId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      nonce: 0n,
    });
    await expect(registry.registerIntent(record, 0n, sig)).to.be.revertedWithCustomError(
      registry,
      "InvalidSigner",
    );
  });

  it("records an oracle verification and reports isApproved", async () => {
    const { registry, oracle, principal, chainId, address } = await deploy();
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent-d"));
    const actionHash = ethers.keccak256(ethers.toUtf8Bytes("action-d"));
    const evidenceRoot = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const record = {
      intentHash,
      principal: principal.address,
      agentId: ZERO,
      createdAt: now,
      expiresAt: now + 86400n,
      status: 0,
    };
    const sig = await principal.signTypedData(domain(chainId, address), intentRegistrationTypes, {
      intentHash,
      principal: principal.address,
      agentId: ZERO,
      createdAt: now,
      expiresAt: now + 86400n,
      nonce: 0n,
    });
    await registry.registerIntent(record, 0n, sig);

    const amount = 0n;
    const settlementBinding = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "uint256"],
        [intentHash, actionHash, amount],
      ),
    );
    const v = {
      actionHash,
      evidenceRoot,
      verdict: 1,
      alignmentBps: 9840,
      confidenceBps: 9720,
      timestamp: 0,
      settlementBinding,
    };
    const expiry = now + 3600n;
    const oracleSig = await oracle.signTypedData(
      domain(chainId, address),
      verificationAttestationTypes,
      {
        intentId: intentHash,
        intentHash,
        agentId: ZERO,
        actionHash,
        evidenceRoot,
        verdict: 1,
        alignmentBps: 9840,
        confidenceBps: 9720,
        nonce: 0n,
        expiry,
        settlementBinding,
      },
    );
    await registry
      .connect(oracle)
      .recordVerification(intentHash, v, 0n, expiry, intentHash, ZERO, oracleSig);
    expect(await registry.isApproved(intentHash, actionHash)).to.equal(true);
  });

  it("does not approve REJECT verdicts", async () => {
    const { registry, oracle, principal, chainId, address } = await deploy();
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent-e"));
    const actionHash = ethers.keccak256(ethers.toUtf8Bytes("action-e"));
    const evidenceRoot = ethers.keccak256(ethers.toUtf8Bytes("evidence-e"));
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const record = {
      intentHash,
      principal: principal.address,
      agentId: ZERO,
      createdAt: now,
      expiresAt: now + 86400n,
      status: 0,
    };
    const sig = await principal.signTypedData(domain(chainId, address), intentRegistrationTypes, {
      intentHash,
      principal: principal.address,
      agentId: ZERO,
      createdAt: now,
      expiresAt: now + 86400n,
      nonce: 0n,
    });
    await registry.registerIntent(record, 0n, sig);
    const settlementBinding = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "uint256"],
        [intentHash, actionHash, 0n],
      ),
    );
    const expiry = now + 3600n;
    const v = {
      actionHash,
      evidenceRoot,
      verdict: 2,
      alignmentBps: 2100,
      confidenceBps: 9000,
      timestamp: 0,
      settlementBinding,
    };
    const oracleSig = await oracle.signTypedData(
      domain(chainId, address),
      verificationAttestationTypes,
      {
        intentId: intentHash,
        intentHash,
        agentId: ZERO,
        actionHash,
        evidenceRoot,
        verdict: 2,
        alignmentBps: 2100,
        confidenceBps: 9000,
        nonce: 0n,
        expiry,
        settlementBinding,
      },
    );
    await registry
      .connect(oracle)
      .recordVerification(intentHash, v, 0n, expiry, intentHash, ZERO, oracleSig);
    expect(await registry.isApproved(intentHash, actionHash)).to.equal(false);
  });
});
