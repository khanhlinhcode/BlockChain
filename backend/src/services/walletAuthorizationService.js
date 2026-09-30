const AllowedWallet = require("../models/AllowedWallet");

async function isWalletAllowed(walletAddress) {
  const address = String(walletAddress || "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) return false;
  return Boolean(await AllowedWallet.exists({ address, isActive: true }));
}

module.exports = { isWalletAllowed };
