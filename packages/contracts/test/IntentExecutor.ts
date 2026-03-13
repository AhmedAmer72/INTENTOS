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
const DELAY = 15 * 60;

function domain(chainId: bigint, verifyingContract: string) {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId,
    verifyingContract,
  };
}

describe("IntentExecutor", () => {
  async function setup(verdict: number, value: bigint, opts?: { delay?: number }) {
    const [admin, oracle, principal, stranger] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("IntentRegistry");
    const registry = await Registry.deploy(admin.address, oracle.address);
    await registry.waitForDeployment();
    const Target = await ethers.getContractFactory("SettlementTarget");
    const target = await Target.deploy();
    await target.waitForDeployment();
    const Executor = await ethers.getContractFactory("IntentExecutor");
    const executor = await Executor.deploy(await registry.getAddress(), opts?.delay ?? DELAY);
    await executor.waitForDeployment();

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const address = await registry.getAddress();
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("exec-intent"));
    const actionHash = ethers.keccak256(ethers.toUtf8Bytes("exec-action"));
    const evidenceRoot = ethers.keccak256(ethers.toUtf8Bytes("exec-evidence"));
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const pingData = target.interface.encodeFunctionData("ping", ["0x01"]);
    const binding = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "address", "bytes32", "uint256"],
        [intentHash, actionHash, await target.getAddress(), ethers.keccak256(pingData), value],
      ),
    );

    await registry.registerIntent(
      {
        intentHash,
        principal: principal.address,
        agentId: ZERO,
        createdAt: now,
        expiresAt: now + 86400n,
        status: 0,
      },
      0n,
      await principal.signTypedData(domain(chainId, address), intentRegistrationTypes, {
        intentHash,
        principal: principal.address,
        agentId: ZERO,
        createdAt: now,
        expiresAt: now + 86400n,
        nonce: 0n,
      }),
    );

    const expiry = now + 3600n;
    const v = {
      actionHash,
      evidenceRoot,
      verdict,
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
      verdict,
      alignmentBps: 9000,
      confidenceBps: 9000,
      nonce: 0n,
      expiry,
      settlementBinding: binding,
    });
    await registry.connect(oracle).recordVerification(intentHash, v, 0n, expiry, intentHash, ZERO, oracleSig);

    return { executor, target, registry, principal, stranger, intentHash, actionHash, pingData, value };
  }

  it("reverts IntentNotApproved when the action was rejected", async () => {
    const { executor, target, intentHash, actionHash, pingData } = await setup(2, 0n);
    await expect(
      executor.execute(intentHash, actionHash, await target.getAddress(), pingData),
    ).to.be.revertedWithCustomError(executor, "IntentNotApproved");
  });

  it("reverts ChallengePending before the delay elapses", async () => {
    const value = ethers.parseEther("0.001");
    const { executor, target, intentHash, actionHash, pingData } = await setup(1, value);
    await expect(
      executor.execute(intentHash, actionHash, await target.getAddress(), pingData, { value }),
    ).to.be.revertedWithCustomError(executor, "ChallengePending");
  });

  it("executes after the delay when the binding matches", async () => {
    const value = ethers.parseEther("0.001");
    const { executor, target, intentHash, actionHash, pingData } = await setup(1, value);
    await time.increase(DELAY + 1);
    await expect(executor.execute(intentHash, actionHash, await target.getAddress(), pingData, { value }))
      .to.emit(executor, "Executed");
    expect(await target.lastValue()).to.equal(value);
    expect(await target.lastCaller()).to.equal(await executor.getAddress());
  });

  it("reverts BindingMismatch on a substituted target", async () => {
    const { executor, intentHash, actionHash, pingData } = await setup(1, 0n);
    await time.increase(DELAY + 1);
    await expect(
      executor.execute(intentHash, actionHash, await executor.getAddress(), pingData),
    ).to.be.revertedWithCustomError(executor, "BindingMismatch");
  });

  it("blocks execute after the principal invalidates during the delay", async () => {
    const { executor, target, registry, principal, intentHash, actionHash, pingData } = await setup(1, 0n);
    await registry.connect(principal).invalidateIntent(intentHash);
    await time.increase(DELAY + 1);
    await expect(
      executor.execute(intentHash, actionHash, await target.getAddress(), pingData),
    ).to.be.revertedWithCustomError(executor, "IntentNotApproved");
  });
});
