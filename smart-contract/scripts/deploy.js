const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  🚀 CertRegistry — Deployment Script");
  console.log("═══════════════════════════════════════════\n");

  // ── Deployer info ──
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const network = await hre.ethers.provider.getNetwork();

  console.log("Network:          ", network.name, `(chainId: ${network.chainId})`);
  console.log("Deployer address: ", deployer.address);
  console.log("Deployer balance: ", hre.ethers.formatEther(balance), "ETH\n");

  // ── Deploy ──
  const CertRegistry = await hre.ethers.getContractFactory("CertRegistry");
  const localChains = [31337n, 1337n];
  const isLocalNetwork = localChains.includes(network.chainId);
  const expectedLocalAddress =
    process.env.CONTRACT_ADDRESS ||
    hre.ethers.getCreateAddress({ from: deployer.address, nonce: 0 });

  let certRegistry;
  let contractAddress;
  let deployTx = null;
  let deployReceipt = null;
  let reusedDeployment = false;

  if (isLocalNetwork) {
    const existingCode = await hre.ethers.provider.getCode(expectedLocalAddress);
    if (existingCode && existingCode !== "0x") {
      console.log(`Reusing existing local CertRegistry at ${expectedLocalAddress}`);
      certRegistry = CertRegistry.attach(expectedLocalAddress);
      contractAddress = expectedLocalAddress;
      reusedDeployment = true;
    }
  }

  if (!certRegistry) {
    console.log("Deploying CertRegistry...");
    certRegistry = await CertRegistry.deploy();
    await certRegistry.waitForDeployment();

    contractAddress = await certRegistry.getAddress();
    deployTx = certRegistry.deploymentTransaction();
    deployReceipt = deployTx ? await deployTx.wait(1) : null;
  }

  console.log(reusedDeployment ? "✅ CertRegistry already deployed!" : "✅ CertRegistry deployed!");
  console.log("   Contract address:", contractAddress);
  console.log("   Transaction hash:", deployTx?.hash || "N/A");
  console.log("   Block number:    ", deployReceipt?.blockNumber || deployTx?.blockNumber || "pending...\n");

  // ── Optional initial admin bootstrap ──
  const initialAdmin = process.env.INITIAL_ADMIN_ADDRESS;
  if (initialAdmin && !reusedDeployment) {
    if (!hre.ethers.isAddress(initialAdmin)) {
      throw new Error(`INITIAL_ADMIN_ADDRESS is not a valid address: ${initialAdmin}`);
    }

    if (initialAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log(`Adding initial admin: ${initialAdmin}`);
      const addAdminTx = await certRegistry.addAdmin(initialAdmin);
      await addAdminTx.wait();
      console.log(`✅ Admin added in tx: ${addAdminTx.hash}`);
    } else {
      console.log("ℹ️  INITIAL_ADMIN_ADDRESS equals deployer, skipping addAdmin.");
    }
  }

  // ── Optional ownership transfer ──
  const transferOwnershipTo = process.env.TRANSFER_OWNERSHIP_TO;
  if (transferOwnershipTo && !reusedDeployment) {
    if (!hre.ethers.isAddress(transferOwnershipTo)) {
      throw new Error(`TRANSFER_OWNERSHIP_TO is not a valid address: ${transferOwnershipTo}`);
    }

    if (transferOwnershipTo.toLowerCase() !== deployer.address.toLowerCase()) {
      const isTargetAdmin = await certRegistry.isAdmin(transferOwnershipTo);
      if (!isTargetAdmin) {
        console.log(`Target owner is not admin yet. Adding admin: ${transferOwnershipTo}`);
        const addAdminTx = await certRegistry.addAdmin(transferOwnershipTo);
        await addAdminTx.wait();
        console.log(`✅ Owner target added as admin in tx: ${addAdminTx.hash}`);
      }

      console.log(`Transferring ownership to: ${transferOwnershipTo}`);
      const transferTx = await certRegistry.transferOwnership(transferOwnershipTo);
      await transferTx.wait();
      console.log(`✅ Ownership transferred in tx: ${transferTx.hash}`);
    } else {
      console.log("ℹ️  TRANSFER_OWNERSHIP_TO equals deployer, skipping transfer.");
    }
  }

  // ── Save deployment info to deployments.json ──
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  let deployments = {};

  // Load existing deployments if file exists
  if (fs.existsSync(deploymentsPath)) {
    try {
      deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
    } catch {
      deployments = {};
    }
  }

  const chainId = network.chainId.toString();
  deployments[chainId] = {
    network: network.name,
    chainId: Number(chainId),
    contractAddress: contractAddress,
    deployer: deployer.address,
    initialAdmin: initialAdmin || null,
    owner: await certRegistry.owner(),
    transactionHash: deployTx?.hash || null,
    blockNumber: deployReceipt?.blockNumber || deployTx?.blockNumber || null,
    deployedAt: new Date().toISOString(),
    solcVersion: "0.8.20",
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`📄 Deployment info saved to: ${deploymentsPath}`);

  // ── Verify on Etherscan/Polygonscan (skip for local) ──
  if (!localChains.includes(network.chainId)) {
    console.log("\n⏳ Waiting 30s for block confirmations before verification...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    try {
      console.log("🔍 Verifying contract on block explorer...");
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on block explorer!");
    } catch (err) {
      if (err.message.includes("Already Verified")) {
        console.log("ℹ️  Contract already verified.");
      } else {
        console.error("⚠️  Verification failed:", err.message);
      }
    }
  }

  // ── Summary ──
  console.log("\n═══════════════════════════════════════════");
  console.log("  📋 DEPLOYMENT SUMMARY");
  console.log("═══════════════════════════════════════════");
  console.log(`  Network:  ${network.name} (${chainId})`);
  console.log(`  Address:  ${contractAddress}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log("═══════════════════════════════════════════");
  console.log("\n💡 Add this to your backend .env:");
  console.log(`   CONTRACT_ADDRESS=${contractAddress}`);
  if (deployReceipt?.blockNumber || deployTx?.blockNumber) {
    console.log(`   CONTRACT_DEPLOY_BLOCK=${deployReceipt?.blockNumber || deployTx?.blockNumber}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
