import { expect } from "chai";
import { ethers } from "hardhat";

describe("IntentosAgenticId", () => {
  it("mints encrypted metadata and authorizes an executor", async () => {
    const [owner, holder, executor] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("IntentosAgenticId");
    const nft = await Factory.deploy();
    await nft.waitForDeployment();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("meta"));
    const tx = await nft.mint(holder.address, "0g://root", hash);
    const receipt = await tx.wait();
    const tokenId = 1n;
    expect(await nft.ownerOf(tokenId)).to.equal(holder.address);
    expect(await nft.getEncryptedURI(tokenId)).to.equal("0g://root");
    expect(await nft.getMetadataHash(tokenId)).to.equal(hash);
    await nft.connect(holder).authorizeUsage(tokenId, executor.address, "0x1234");
    expect(await nft.authorizationOf(tokenId, executor.address)).to.equal("0x1234");
    expect(receipt?.status).to.equal(1);
    expect(owner.address).to.be.a("string");
  });
});
