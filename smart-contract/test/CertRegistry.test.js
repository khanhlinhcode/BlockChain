const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("CertRegistry", function () {
  let contract;
  let deployer;
  let admin2;
  let user;

  const certHash = ethers.keccak256(ethers.toUtf8Bytes("test-pdf-content-001"));
  const certId = "CERT-2026-TEST01";
  const ipfsCID = "QmTestCIDHashABC123";
  const recipientName = "Nguyen Van A";
  const courseName = "Blockchain Development";
  const issuingOrg = "FPT University";

  async function deployContract() {
    const CertRegistry = await ethers.getContractFactory("CertRegistry");
    const deployed = await CertRegistry.deploy();
    await deployed.waitForDeployment();
    return deployed;
  }

  async function issueCertificate(overrides = {}, signer = deployer) {
    const data = {
      hash: certHash,
      certId,
      cid: ipfsCID,
      recipient: recipientName,
      course: courseName,
      org: issuingOrg,
      ...overrides,
    };

    await contract
      .connect(signer)
      .issueCertificate(
        data.hash,
        data.certId,
        data.cid,
        data.recipient,
        data.course,
        data.org
      );
    return data;
  }

  beforeEach(async () => {
    [deployer, admin2, user] = await ethers.getSigners();
    contract = await deployContract();
  });

  describe("Deployment", () => {
    it("deploys successfully", async () => {
      expect(await contract.getAddress()).to.match(/^0x[0-9a-fA-F]{40}$/);
    });

    it("sets deployer as admin", async () => {
      expect(await contract.admins(deployer.address)).to.equal(true);
      expect(await contract.isAdmin(deployer.address)).to.equal(true);
    });

    it("returns false for random address admin check", async () => {
      expect(await contract.isAdmin(user.address)).to.equal(false);
    });

    it("starts with zero certificates", async () => {
      expect(await contract.getTotalCertificates()).to.equal(0);
    });
  });

  describe("Issue Certificate", () => {
    it("issues certificate with valid data", async () => {
      await issueCertificate();
      const cert = await contract.getCertificate(certHash);

      expect(cert.certHash).to.equal(certHash);
      expect(cert.ipfsCID).to.equal(ipfsCID);
      expect(cert.issuer).to.equal(deployer.address);
      expect(Number(cert.issuedAt)).to.be.greaterThan(0);
      expect(cert.isRevoked).to.equal(false);
      expect(cert.recipientName).to.equal(recipientName);
      expect(cert.certId).to.equal(certId);
      expect(cert.courseName).to.equal(courseName);
      expect(cert.issuingOrg).to.equal(issuingOrg);
      expect(cert.revokedAt).to.equal(0);
      expect(cert.revokedBy).to.equal(ethers.ZeroAddress);
    });

    it("emits CertIssued with correct args", async () => {
      await expect(
        contract.issueCertificate(
          certHash,
          certId,
          ipfsCID,
          recipientName,
          courseName,
          issuingOrg
        )
      )
        .to.emit(contract, "CertIssued")
        .withArgs(certHash, certId, deployer.address, anyValue);
    });

    it("getCertificateById returns same data", async () => {
      await issueCertificate();
      const byHash = await contract.getCertificate(certHash);
      const byId = await contract.getCertificateById(certId);

      expect(byId.certHash).to.equal(byHash.certHash);
      expect(byId.certId).to.equal(byHash.certId);
      expect(byId.ipfsCID).to.equal(byHash.ipfsCID);
      expect(byId.recipientName).to.equal(byHash.recipientName);
      expect(byId.courseName).to.equal(byHash.courseName);
      expect(byId.issuingOrg).to.equal(byHash.issuingOrg);
      expect(byId.issuer).to.equal(byHash.issuer);
    });

    it("increments total certificates", async () => {
      await issueCertificate();
      expect(await contract.getTotalCertificates()).to.equal(1);
    });

    it("reverts duplicate hash", async () => {
      await issueCertificate();
      await expect(
        contract.issueCertificate(
          certHash,
          "CERT-2026-OTHER01",
          ipfsCID,
          recipientName,
          courseName,
          issuingOrg
        )
      ).to.be.revertedWith("Certificate already exists");
    });

    it("reverts duplicate certId", async () => {
      await issueCertificate();
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("another-pdf-content"));

      await expect(
        contract.issueCertificate(
          hash2,
          certId,
          ipfsCID,
          recipientName,
          courseName,
          issuingOrg
        )
      ).to.be.revertedWith("Certificate ID already used");
    });

    it("reverts when non-admin issues", async () => {
      await expect(
        contract
          .connect(user)
          .issueCertificate(certHash, certId, ipfsCID, recipientName, courseName, issuingOrg)
      ).to.be.revertedWith("Not authorized");
    });

    it("reverts empty certId", async () => {
      await expect(
        contract.issueCertificate(certHash, "", ipfsCID, recipientName, courseName, issuingOrg)
      ).to.be.revertedWith("Empty certId");
    });

    it("reverts empty recipientName", async () => {
      await expect(
        contract.issueCertificate(certHash, certId, ipfsCID, "", courseName, issuingOrg)
      ).to.be.revertedWith("Empty recipient name");
    });
  });

  describe("Verify Certificate", () => {
    beforeEach(async () => {
      await issueCertificate();
    });

    it("returns true,true,false for valid certificate by hash", async () => {
      const result = await contract.verifyCertificate.staticCall(certHash);
      expect(result.exists).to.equal(true);
      expect(result.isValid).to.equal(true);
      expect(result.isRevoked).to.equal(false);
    });

    it("returns true,true,false for valid certificate by certId", async () => {
      const result = await contract.verifyCertificateById.staticCall(certId);
      expect(result.exists).to.equal(true);
      expect(result.isValid).to.equal(true);
      expect(result.isRevoked).to.equal(false);
    });

    it("returns false,false,false for unknown hash", async () => {
      const unknownHash = ethers.keccak256(ethers.toUtf8Bytes("missing-certificate"));
      const result = await contract.verifyCertificate.staticCall(unknownHash);
      expect(result.exists).to.equal(false);
      expect(result.isValid).to.equal(false);
      expect(result.isRevoked).to.equal(false);
    });

    it("emits CertVerified", async () => {
      await expect(contract.connect(user).verifyCertificate(certHash))
        .to.emit(contract, "CertVerified")
        .withArgs(certHash, user.address, anyValue);
    });

    it("records one verification in history", async () => {
      await contract.connect(user).verifyCertificate(certHash);
      const history = await contract.getVerificationHistory(certHash);
      expect(history).to.have.lengthOf(1);
      expect(history[0].verifier).to.equal(user.address);
      expect(Number(history[0].verifiedAt)).to.be.greaterThan(0);
    });

    it("records multiple verifications correctly", async () => {
      await contract.connect(user).verifyCertificate(certHash);
      await contract.connect(deployer).verifyCertificate(certHash);
      await contract.connect(admin2).verifyCertificate(certHash);

      const history = await contract.getVerificationHistory(certHash);
      expect(history).to.have.lengthOf(3);
      expect(history[0].verifier).to.equal(user.address);
      expect(history[1].verifier).to.equal(deployer.address);
      expect(history[2].verifier).to.equal(admin2.address);
    });
  });

  describe("Revoke Certificate", () => {
    beforeEach(async () => {
      await issueCertificate();
    });

    it("revokes certificate", async () => {
      await contract.revokeCertificate(certHash, "Reason");
      const cert = await contract.getCertificate(certHash);
      expect(cert.isRevoked).to.equal(true);
      expect(cert.revokedBy).to.equal(deployer.address);
      expect(Number(cert.revokedAt)).to.be.greaterThan(0);
    });

    it("emits CertRevoked with reason", async () => {
      await expect(contract.revokeCertificate(certHash, "Reason"))
        .to.emit(contract, "CertRevoked")
        .withArgs(certHash, deployer.address, "Reason", anyValue);
    });

    it("verify returns true,false,true after revoke", async () => {
      await contract.revokeCertificate(certHash, "Reason");
      const result = await contract.verifyCertificate.staticCall(certHash);
      expect(result.exists).to.equal(true);
      expect(result.isValid).to.equal(false);
      expect(result.isRevoked).to.equal(true);
    });

    it("reverts already revoked certificate", async () => {
      await contract.revokeCertificate(certHash, "First");
      await expect(contract.revokeCertificate(certHash, "Second")).to.be.revertedWith(
        "Already revoked"
      );
    });

    it("reverts non-existent certificate revoke", async () => {
      const unknownHash = ethers.keccak256(ethers.toUtf8Bytes("does-not-exist"));
      await expect(contract.revokeCertificate(unknownHash, "Reason")).to.be.revertedWith(
        "Certificate not found"
      );
    });

    it("reverts non-admin revoke", async () => {
      await expect(contract.connect(user).revokeCertificate(certHash, "Reason")).to.be.revertedWith(
        "Not authorized"
      );
    });
  });

  describe("Multi-admin", () => {
    it("adds admin2", async () => {
      await expect(contract.addAdmin(admin2.address))
        .to.emit(contract, "AdminAdded")
        .withArgs(admin2.address);
      expect(await contract.isAdmin(admin2.address)).to.equal(true);
    });

    it("admin2 can issue certificate", async () => {
      await contract.addAdmin(admin2.address);
      await issueCertificate({}, admin2);
      const cert = await contract.getCertificate(certHash);
      expect(cert.issuer).to.equal(admin2.address);
    });

    it("removes admin2", async () => {
      await contract.addAdmin(admin2.address);
      await expect(contract.removeAdmin(admin2.address))
        .to.emit(contract, "AdminRemoved")
        .withArgs(admin2.address);
      expect(await contract.isAdmin(admin2.address)).to.equal(false);
    });

    it("removed admin can no longer issue", async () => {
      await contract.addAdmin(admin2.address);
      await contract.removeAdmin(admin2.address);
      await expect(issueCertificate({}, admin2)).to.be.revertedWith("Not authorized");
    });

    it("reverts removing self as last admin", async () => {
      await expect(contract.removeAdmin(deployer.address)).to.be.revertedWith(
        "Cannot remove last admin"
      );
    });

    it("reverts non-admin adding admin", async () => {
      await expect(contract.connect(user).addAdmin(admin2.address)).to.be.revertedWith(
        "Not authorized"
      );
    });
  });

  describe("Edge cases", () => {
    it("handles bytes32 hash values from 0x-prefixed strings correctly", async () => {
      const prefixedHash = `0x${"a".repeat(64)}`;
      await issueCertificate({ hash: prefixedHash });
      const cert = await contract.getCertificate(prefixedHash);
      expect(cert.certHash).to.equal(prefixedHash);
    });

    it("supports very long recipientName", async () => {
      const longName = "A".repeat(100);
      await issueCertificate({ recipient: longName });
      const cert = await contract.getCertificate(certHash);
      expect(cert.recipientName).to.equal(longName);
    });

    it("supports very long courseName", async () => {
      const longCourse = "B".repeat(200);
      await issueCertificate({ course: longCourse });
      const cert = await contract.getCertificate(certHash);
      expect(cert.courseName).to.equal(longCourse);
    });

    it("supports unicode recipientName", async () => {
      await issueCertificate({ recipient: "Nguyễn Văn A" });
      const cert = await contract.getCertificate(certHash);
      expect(cert.recipientName).to.equal("Nguyễn Văn A");
    });

    it("issues 50 certificates", async () => {
      for (let i = 0; i < 50; i++) {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(`bulk-pdf-${i}`));
        const padded = String(i).padStart(2, "0");
        await contract.issueCertificate(
          hash,
          `CERT-2026-BULK${padded}`,
          `QmBulkCID${padded}`,
          `Recipient ${padded}`,
          "Bulk Course",
          "Bulk Org"
        );
      }

      expect(await contract.getTotalCertificates()).to.equal(50);
    });
  });
});
