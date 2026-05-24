process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_for_api";
process.env.JWT_EXPIRES_IN = "8h";
process.env.DEFAULT_ADMIN_USERNAME = "admin";
process.env.DEFAULT_ADMIN_PASSWORD = "Admin@123456";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.CONTRACT_ADDRESS = "0x1111111111111111111111111111111111111111";

const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

jest.mock("../src/services/ipfsService", () => ({
  uploadPDFToIPFS: jest.fn().mockResolvedValue({
    cid: "bafytestcid",
    url: "https://gateway.pinata.cloud/ipfs/bafytestcid",
  }),
  uploadJSONToIPFS: jest.fn().mockResolvedValue({ cid: "bafyjsoncid" }),
  unpinFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/services/blockchainService", () => {
  const syncedHash = `0x${"c".repeat(64)}`;
  const syncedCertId = "CERT-2026-SYNC0001";
  const syncedTxHash = `0x${"9".repeat(64)}`;
  const contractAddress = "0x1111111111111111111111111111111111111111";

  const normalizeHash = (hash) => {
    const clean = String(hash || "").startsWith("0x") ? String(hash).slice(2) : String(hash || "");
    if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
      throw new Error("Invalid certificate hash format");
    }
    return `0x${clean.toLowerCase()}`;
  };

  return {
    normalizeHash,
    getProvider: jest.fn(() => ({
      getTransactionReceipt: jest.fn(async (txHash) =>
        txHash === syncedTxHash
          ? {
              status: 1,
              to: contractAddress,
              blockNumber: 15,
              logs: [
                {
                  address: contractAddress,
                  transactionHash: syncedTxHash,
                  topics: [],
                  data: "0x",
                },
              ],
            }
          : null
      ),
    })),
    getContract: jest.fn(() => ({
      target: contractAddress,
      getAddress: jest.fn().mockResolvedValue(contractAddress),
      interface: {
        parseLog: jest.fn(() => ({
          name: "CertIssued",
          args: {
            certHash: syncedHash,
            certId: syncedCertId,
            issuer: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
            issuedAt: 1767225600,
          },
        })),
      },
    })),
    getCertOnChain: jest.fn().mockResolvedValue({
      certHash: syncedHash,
      certId: syncedCertId,
      ipfsCID: "bafytestcid",
      issuer: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      issuedAt: 1767225600,
      revokedAt: 0,
      revokedBy: "0x0000000000000000000000000000000000000000",
      isRevoked: false,
      recipientName: "Synced User",
      courseName: "Direct Chain Issue",
      issuingOrg: "CertChain",
    }),
    issueCertOnChain: jest.fn().mockResolvedValue({
      txHash: `0x${"1".repeat(64)}`,
      blockNumber: 7,
      gasUsed: "21000",
    }),
    verifyCertOnChain: jest.fn().mockImplementation(async (hash) => ({
      exists: true,
      isValid: true,
      isRevoked: false,
      cert: { certHash: normalizeHash(hash), isRevoked: false },
    })),
    revokeCertOnChain: jest.fn().mockResolvedValue({
      txHash: `0x${"2".repeat(64)}`,
      blockNumber: 8,
      gasUsed: "21000",
    }),
    assertSignerIsAdmin: jest.fn().mockResolvedValue(true),
    getSignerAddress: jest.fn(() => "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"),
    isAdminOnChain: jest.fn().mockResolvedValue(false),
    getAuditEvents: jest.fn().mockResolvedValue([]),
    isRpcUnavailableError: jest.fn(() => false),
    resetDefaultClient: jest.fn(),
  };
});

const app = require("../src/app");
const Admin = require("../src/models/Admin");
const Certificate = require("../src/models/Certificate");
const blockchainService = require("../src/services/blockchainService");
const ipfsService = require("../src/services/ipfsService");

let mongo;

const validHash = `0x${"a".repeat(64)}`;
const makePdf = (content = "fake pdf content") => Buffer.from(`%PDF-1.4\n${content}\n%%EOF`);

async function resetDb() {
  await Admin.deleteMany({});
  await Certificate.deleteMany({});
}

async function seedAdmin() {
  return request(app).post("/api/auth/seed").send({});
}

async function loginAdmin() {
  await seedAdmin();
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: "Admin@123456" });
  return res.body.token;
}

