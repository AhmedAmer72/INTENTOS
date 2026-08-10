import { expect } from "chai";
import { ethers } from "hardhat";
import canonicalize from "canonicalize";

describe("HashProbe matches keccak256(utf8(JCS))", () => {
  it("empty object, key-order, nested", async () => {
    const Probe = await ethers.getContractFactory("HashProbe");
    const probe = await Probe.deploy();
    const cases = [
      {},
      { b: 2, a: 1 },
      {
        version: "1.0",
        intentId: "11111111-1111-1111-1111-111111111111",
        constraints: { hard: [{ type: "no_leverage" }] },
      },
    ];
    for (const obj of cases) {
      const canonical = canonicalize(obj);
      if (!canonical) throw new Error("canonicalize failed");
      const offchain = ethers.keccak256(ethers.toUtf8Bytes(canonical));
      const onchain = await probe.keccakUtf8(canonical);
      expect(onchain).to.equal(offchain);
    }
  });
});
