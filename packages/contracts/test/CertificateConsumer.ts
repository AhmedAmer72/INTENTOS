import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  intentRegistrationTypes,
  verificationAttestationTypes,
} from "./eip712";

const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";

describe("CertificateConsumer", () => {
  async function approvePair() {
    const [admin, oracle, principal] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("IntentRegistry");
    const registry = await Registry.deploy(admin.address, oracle.address);
    await registry.waitForDeployment();
    const Consumer = await ethers.getContractFactory("CertificateConsumer");
    const consumer = await Consumer.deploy(await registry.getAddress());
    await consumer.waitForDeployment();

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const address = await registry.getAddress();
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("cert-intent"));
    const actionHash = ethers.keccak256(ethers.toUtf8Bytes("cert-action"));
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const domain = {
      name: EIP712_DOMAIN_NAME,
      version: EIP712_DOMAIN_VERSION,
      chainId,
      verifyingContract: address,
    };
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
      await principal.signTypedData(domain, intentRegistrationTypes, {
        intentHash,
        principal: principal.address,
        agentId: ZERO,
        createdAt: now,
        expiresAt: now + 86400n,
        nonce: 0n,
      }),
    );
    const amount = ethers.parseEther("0.0001");
    const settlementBinding = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "uint256"],
        [intentHash, actionHash, amount],
      ),
    );
    const expiry = now + 3600n;
    await registry.connect(oracle).recordVerification(
      intentHash,
      {
        actionHash,
        evidenceRoot: ethers.keccak256(ethers.toUtf8Bytes("ev")),
        verdict: 1,
        alignmentBps: 9000,
        confidenceBps: 9000,
        timestamp: 0,
        settlementBinding,
      },
      0n,
      expiry,
      intentHash,
      ZERO,
      await oracle.signTypedData(domain, verificationAttestationTypes, {
        intentId: intentHash,
        intentHash,
        agentId: ZERO,
        actionHash,
        evidenceRoot: ethers.keccak256(ethers.toUtf8Bytes("ev")),
        verdict: 1,
        alignmentBps: 9000,
        confidenceBps: 9000,
        nonce: 0n,
        expiry,
        settlementBinding,
      }),
    );
    return { consumer, intentHash, actionHash, principal };
  }

  it("accepts an approved certificate once", async () => {
    const { consumer, intentHash, actionHash } = await approvePair();
    await expect(consumer.accept(intentHash, actionHash)).to.emit(consumer, "CredentialAccepted");
    await expect(consumer.accept(intentHash, actionHash)).to.be.revertedWithCustomError(
      consumer,
      "AlreadyConsumed",
    );
  });

  it("reverts when the pair is not approved", async () => {
    const { consumer } = await approvePair();
    await expect(consumer.accept(ethers.ZeroHash, ethers.ZeroHash)).to.be.revertedWithCustomError(
      consumer,
      "IntentNotApproved",
    );
  });
});
