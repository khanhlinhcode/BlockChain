process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const jwt = require("jsonwebtoken");
const request = require("supertest");

const app = require("../src/app");
const Admin = require("../src/models/Admin");
const Certificate = require("../src/models/Certificate");
const blockchainService = require("../src/services/blockchainService");

describe("Certificate API", () => {
  let adminToken;

  const adminPayload = {
    _id: "507f191e810c19729de860ea",
    username: "admin",
    role: "superadmin",
    walletAddress: "0x1111111111111111111111111111111111111111",
    isActive: true,
    comparePassword: jest.fn(),
    save: jest.fn(),
  };

  const makeListQueryChain = (rows) => ({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    jest.spyOn(blockchainService, "normalizeHash").mockImplementation((hash) => {
      if (!/^0x[0-9a-fA-F]{64}$/.test(String(hash))) {
        throw new Error("Invalid certHash format");
      }
      return String(hash).toLowerCase();
    });
    jest.spyOn(blockchainService, "revokeCertOnChain").mockResolvedValue({
      txHash: `0x${"1".repeat(64)}`,
      blockNumber: 123,
      gasUsed: "21000",
    });
    jest.spyOn(blockchainService, "verifyCertOnChain").mockResolvedValue({
      exists: false,
      isValid: false,
      isRevoked: false,
      cert: null,
    });

    adminPayload.comparePassword.mockResolvedValue(true);
    adminPayload.save.mockResolvedValue(adminPayload);

    jest.spyOn(Admin, "findOne").mockImplementation(() => ({
      select: jest.fn().mockResolvedValue(adminPayload),
    }));
    jest.spyOn(Admin, "findById").mockResolvedValue(adminPayload);

    jest.spyOn(Certificate, "findOne").mockResolvedValue(null);
    jest.spyOn(Certificate, "find").mockImplementation(() => makeListQueryChain([]));
    jest.spyOn(Certificate, "countDocuments").mockResolvedValue(0);

    adminToken = jwt.sign(
      {
        id: adminPayload._id,
        username: adminPayload.username,
        role: adminPayload.role,
        walletAddress: adminPayload.walletAddress,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );
  });

  test("POST /api/verify/by-id with invalid ID returns exists=false", async () => {
    const res = await request(app)
      .post("/api/verify/by-id")
      .send({ certId: "CERT-INVALID-000" });

    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
    expect(res.body.isValid).toBe(false);
  });

  test("POST /api/auth/login with wrong password returns 401", async () => {
    adminPayload.comparePassword.mockResolvedValueOnce(false);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("POST /api/auth/login with valid credentials returns token", async () => {
    adminPayload.comparePassword.mockResolvedValueOnce(true);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "Admin@123456" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(10);
    expect(res.body.admin.username).toBe("admin");
  });

  test("GET /api/certificates without token returns 401", async () => {
    const res = await request(app).get("/api/certificates");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("POST /api/certificates/issue with non-PDF returns 400", async () => {
    const res = await request(app)
      .post("/api/certificates/issue")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("pdfFile", Buffer.from("not a pdf"), {
        filename: "test.txt",
        contentType: "text/plain",
      })
      .field("recipientName", "Test User")
      .field("courseName", "Test Course")
      .field("issuingOrg", "Test Org");

    expect(res.status).toBe(400);
    expect(String(res.body.error || "")).toMatch(/pdf/i);
  });

  test("GET /api/auth/me returns admin profile for valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.admin.username).toBe("admin");
    expect(res.body.admin.role).toBe("superadmin");
  });

  test("GET /api/certificates with token returns paginated payload", async () => {
    const listRows = [
      {
        certHash: `0x${"a".repeat(64)}`,
        certId: "CERT-2024-UNIT01",
        recipientName: "Test User",
        courseName: "Test Course",
      },
    ];
    Certificate.find.mockImplementationOnce(() => makeListQueryChain(listRows));
    Certificate.countDocuments.mockResolvedValueOnce(1);

    const res = await request(app)
      .get("/api/certificates?page=1&limit=20")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.certificates).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  test("POST /api/verify/by-id with missing certId returns 400", async () => {
    const res = await request(app).post("/api/verify/by-id").send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("POST /api/verify/by-hash with invalid hash returns 400", async () => {
    const res = await request(app)
      .post("/api/verify/by-hash")
      .send({ certHash: "invalid_hash" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(String(res.body.error || "")).toMatch(/invalid/i);
  });

  test("GET /api/verify/:certId/history for unknown cert returns 404", async () => {
    Certificate.findOne.mockResolvedValueOnce(null);
    const res = await request(app).get("/api/verify/CERT-NOT-FOUND/history");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test("PUT /api/certificates/:certHash/revoke for unknown hash returns 404", async () => {
    Certificate.findOne.mockResolvedValueOnce(null);
    const unknownHash = `0x${"a".repeat(64)}`;
    const res = await request(app)
      .put(`/api/certificates/${encodeURIComponent(unknownHash)}/revoke`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "No certificate" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test("POST /api/auth/logout invalidates current token", async () => {
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Keep auth check deterministic after logout
    jest.spyOn(Admin, "findById").mockResolvedValue(adminPayload);

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(meRes.status).toBe(401);
    expect(meRes.body.success).toBe(false);
  });

  test("GET /api/certificates with expired token returns 401", async () => {
    const expiredToken = jwt.sign(
      {
        id: adminPayload._id,
        username: adminPayload.username,
        role: adminPayload.role,
        walletAddress: adminPayload.walletAddress,
      },
      process.env.JWT_SECRET,
      { expiresIn: -10 }
    );

    const res = await request(app)
      .get("/api/certificates")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(String(res.body.error || "")).toMatch(/expired/i);
  });
});
