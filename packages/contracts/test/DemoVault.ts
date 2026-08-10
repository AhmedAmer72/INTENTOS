import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  intentRegistrationTypes,
  verificationAttestationTypes,
} from "./eip712";

const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";

describe("DemoVault", () => {
  async function setup(verdict: number, amount: bigint) {
    const [admin, oracle, principal] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("IntentRegistry");
    const registry = await Registry.deploy(admin.address, oracle.address);
    await registry.waitForDeployment();
    const Vault = await ethers.getContractFactory("DemoVault");
    const vault = await Vault.deploy(await registry.getAddress());
    await vault.waitForDeployment();

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const address = await registry.getAddress();
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("vault-intent"));
    const actionHash = ethers.keccak256(ethers.toUtf8Bytes("vault-action"));
    const evidenceRoot = ethers.keccak256(ethers.toUtf8Bytes("vault-evidence"));
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

    const settlementBinding = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "uint256"],
        [intentHash, actionHash, amount],
      ),
    );
    const expiry = now + 3600n;
    const v = {
      actionHash,
      evidenceRoot,
      verdict,
      alignmentBps: 9000,
      confidenceBps: 9000,
      timestamp: 0,
      settlementBinding,
    };
    const oracleSig = await oracle.signTypedData(domain, verificationAttestationTypes, {
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
      settlementBinding,
    });
    await registry
      .connect(oracle)
      .recordVerification(intentHash, v, 0n, expiry, intentHash, ZERO, oracleSig);

    return { vault, intentHash, actionHash, principal };
  }

  it("reverts with IntentNotApproved when the action was rejected", async () => {
    const { vault, intentHash, actionHash } = await setup(2, 0n);
    await expect(vault.deposit(intentHash, actionHash)).to.be.revertedWithCustomError(
      vault,
      "IntentNotApproved",
    );
  });

  it("reverts with IntentNotApproved when unverified", async () => {
    const [admin, oracle] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("IntentRegistry");
    const registry = await Registry.deploy(admin.address, oracle.address);
    const Vault = await ethers.getContractFactory("DemoVault");
    const vault = await Vault.deploy(await registry.getAddress());
    const fake = ethers.keccak256(ethers.toUtf8Bytes("nope"));
    await expect(vault.deposit(fake, fake)).to.be.revertedWithCustomError(vault, "IntentNotApproved");
  });

  it("settles when approved and the binding matches msg.value", async () => {
    const value = ethers.parseEther("0.001");
    const { vault, intentHash, actionHash } = await setup(1, value);
    await expect(vault.deposit(intentHash, actionHash, { value }))
      .to.emit(vault, "Settled")
      .withArgs(intentHash, actionHash, (await ethers.getSigners())[0].address, value);
  });

  it("reverts BindingMismatch on hash substitution of the amount", async () => {
    const { vault, intentHash, actionHash } = await setup(1, 0n);
    await expect(
      vault.deposit(intentHash, actionHash, { value: ethers.parseEther("1") }),
    ).to.be.revertedWithCustomError(vault, "BindingMismatch");
  });
});
