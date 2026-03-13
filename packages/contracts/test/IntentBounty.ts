import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
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

describe("IntentBounty", () => {
  async function setup() {
    const [admin, oracle, principal, agentB] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("IntentRegistry");
    const registry = await Registry.deploy(admin.address, oracle.address);
    await registry.waitForDeployment();
    const Bounty = await ethers.getContractFactory("IntentBounty");
    const bounty = await Bounty.deploy(await registry.getAddress());
    await bounty.waitForDeployment();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const address = await registry.getAddress();
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("bounty-intent"));
    const actionHash = ethers.keccak256(ethers.toUtf8Bytes("bounty-action"));
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    await registry.registerIntent(
      {
        intentHash,
        principal: principal.address,
        agentId: ZERO,
        createdAt: now,
        expiresAt: now + 3600n,
        status: 0,
      },
      0n,
      await principal.signTypedData(domain(chainId, address), intentRegistrationTypes, {
        intentHash,
        principal: principal.address,
        agentId: ZERO,
        createdAt: now,
        expiresAt: now + 3600n,
        nonce: 0n,
      }),
    );
    return {
      bounty,
      registry,
      oracle,
      principal,
      agentB,
      intentHash,
      actionHash,
      chainId,
      address,
      now,
    };
  }

  it("releases the bounty only after APPROVE", async () => {
    const { bounty, registry, oracle, principal, agentB, intentHash, actionHash, chainId, address, now } =
      await setup();
    const amount = ethers.parseEther("0.01");
    await bounty.connect(principal).fund(intentHash, actionHash, { value: amount });
    await expect(bounty.claim(intentHash, actionHash, agentB.address)).to.be.revertedWithCustomError(
      bounty,
      "IntentNotApproved",
    );

    const evidenceRoot = ethers.keccak256(ethers.toUtf8Bytes("ev"));
    const binding = ethers.keccak256(ethers.toUtf8Bytes("bind"));
    const expiry = now + 3600n;
    const v = {
      actionHash,
      evidenceRoot,
      verdict: 1,
      alignmentBps: 9000,
      confidenceBps: 9000,
      timestamp: 0,
      settlementBinding: binding,
    };
    const oracleSig = await oracle.signTypedData(domain(chainId, address), verificationAttestationTypes, {
      intentId: intentHash,
      intentHash,
      agentId: ZERO,
      actionHash,
      evidenceRoot,
      verdict: 1,
      alignmentBps: 9000,
      confidenceBps: 9000,
      nonce: 0n,
      expiry,
      settlementBinding: binding,
    });
    await registry.connect(oracle).recordVerification(intentHash, v, 0n, expiry, intentHash, ZERO, oracleSig);

    const before = await ethers.provider.getBalance(agentB.address);
    await bounty.claim(intentHash, actionHash, agentB.address);
    expect(await ethers.provider.getBalance(agentB.address)).to.equal(before + amount);
  });

  it("refunds the funder after invalidate", async () => {
    const { bounty, registry, principal, intentHash, actionHash } = await setup();
    const amount = ethers.parseEther("0.005");
    await bounty.connect(principal).fund(intentHash, actionHash, { value: amount });
    await registry.connect(principal).invalidateIntent(intentHash);
    await expect(bounty.connect(principal).refund(intentHash, actionHash)).to.emit(bounty, "Refunded");
  });

  it("refunds after expiry without APPROVE", async () => {
    const { bounty, principal, intentHash, actionHash } = await setup();
    await bounty.connect(principal).fund(intentHash, actionHash, { value: ethers.parseEther("0.002") });
    await time.increase(3601);
    await bounty.connect(principal).refund(intentHash, actionHash);
  });
});
