// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CertRegistry is Ownable {
    struct Certificate {
        bytes32 certHash;        // SHA-256 hash of PDF file
        address issuer;          // Admin wallet who issued
        address revokedBy;       // Who revoked (address(0) if active)
        uint64 issuedAt;         // block.timestamp
        uint64 revokedAt;        // revocation timestamp (0 if active)
        bool isRevoked;          // revocation status
        string ipfsCID;          // IPFS CID of the PDF file
        string recipientName;    // Full name of recipient
        string certId;           // Unique certificate ID
        string courseName;       // Course/program name
        string issuingOrg;       // Organization name
    }

    struct VerificationRecord {
        address verifier;        // who verified (address(0) if anonymous)
        uint256 verifiedAt;      // timestamp
    }

    mapping(bytes32 => Certificate) private certsByHash;
    mapping(string => bytes32) private idToHash;
    mapping(string => bool) private certIdUsed;
    mapping(bytes32 => VerificationRecord[]) private verificationHistory;
    mapping(address => bool) public admins;
    bytes32[] private allCertHashes;

    event CertIssued(bytes32 indexed certHash, string certId, address indexed issuer, uint256 issuedAt);
    event CertVerified(bytes32 indexed certHash, address verifier, uint256 verifiedAt);
    event CertRevoked(bytes32 indexed certHash, address indexed revoker, string reason, uint256 revokedAt);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    modifier onlyAdmin() {
        require(admins[msg.sender], "Not authorized");
        _;
    }

    modifier certExists(bytes32 _hash) {
        require(certsByHash[_hash].issuedAt > 0, "Certificate not found");
        _;
    }

    modifier notRevoked(bytes32 _hash) {
        require(!certsByHash[_hash].isRevoked, "Certificate is revoked");
        _;
    }

    constructor() Ownable(msg.sender) {
        admins[msg.sender] = true;
        emit AdminAdded(msg.sender);
    }

    function addAdmin(address _admin) external onlyAdmin {
        require(_admin != address(0), "Zero address");
        require(!admins[_admin], "Already an admin");
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }

    function removeAdmin(address _admin) external onlyAdmin {
        require(_admin != owner(), "Cannot remove owner");
        require(admins[_admin], "Not an admin");
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }

    function isAdmin(address _addr) external view returns (bool) {
        return admins[_addr];
    }

    function issueCertificate(
        bytes32 _hash,
        string calldata _certId,
        string calldata _ipfsCID,
        string calldata _recipientName,
        string calldata _courseName,
        string calldata _issuingOrg
    ) external onlyAdmin {
        require(_hash != bytes32(0), "Invalid certificate hash");
        require(certsByHash[_hash].issuedAt == 0, "Hash already registered");
        require(!certIdUsed[_certId], "CertId already used");
        require(bytes(_certId).length > 0, "Empty certId");
        require(bytes(_ipfsCID).length > 0, "Empty IPFS CID");
        require(bytes(_recipientName).length > 0, "Empty recipient name");
        require(bytes(_courseName).length > 0, "Empty course name");
        require(bytes(_issuingOrg).length > 0, "Empty issuing org");

        Certificate storage cert = certsByHash[_hash];
        cert.certHash = _hash;
        cert.issuer = msg.sender;
        cert.revokedBy = address(0);
        cert.issuedAt = uint64(block.timestamp);
        cert.revokedAt = 0;
        cert.isRevoked = false;
        cert.ipfsCID = _ipfsCID;
        cert.recipientName = _recipientName;
        cert.certId = _certId;
        cert.courseName = _courseName;
        cert.issuingOrg = _issuingOrg;

        idToHash[_certId] = _hash;
        certIdUsed[_certId] = true;
        allCertHashes.push(_hash);

        emit CertIssued(_hash, _certId, msg.sender, block.timestamp);
    }

    function verifyCertificate(bytes32 _hash)
        external
        returns (bool exists, bool isValid, bool isRevoked)
    {
        Certificate storage cert = certsByHash[_hash];
        exists = cert.issuedAt > 0;
        if (!exists) {
            return (false, false, false);
        }

        isRevoked = cert.isRevoked;
        isValid = !isRevoked;
        _recordVerification(_hash);
    }

    function verifyCertificateById(string calldata _certId)
        external
        returns (bool exists, bool isValid, bool isRevoked)
    {
        if (!certIdUsed[_certId]) {
            return (false, false, false);
        }

        bytes32 hash = idToHash[_certId];
        Certificate storage cert = certsByHash[hash];
        exists = cert.issuedAt > 0;
        if (!exists) {
            return (false, false, false);
        }

        isRevoked = cert.isRevoked;
        isValid = !isRevoked;
        _recordVerification(hash);
    }

    function revokeCertificate(bytes32 _hash, string calldata _reason)
        external
        onlyAdmin
        certExists(_hash)
        notRevoked(_hash)
    {
        require(bytes(_reason).length > 0, "Empty revoke reason");

        Certificate storage cert = certsByHash[_hash];
        cert.isRevoked = true;
        cert.revokedAt = uint64(block.timestamp);
        cert.revokedBy = msg.sender;

        emit CertRevoked(_hash, msg.sender, _reason, block.timestamp);
    }

    function getCertificate(bytes32 _hash)
        external
        view
        certExists(_hash)
        returns (Certificate memory)
    {
        return certsByHash[_hash];
    }

    function getCertificateById(string calldata _certId)
        external
        view
        returns (Certificate memory)
    {
        require(certIdUsed[_certId], "Certificate not found");
        bytes32 hash = idToHash[_certId];
        return certsByHash[hash];
    }

    function getVerificationHistory(bytes32 _hash)
        external
        view
        returns (VerificationRecord[] memory)
    {
        return verificationHistory[_hash];
    }

    function getTotalCertificates() external view returns (uint256) {
        return allCertHashes.length;
    }

    function getIssuedByAdmin(address _admin)
        external
        view
        returns (bytes32[] memory)
    {
        uint256 total = allCertHashes.length;
        uint256 count = 0;

        for (uint256 i = 0; i < total; i++) {
            if (certsByHash[allCertHashes[i]].issuer == _admin) {
                unchecked {
                    count++;
                }
            }
        }

        bytes32[] memory hashes = new bytes32[](count);
        uint256 idx = 0;

        for (uint256 i = 0; i < total; i++) {
            bytes32 certHash = allCertHashes[i];
            if (certsByHash[certHash].issuer == _admin) {
                hashes[idx] = certHash;
                unchecked {
                    idx++;
                }
            }
        }

        return hashes;
    }

    function getHashByCertId(string calldata _certId)
        external
        view
        returns (bytes32)
    {
        return idToHash[_certId];
    }

    function getCertHashByIndex(uint256 _index)
        external
        view
        returns (bytes32)
    {
        require(_index < allCertHashes.length, "Index out of bounds");
        return allCertHashes[_index];
    }

    function _recordVerification(bytes32 _hash) private {
        verificationHistory[_hash].push(
            VerificationRecord({verifier: msg.sender, verifiedAt: block.timestamp})
        );
        emit CertVerified(_hash, msg.sender, block.timestamp);
    }
}
