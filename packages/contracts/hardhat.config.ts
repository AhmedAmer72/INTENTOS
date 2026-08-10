import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";

loadEnv({ path: resolve(__dirname, "../../.env") });

const deployer = process.env.DEPLOYER_PRIVATE_KEY;
const oracle = process.env.VERIFIER_ORACLE_PRIVATE_KEY;
const accounts =
  deployer && oracle && deployer.startsWith("0x") && deployer.length === 66 ? [deployer, oracle] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    galileo: {
      url: process.env.ZEROG_TESTNET_RPC ?? "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts,
    },
    mainnet: {
      url: process.env.ZEROG_MAINNET_RPC ?? "https://evmrpc.0g.ai",
      chainId: 16661,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      galileo: "not-needed",
      mainnet: "not-needed",
    },
    customChains: [
      {
        network: "galileo",
        chainId: 16602,
        urls: {
          apiURL: "https://chainscan-galileo.0g.ai/api",
          browserURL: "https://chainscan-galileo.0g.ai",
        },
      },
      {
        network: "mainnet",
        chainId: 16661,
        urls: {
          apiURL: "https://chainscan.0g.ai/api",
          browserURL: "https://chainscan.0g.ai",
        },
      },
    ],
  },
};

export default config;
