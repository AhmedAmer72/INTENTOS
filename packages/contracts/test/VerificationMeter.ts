import { expect } from "chai";
import { ethers } from "hardhat";

describe("VerificationMeter", () => {
  async function deploy() {
    const [admin, settler, user, stranger] = await ethers.getSigners();
    const price = ethers.parseEther("0.0001");
    const Meter = await ethers.getContractFactory("VerificationMeter");
    const meter = await Meter.deploy(admin.address, settler.address, price);
    await meter.waitForDeployment();
    return { meter, admin, settler, user, stranger, price };
  }

  it("deposits native 0G as credits", async () => {
    const { meter, user } = await deploy();
    await meter.connect(user).deposit({ value: ethers.parseEther("0.01") });
    expect(await meter.credits(user.address)).to.equal(ethers.parseEther("0.01"));
  });

  it("settler debits after a verify", async () => {
    const { meter, settler, user, price } = await deploy();
    await meter.connect(user).deposit({ value: ethers.parseEther("0.01") });
    const intentId = ethers.keccak256(ethers.toUtf8Bytes("intent"));
    await expect(meter.connect(settler).debit(user.address, price, intentId))
      .to.emit(meter, "Debited")
      .withArgs(user.address, price, intentId);
    expect(await meter.credits(user.address)).to.equal(ethers.parseEther("0.01") - price);
  });

  it("reverts InsufficientCredits", async () => {
    const { meter, settler, user, price } = await deploy();
    const intentId = ethers.ZeroHash;
    await expect(meter.connect(settler).debit(user.address, price, intentId)).to.be.revertedWithCustomError(
      meter,
      "InsufficientCredits",
    );
  });

  it("rejects debit from a non-settler", async () => {
    const { meter, user, stranger, price } = await deploy();
    await meter.connect(user).deposit({ value: ethers.parseEther("0.01") });
    await expect(
      meter.connect(stranger).debit(user.address, price, ethers.ZeroHash),
    ).to.be.reverted;
  });

  it("lets the depositor withdraw unused credits", async () => {
    const { meter, user } = await deploy();
    await meter.connect(user).deposit({ value: ethers.parseEther("0.01") });
    await meter.connect(user).withdraw(ethers.parseEther("0.004"));
    expect(await meter.credits(user.address)).to.equal(ethers.parseEther("0.006"));
  });
});
