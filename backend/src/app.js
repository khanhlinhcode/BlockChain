require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");
const { version } = require("../package.json");
const { apiLimiter } = require("./middleware/rateLimit");
const config = require("./config");

// ── Routes ──
const authRoutes = require("./routes/auth");
const certRoutes = require("./routes/certificates");
const verifyRoutes = require("./routes/verify");

const app = express();

function resolveAllowedOrigins() {
  const configured = [
    process.env.FRONTEND_URL,
    process.env.NEXT_PUBLIC_FRONTEND_URL,
    config.frontend.url,
    config.frontend.prodUrl,
    process.env.CORS_ALLOWED_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const defaults = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://certchain-app.vercel.app",
  ];
  return Array.from(new Set([...configured, ...defaults]));
}

function isLocalDevOrigin(origin) {
  if (process.env.NODE_ENV === "production") return false;

  try {
    const url = new URL(origin);
    return (
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "::1") &&
      /^30\d\d$/.test(url.port)
    );
  } catch {
    return false;
  }
}

const allowedOrigins = resolveAllowedOrigins();
const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser requests (curl/postman/server-to-server).
    if (!origin) {
      return callback(null, true);
    }
    try {
      const hostname = new URL(origin).hostname.toLowerCase();
      if (hostname === "vercel.app" || hostname.endsWith(".vercel.app")) {
        return callback(null, true);
      }
    } catch {
      // Fall through to explicit allow-list checks.
    }
    if (allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
      return callback(null, true);
    }
    const err = new Error("Not allowed by CORS");
    err.status = 403;
    return callback(err);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// ── Security & Parsing ──
app.use(helmet());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
if (process.env.NODE_ENV !== "test" && process.env.JEST_WORKER_ID === undefined) {
  app.use(morgan("dev"));
}
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Dynamic API data changes after blockchain transactions and MongoDB writes.
// Disable conditional GET/ETag caching so admin tables never render stale 304
// responses after issuing, revoking, or syncing certificates.
app.set("etag", false);
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

// ── Static files (QR codes) ──
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ── General API rate limiter ──
app.use("/api", apiLimiter);

// ── API Routes ──
app.use("/api/auth", authRoutes);
app.use("/api/certificates", certRoutes);
app.use("/api/verify", verifyRoutes);

// ── Health Check ──
const healthHandler = (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || version || "1.0.0",
    environment: config.nodeEnv,
    chain: config.blockchain.contractAddress || "not configured",
    network: "Ethereum Sepolia (11155111)",
  });
};

app.get("/health", healthHandler);
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── 404 ──
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// ── Global Error Handler ──
app.use((err, _req, res, _next) => {
  if (err.message === "CORS origin not allowed" || err.message === "Not allowed by CORS") {
    return res.status(403).json({ success: false, error: "Not allowed by CORS" });
  }

  // Multer file-type / size errors
  if (err.message === "Only PDF files are allowed") {
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res
      .status(400)
      .json({ success: false, error: "File too large. Maximum 10MB allowed." });
  }

  const isDatabaseUnavailable =
    err.name === "MongoServerSelectionError" ||
    err.name === "MongooseServerSelectionError" ||
    /ECONNREFUSED.*27017|MongoDB connection/i.test(err.message || "");
  const isServiceUnavailable =
    err.status === 503 ||
    isDatabaseUnavailable ||
    /IPFS service|Blockchain service|RPC is unavailable/i.test(err.message || "");

  if (process.env.NODE_ENV !== "test") {
    console.error(err.stack || err.message);
  }
  res.status(isServiceUnavailable ? 503 : err.status || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? isServiceUnavailable
          ? "Service temporarily unavailable"
          : "Internal server error"
        : err.message,
  });
});

// ── Start ──
const PORT = config.port;
const MONGODB_URI = config.mongodb.uri || "mongodb://localhost:27017/certchain";

async function connectDatabase(uri = MONGODB_URI) {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return mongoose.connection;
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return mongoose.connection;
}

async function startServer({ port = PORT, mongoUri = MONGODB_URI } = {}) {
  await connectDatabase(mongoUri);
  if (process.env.NODE_ENV !== "production") {
    console.log("✅ MongoDB connected");
  }
  const server = app.listen(port, () => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`🚀 CertChain API running on http://localhost:${port}`);
      console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
    }
  });
  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
}

process.on("SIGINT", async () => {
  try {
    await mongoose.disconnect();
  } finally {
    process.exit(0);
  }
});

process.on("SIGTERM", async () => {
  try {
    await mongoose.disconnect();
  } finally {
    process.exit(0);
  }
});

module.exports = app;
module.exports.connectDatabase = connectDatabase;
module.exports.startServer = startServer;
