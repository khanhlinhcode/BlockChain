const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("CertRegistry", function () {
  let contract;
  let owner;
  let admin2;
  let user;

  const testHash = ethers.keccak256(ethers.toUtf8Bytes("test-pdf-content"));
  const testCertId = "CERT-2024-TEST01";
  const testCID = "QmTestCIDHashForTesting123";
  const recipientName = "Nguyen Van A";
  const courseName = "Python";
  const issuingOrg = "FPT";

  const issueBaseCertificate = async (signer = owner) => {
    await contract
      .connect(signer)
      .issueCertificate(
        testHash,
        testCertId,
        testCID,
        recipientName,
        courseName,
        issuingOrg
      );
  };

  beforeEach(async () => {
    [owner, admin2, user] = await ethers.getSigners();
    const CertRegistry = await ethers.getContractFactory("CertRegistry");
    contract = await CertRegistry.deploy();
    await contract.waitForDeployment();
  });

  // Test group 1: Admin management
  describe("Admin Management", () => {
    it("should set deployer as admin", async () => {
      expect(await contract.admins(owner.address)).to.equal(true);
      expect(await contract.isAdmin(owner.address)).to.equal(true);
    });

    it("should allow admin to add new admin", async () => {
      await expect(contract.addAdmin(admin2.address))
        .to.emit(contract, "AdminAdded")
        .withArgs(admin2.address);
      expect(await contract.admins(admin2.address)).to.equal(true);
    });

    it("should reject non-admin adding admin", async () => {
      await expect(contract.connect(user).addAdmin(admin2.address)).to.be.revertedWith(
        "Not authorized"
      );
    });

    it("should allow removing admin", async () => {
      await contract.addAdmin(admin2.address);
      await expect(contract.removeAdmin(admin2.address))
        .to.emit(contract, "AdminRemoved")
        .withArgs(admin2.address);
      expect(await contract.admins(admin2.address)).to.equal(false);
    });

    it("should not allow removing last admin", async () => {
      // Contract enforces this via "owner cannot be removed".
      await expect(contract.removeAdmin(owner.address)).to.be.revertedWith(
        "Cannot remove owner"
      );
      expect(await contract.admins(owner.address)).to.equal(true);
    });
  });

  // Test group 2: Issue certificate
  describe("Issue Certificate", () => {
    it("should issue certificate with correct data", async () => {
      await issueBaseCertificate();
      const cert = await contract.getCertificate(testHash);

      expect(cert.certHash).to.equal(testHash);
      expect(cert.certId).to.equal(testCertId);
      expect(cert.ipfsCID).to.equal(testCID);
      expect(cert.recipientName).to.equal(recipientName);
      expect(cert.courseName).to.equal(courseName);
      expect(cert.issuingOrg).to.equal(issuingOrg);
      expect(cert.issuer).to.equal(owner.address);
      expect(cert.isRevoked).to.equal(false);
      expect(cert.revokedBy).to.equal(ethers.ZeroAddress);
      expect(cert.revokedAt).to.equal(0);
    });

    it("should emit CertIssued event with correct args", async () => {
      await expect(
        contract.issueCertificate(
          testHash,
          testCertId,
          testCID,
          recipientName,
          courseName,
          issuingOrg
        )
      )
        .to.emit(contract, "CertIssued")
        .withArgs(testHash, testCertId, owner.address, anyValue);
    });

    it("should reject duplicate hash", async () => {
      await issueBaseCertificate();
      await expect(
        contract.issueCertificate(
          testHash,
          "CERT-2024-OTHER01",
          testCID,
          recipientName,
          courseName,
          issuingOrg
        )
      ).to.be.revertedWith("Hash already registered");
    });

    it("should reject duplicate certId", async () => {
      await issueBaseCertificate();
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("another-pdf-content"));

      await expect(
        contract.issueCertificate(
          hash2,
          testCertId,
          testCID,
          recipientName,
          courseName,
          issuingOrg
        )
      ).to.be.revertedWith("CertId already used");
    });

    it("should reject from non-admin", async () => {
      await expect(
        contract
          .connect(user)
          .issueCertificate(
            testHash,
            testCertId,
            testCID,
            recipientName,
            courseName,
            issuingOrg
          )
      ).to.be.revertedWith("Not authorized");
    });

    it("should store timestamp correctly", async () => {
      const latestBlockBefore = await ethers.provider.getBlock("latest");
      await issueBaseCertificate();
      const cert = await contract.getCertificate(testHash);
      const latestBlockAfter = await ethers.provider.getBlock("latest");

      expect(Number(cert.issuedAt)).to.be.at.least(Number(latestBlockBefore.timestamp));
      expect(Number(cert.issuedAt)).to.be.at.most(Number(latestBlockAfter.timestamp));
    });
  });

  // Test group 3: Verify certificate
  describe("Verify Certificate", () => {
    beforeEach(async () => {
      await issueBaseCertificate();
    });

    it("should verify valid certificate by hash", async () => {
      const result = await contract.verifyCertificate.staticCall(testHash);

      expect(result.exists).to.equal(true);
      expect(result.isValid).to.equal(true);
      expect(result.isRevoked).to.equal(false);
    });

    it("should verify valid certificate by certId", async () => {
      const result = await contract.verifyCertificateById.staticCall(testCertId);

      expect(result.exists).to.equal(true);
      expect(result.isValid).to.equal(true);
      expect(result.isRevoked).to.equal(false);
    });

    it("should return exists=false for unknown hash", async () => {
      const unknownHash = ethers.keccak256(ethers.toUtf8Bytes("missing-certificate"));
      const result = await contract.verifyCertificate.staticCall(unknownHash);

      expect(result.exists).to.equal(false);
      expect(result.isValid).to.equal(false);
      expect(result.isRevoked).to.equal(false);
    });

    it("should emit CertVerified event", async () => {
      await expect(contract.connect(user).verifyCertificate(testHash))
        .to.emit(contract, "CertVerified")
        .withArgs(testHash, user.address, anyValue);
    });

    it("should record verification in history", async () => {
      await contract.connect(user).verifyCertificate(testHash);
      await contract.connect(owner).verifyCertificate(testHash);

      const history = await contract.getVerificationHistory(testHash);
      expect(history.length).to.equal(2);
      expect(history[0].verifier).to.equal(user.address);
      expect(history[1].verifier).to.equal(owner.address);
      expect(Number(history[0].verifiedAt)).to.be.greaterThan(0);
      expect(Number(history[1].verifiedAt)).to.be.greaterThan(0);
    });
  });

  // Test group 4: Revoke certificate
  describe("Revoke Certificate", () => {
    beforeEach(async () => {
      await issueBaseCertificate();
    });

    it("should revoke certificate correctly", async () => {
      await contract.revokeCertificate(testHash, "Issued by mistake");
      const cert = await contract.getCertificate(testHash);

      expect(cert.isRevoked).to.equal(true);
      expect(cert.revokedBy).to.equal(owner.address);
      expect(Number(cert.revokedAt)).to.be.greaterThan(0);
    });

    it("should emit CertRevoked event", async () => {
      await expect(contract.revokeCertificate(testHash, "Issued by mistake"))
        .to.emit(contract, "CertRevoked")
        .withArgs(testHash, owner.address, "Issued by mistake", anyValue);
    });

    it("should reject revoke of non-existent cert", async () => {
      const unknownHash = ethers.keccak256(ethers.toUtf8Bytes("does-not-exist"));
      await expect(
        contract.revokeCertificate(unknownHash, "No cert")
      ).to.be.revertedWith("Certificate not found");
    });

    it("should reject double revoke", async () => {
      await contract.revokeCertificate(testHash, "First");
      await expect(contract.revokeCertificate(testHash, "Second")).to.be.revertedWith(
        "Certificate is revoked"
      );
    });

    it("should reject revoke from non-admin", async () => {
      await expect(
        contract.connect(user).revokeCertificate(testHash, "Unauthorized")
      ).to.be.revertedWith("Not authorized");
    });

    it("should mark cert as isRevoked=true after revoke", async () => {
      await contract.revokeCertificate(testHash, "Revoked");
      const verifyResult = await contract.verifyCertificate.staticCall(testHash);

      expect(verifyResult.exists).to.equal(true);
      expect(verifyResult.isValid).to.equal(false);
      expect(verifyResult.isRevoked).to.equal(true);
    });
  });

  // Test group 5: Data integrity
  describe("Data Integrity", () => {
    beforeEach(async () => {
      await issueBaseCertificate();
    });

    it("getCertificate returns all fields correctly", async () => {
      const cert = await contract.getCertificate(testHash);

      expect(cert.certHash).to.equal(testHash);
      expect(cert.ipfsCID).to.equal(testCID);
      expect(cert.issuer).to.equal(owner.address);
      expect(cert.isRevoked).to.equal(false);
      expect(cert.recipientName).to.equal(recipientName);
      expect(cert.certId).to.equal(testCertId);
      expect(cert.courseName).to.equal(courseName);
      expect(cert.issuingOrg).to.equal(issuingOrg);
      expect(Number(cert.issuedAt)).to.be.greaterThan(0);
      expect(Number(cert.revokedAt)).to.equal(0);
      expect(cert.revokedBy).to.equal(ethers.ZeroAddress);
    });

    it("getCertificateById returns same as getCertificate", async () => {
      const byHash = await contract.getCertificate(testHash);
      const byId = await contract.getCertificateById(testCertId);

      expect(byId.certHash).to.equal(byHash.certHash);
      expect(byId.certId).to.equal(byHash.certId);
      expect(byId.ipfsCID).to.equal(byHash.ipfsCID);
      expect(byId.recipientName).to.equal(byHash.recipientName);
      expect(byId.courseName).to.equal(byHash.courseName);
      expect(byId.issuingOrg).to.equal(byHash.issuingOrg);
      expect(byId.issuer).to.equal(byHash.issuer);
      expect(byId.isRevoked).to.equal(byHash.isRevoked);
    });

    it("getTotalCertificates increments correctly", async () => {
      expect(await contract.getTotalCertificates()).to.equal(1);

      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("test-pdf-content-2"));
      await contract.issueCertificate(
        hash2,
        "CERT-2024-TEST02",
        "QmAnotherCIDForTesting456",
        "Tran Thi B",
        "Node.js",
        "FPT"
      );

      expect(await contract.getTotalCertificates()).to.equal(2);
    });
  });
});