async function createAdminToken() {
  const admin = await Admin.create({
    username: "admin",
    passwordHash: "test-password-hash",
    role: "superadmin",
    walletAddress: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  });

  return jwt.sign(
    {
      id: admin._id,
      username: admin.username,
      role: admin.role,
      walletAddress: admin.walletAddress,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

async function createCertificate(overrides = {}) {
  return Certificate.create({
    certHash: overrides.certHash || validHash,
    certId: overrides.certId || "CERT-2026-TEST0001".slice(0, 18),
    ipfsCID: "bafytestcid",
    ipfsUrl: "https://gateway.pinata.cloud/ipfs/bafytestcid",
    recipientName: overrides.recipientName || "Nguyen Van A",
    courseName: overrides.courseName || "Blockchain Development",
    issuingOrg: overrides.issuingOrg || "FPT University",
    issuerAddress: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    issuedAt: overrides.issuedAt || new Date("2026-01-15T00:00:00Z"),
    isRevoked: overrides.isRevoked || false,
    txHash: `0x${"3".repeat(64)}`,
    blockNumber: 9,
    ...overrides,
  });
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongo.getUri(), { serverSelectionTimeoutMS: 5000 });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
  }
});

beforeEach(async () => {
  jest.clearAllMocks();
  await resetDb();
});

