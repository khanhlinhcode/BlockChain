require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const {
  PRIVATE_KEY,
  ALCHEMY_MUMBAI_URL,
  ALCHEMY_SEPOLIA_URL,
  POLYGONSCAN_API_KEY,
  ETHERSCAN_API_KEY,
} = process.env;

const normalizedPrivateKey = PRIVATE_KEY
  ? PRIVATE_KEY.startsWith("0x")
    ? PRIVATE_KEY
    : `0x${PRIVATE_KEY}`
  : null;
const accounts = normalizedPrivateKey ? [normalizedPrivateKey] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false,
    },
  },

  networks: {
    // ── Local ──
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545",
    },

    // ── Polygon Mumbai Testnet (chainId 80001) ──
    mumbai: {
      url: ALCHEMY_MUMBAI_URL || "https://rpc.ankr.com/polygon_mumbai",
      chainId: 80001,
      accounts,
      gasPrice: "auto",
      timeout: 120000,
    },

    // ── Ethereum Sepolia Testnet (chainId 11155111) ──
    sepolia: {
      url: ALCHEMY_SEPOLIA_URL || "",
      chainId: 11155111,
      accounts,
      gasPrice: "auto",
      timeout: 120000,
    },
  },

  etherscan: {
    apiKey: {
      // For Polygon Mumbai verification
      polygonMumbai: POLYGONSCAN_API_KEY || "",
      // For Sepolia verification
      sepolia: ETHERSCAN_API_KEY || "",
    },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  mocha: {
    timeout: 120000,
  },
};
