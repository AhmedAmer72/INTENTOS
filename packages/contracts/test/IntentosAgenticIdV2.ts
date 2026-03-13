import { expect } from "chai";
import { ethers } from "hardhat";

const transferTypes = {
  TransferAttestation: [
    { name: "tokenId", type: "uint256" },
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "newMetadataHash", type: "bytes32" },
    { name: "uriHash", type: "bytes32" },
  ],
} as const;

const cloneTypes = {
  CloneAttestation: [
    { name: "tokenId", type: "uint256" },
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "newMetadataHash", type: "bytes32" },
    { name: "uriHash", type: "bytes32" },
  ],
} as const;

describe("IntentosAgenticIdV2", () => {
  async function deploy() {
    const [deployer, oracle, holder, buyer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("IntentosAgenticIdV2");
    const nft = await Factory.deploy(oracle.address);
    await nft.waitForDeployment();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("meta-v2"));
    await nft.mint(holder.address, "0g://root-v2", hash);
    return { nft, deployer, oracle, holder, buyer, hash };
  }

  function domain(nftAddress: string, chainId: bigint) {
    return {
      name: "INTENTOS AgenticId",
      version: "1",
      chainId,
      verifyingContract: nftAddress,
    };
  }

  async function proof(
    oracle: { signTypedData: Function },
    nftAddress: string,
    types: typeof transferTypes | typeof cloneTypes,
    message: {
      tokenId: bigint;
      from: string;
      to: string;
      newMetadataHash: string;
      uriHash: string;
    },
    newURI: string,
    newHash: string,
  ) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const sig = await oracle.signTypedData(domain(nftAddress, chainId), types, message);
    return ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "string", "bytes"], [newHash, newURI, sig]);
  }

  it("mints encrypted metadata bound to an owner", async () => {
    const { nft, holder, hash } = await deploy();
    expect(await nft.ownerOf(1n)).to.equal(holder.address);
    expect(await nft.getEncryptedURI(1n)).to.equal("0g://root-v2");
    expect(await nft.getMetadataHash(1n)).to.equal(hash);
  });

  it("transfers with an oracle proof and updates URI/hash", async () => {
    const { nft, oracle, holder, buyer, hash } = await deploy();
    const newURI = "0g://root-v2-reenc";
    const newHash = ethers.keccak256(ethers.toUtf8Bytes("meta-v2-b"));
    const encoded = await proof(
      oracle,
      await nft.getAddress(),
      transferTypes,
      {
        tokenId: 1n,
        from: holder.address,
        to: buyer.address,
        newMetadataHash: newHash,
        uriHash: ethers.keccak256(ethers.toUtf8Bytes(newURI)),
      },
      newURI,
      newHash,
    );
    await nft.connect(holder).transfer(holder.address, buyer.address, 1n, "0xabcd", encoded);
    expect(await nft.ownerOf(1n)).to.equal(buyer.address);
    expect(await nft.getEncryptedURI(1n)).to.equal(newURI);
    expect(await nft.getMetadataHash(1n)).to.equal(newHash);
    expect(hash).to.not.equal(newHash);
  });

  it("rejects a transfer with a non-oracle signature", async () => {
    const { nft, holder, buyer, hash } = await deploy();
    const encoded = await proof(
      holder,
      await nft.getAddress(),
      transferTypes,
      {
        tokenId: 1n,
        from: holder.address,
        to: buyer.address,
        newMetadataHash: hash,
        uriHash: ethers.keccak256(ethers.toUtf8Bytes("0g://root-v2")),
      },
      "0g://root-v2",
      hash,
    );
    await expect(
      nft.connect(holder).transfer(holder.address, buyer.address, 1n, "0x", encoded),
    ).to.be.revertedWithCustomError(nft, "BadProof");
  });

  it("clones a token to a new id", async () => {
    const { nft, oracle, holder, buyer, hash } = await deploy();
    const encoded = await proof(
      oracle,
      await nft.getAddress(),
      cloneTypes,
      {
        tokenId: 1n,
        from: holder.address,
        to: buyer.address,
        newMetadataHash: hash,
        uriHash: ethers.keccak256(ethers.toUtf8Bytes("0g://root-v2")),
      },
      "0g://root-v2",
      hash,
    );
    await nft.connect(holder).clone(buyer.address, 1n, "0x", encoded);
    expect(await nft.ownerOf(2n)).to.equal(buyer.address);
    expect(await nft.ownerOf(1n)).to.equal(holder.address);
  });
});