describe("Health", () => {
  test("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("Auth", () => {
  test("POST /api/auth/seed creates admin first time", async () => {
    const res = await seedAdmin();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.admin.username).toBe("admin");
  });

  test("POST /api/auth/seed again returns 400", async () => {
    await seedAdmin();
    const res = await seedAdmin();
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exist/i);
  });

  test("POST /api/auth/login returns token", async () => {
    await seedAdmin();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "Admin@123456" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.admin.username).toBe("admin");
  });

  test("POST /api/auth/login wrong password returns 401", async () => {
    await seedAdmin();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  test("POST /api/auth/login missing fields returns 400", async () => {
    const res = await request(app).post("/api/auth/login").send({ username: "admin" });
    expect(res.status).toBe(400);
  });

  test("GET /api/auth/me with valid token returns admin", async () => {
    const token = await loginAdmin();
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.admin.username).toBe("admin");
  });

  test("GET /api/auth/me without token returns 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("GET /api/auth/me with expired token returns 401", async () => {
    const admin = await Admin.create({ username: "admin", passwordHash: "hash", role: "superadmin" });
    const expired = jwt.sign(
      { id: admin._id, username: "admin", role: "superadmin" },
      process.env.JWT_SECRET,
      { expiresIn: -10 }
    );
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expired/i);
  });

  test("POST /api/auth/logout returns 200", async () => {
    const token = await loginAdmin();
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("Verify public routes", () => {
  test("POST /api/verify/by-id invalid ID returns exists=false", async () => {
    const res = await request(app).post("/api/verify/by-id").send({ certId: "INVALID" });
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });

  test("POST /api/verify/by-id missing certId returns 400", async () => {
    const res = await request(app).post("/api/verify/by-id").send({});
    expect(res.status).toBe(400);
  });

  test("POST /api/verify/by-file without file returns 400", async () => {
    const res = await request(app).post("/api/verify/by-file");
    expect(res.status).toBe(400);
  });

  test("POST /api/verify/by-file with non-PDF returns 400", async () => {
    const res = await request(app)
      .post("/api/verify/by-file")
      .attach("pdfFile", Buffer.from("not pdf"), {
        filename: "test.txt",
        contentType: "text/plain",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pdf/i);
  });

  test("POST /api/verify/by-hash invalid hash returns exists=false", async () => {
    const res = await request(app).post("/api/verify/by-hash").send({ certHash: "0xinvalid" });
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });

  test("Verify rate limit returns 429 after excessive requests", async () => {
    let last;
    for (let i = 0; i < 21; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      last = await request(app)
        .post("/api/verify/by-id")
        .set("X-Test-Rate-Limit-Key", "verify-limit-test")
        .send({ certId: `INVALID${i}` });
    }
    expect(last.status).toBe(429);
    expect(last.body.success).toBe(false);
  });
});

describe("Certificates protected routes", () => {
  test("GET /api/certificates without token returns 401", async () => {
    const res = await request(app).get("/api/certificates");
    expect(res.status).toBe(401);
  });

  test("GET /api/certificates with token returns empty paginated data", async () => {
    const token = await createAdminToken();
    const res = await request(app)
      .get("/api/certificates")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  test("GET /api/certificates pagination works", async () => {
    const token = await createAdminToken();
    await createCertificate({ certId: "CERT-2026-PAGE0001" });
    await createCertificate({ certHash: `0x${"b".repeat(64)}`, certId: "CERT-2026-PAGE0002" });
    const res = await request(app)
      .get("/api/certificates?page=1&limit=1")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(2);
    expect(res.body.totalPages).toBe(2);
  });

  test("GET /api/certificates search filters by name", async () => {
    const token = await createAdminToken();
    await createCertificate({ certId: "CERT-2026-NGUYEN01", recipientName: "Nguyen Van A" });
    await createCertificate({ certHash: `0x${"b".repeat(64)}`, certId: "CERT-2026-TRAN0001", recipientName: "Tran Thi B" });
    const res = await request(app)
      .get("/api/certificates?search=nguyen")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].recipientName).toBe("Nguyen Van A");
  });

  test("GET /api/certificates status=valid filters correctly", async () => {
    const token = await createAdminToken();
    await createCertificate({ certId: "CERT-2026-VALID001", isRevoked: false });
    await createCertificate({ certHash: `0x${"b".repeat(64)}`, certId: "CERT-2026-REVOK001", isRevoked: true });
    const res = await request(app)
      .get("/api/certificates?status=valid")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isRevoked).toBe(false);
  });

  test("GET /api/certificates/stats returns stats object", async () => {
    const token = await createAdminToken();
    await createCertificate({ certId: "CERT-2026-STATS001" });
    const res = await request(app)
      .get("/api/certificates/stats")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(Array.isArray(res.body.monthlyData)).toBe(true);
  });

  test("POST /api/certificates/sync-from-chain without token returns 401", async () => {
    const res = await request(app)
      .post("/api/certificates/sync-from-chain")
      .send({ txHash: `0x${"9".repeat(64)}` });
    expect(res.status).toBe(401);
  });

  test("POST /api/certificates/sync-from-chain missing txHash returns 400", async () => {
    const token = await createAdminToken();
    const res = await request(app)
      .post("/api/certificates/sync-from-chain")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/txHash/i);
  });

  test("POST /api/certificates/sync-from-chain saves on-chain certificate to MongoDB", async () => {
    const token = await createAdminToken();
    const res = await request(app)
      .post("/api/certificates/sync-from-chain")
      .set("Authorization", `Bearer ${token}`)
      .send({ txHash: `0x${"9".repeat(64)}` });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.certificate.certId).toBe("CERT-2026-SYNC0001");

    const list = await request(app)
      .get("/api/certificates?search=SYNC0001")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].recipientName).toBe("Synced User");
  });

  test("POST /api/certificates/sync-from-chain rejects a transaction for another contract", async () => {
    const token = await createAdminToken();
    blockchainService.getProvider.mockReturnValueOnce({
      getTransactionReceipt: jest.fn().mockResolvedValue({
        status: 1,
        to: "0x2222222222222222222222222222222222222222",
        blockNumber: 16,
        logs: [],
      }),
    });

    const res = await request(app)
      .post("/api/certificates/sync-from-chain")
      .set("Authorization", `Bearer ${token}`)
      .send({ txHash: `0x${"8".repeat(64)}` });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/configured CertRegistry/i);
  });

  test("POST /api/certificates/prepare-metamask-issue uploads IPFS data without chain write", async () => {
    const token = await createAdminToken();
    const res = await request(app)
      .post("/api/certificates/prepare-metamask-issue")
      .set("Authorization", `Bearer ${token}`)
      .attach("pdfFile", makePdf("metamask direct"), {
        filename: "metamask.pdf",
        contentType: "application/pdf",
      })
      .field("certId", "CERT-2026-MMASK001");

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.ipfsCID).toBe("bafytestcid");
    expect(res.body.certHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(ipfsService.uploadPDFToIPFS).toHaveBeenCalled();
    expect(blockchainService.issueCertOnChain).not.toHaveBeenCalled();
  });

  test("POST /api/certificates/issue without file returns 400", async () => {
    const token = await createAdminToken();
    const res = await request(app)
      .post("/api/certificates/issue")
      .set("Authorization", `Bearer ${token}`)
      .field("recipientName", "Nguyen Van A")
      .field("courseName", "Blockchain")
      .field("issuingOrg", "FPT");
    expect(res.status).toBe(400);
  });

  test("POST /api/certificates/issue without auth returns 401", async () => {
    const res = await request(app)
      .post("/api/certificates/issue")
      .attach("pdfFile", makePdf(), { filename: "cert.pdf", contentType: "application/pdf" })
      .field("recipientName", "Nguyen Van A")
      .field("courseName", "Blockchain")
      .field("issuingOrg", "FPT");
    expect(res.status).toBe(401);
  });

  test("PUT /api/certificates/:hash/revoke without reason uses default and succeeds for existing cert", async () => {
    const token = await createAdminToken();
    await createCertificate();
    const res = await request(app)
      .put(`/api/certificates/${encodeURIComponent(validHash)}/revoke`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("PUT /api/certificates/nonexistent/revoke returns 400 invalid hash", async () => {
    const token = await createAdminToken();
    const res = await request(app)
      .put("/api/certificates/nonexistent/revoke")
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "No cert" });
    expect(res.status).toBe(400);
  });
});

describe("Input validation", () => {
  test("SQL/NoSQL-like search param is escaped and does not crash", async () => {
    const token = await createAdminToken();
    const res = await request(app)
      .get('/api/certificates?search[$ne]=x')
      .set("Authorization", `Bearer ${token}`);
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) expect(res.body.success).toBe(true);
  });

  test("XSS in recipientName is sanitized on issue", async () => {
    const token = await createAdminToken();
    const res = await request(app)
      .post("/api/certificates/issue")
      .set("Authorization", `Bearer ${token}`)
      .attach("pdfFile", makePdf("xss"), { filename: "cert.pdf", contentType: "application/pdf" })
      .field("recipientName", "<script>alert(1)</script> Nguyen")
      .field("courseName", "Blockchain")
      .field("issuingOrg", "FPT");
    expect(res.status).toBe(201);
    expect(res.body.certificate.recipientName).not.toContain("<script>");
  });

  test(".exe file upload is rejected", async () => {
    const token = await createAdminToken();
    const res = await request(app)
      .post("/api/certificates/issue")
      .set("Authorization", `Bearer ${token}`)
      .attach("pdfFile", Buffer.from("MZ"), { filename: "malware.exe", contentType: "application/pdf" })
      .field("recipientName", "Nguyen Van A")
      .field("courseName", "Blockchain")
      .field("issuingOrg", "FPT");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pdf/i);
  });

  test("11MB PDF upload is rejected", async () => {
    const token = await createAdminToken();
    const oversized = Buffer.alloc(11 * 1024 * 1024, "a");
    const res = await request(app)
      .post("/api/certificates/issue")
      .set("Authorization", `Bearer ${token}`)
      .attach("pdfFile", oversized, { filename: "big.pdf", contentType: "application/pdf" })
      .field("recipientName", "Nguyen Van A")
      .field("courseName", "Blockchain")
      .field("issuingOrg", "FPT");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too large/i);
  });

  test("empty certId returns validation error", async () => {
    const res = await request(app).post("/api/verify/by-id").send({ certId: "" });
    expect(res.status).toBe(400);
  });

  test("certId with unsafe special chars returns validation error", async () => {
    const res = await request(app).post("/api/verify/by-id").send({ certId: "<script>" });
    expect(res.status).toBe(400);
  });
});

describe("Error handling", () => {
  test("Database disconnected-like error returns 503", async () => {
    const error = new Error("MongoDB connection failed: ECONNREFUSED 127.0.0.1:27017");
    error.name = "MongoServerSelectionError";
    jest.spyOn(Certificate, "findOne").mockRejectedValueOnce(error);
    const res = await request(app).post("/api/verify/by-id").send({ certId: "CERT-2026-ERR0001" });
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });

  test("IPFS service down returns 503 friendly error", async () => {
    const token = await createAdminToken();
    ipfsService.uploadPDFToIPFS.mockRejectedValueOnce(new Error("Pinata unavailable"));
    const res = await request(app)
      .post("/api/certificates/issue")
      .set("Authorization", `Bearer ${token}`)
      .attach("pdfFile", makePdf("ipfs"), { filename: "cert.pdf", contentType: "application/pdf" })
      .field("recipientName", "Nguyen Van A")
      .field("courseName", "Blockchain")
      .field("issuingOrg", "FPT");
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/IPFS service/i);
  });

  test("Blockchain service down returns 503 friendly error", async () => {
    await createCertificate({ certId: "CERT-2026-CHAIN001" });
    blockchainService.verifyCertOnChain.mockRejectedValueOnce(new Error("RPC is unavailable"));
    const res = await request(app)
      .post("/api/verify/by-id")
      .send({ certId: "CERT-2026-CHAIN001" });
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Blockchain service/i);
  });

  test("production errors do not expose stack traces", async () => {
    const previous = process.env.NODE_ENV;
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    process.env.NODE_ENV = "production";
    jest.spyOn(Certificate, "findOne").mockRejectedValueOnce(new Error("sensitive stack detail"));
    const res = await request(app).post("/api/verify/by-id").send({ certId: "CERT-2026-PRODERR" });
    process.env.NODE_ENV = previous;
    consoleSpy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Internal server error");
  });
});
