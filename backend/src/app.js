require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");
const { version } = require("../package.json");
const { apiLimiter } = require("./middleware/rateLimit");

// ── Routes ──
const authRoutes = require("./routes/auth");
const certRoutes = require("./routes/certificates");
const verifyRoutes = require("./routes/verify");

const app = express();

function resolveAllowedOrigins() {
  const configured = [
    process.env.FRONTEND_URL,
    process.env.CORS_ALLOWED_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const defaults = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://your-production-domain.com",
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
    if (allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
      return callback(null, true);
    }
    const err = new Error("CORS origin not allowed");
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
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

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
  const contractAddress = process.env.CONTRACT_ADDRESS || null;
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version,
    chain: contractAddress,
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// ── 404 ──
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// ── Global Error Handler ──
app.use((err, _req, res, _next) => {
  if (err.message === "CORS origin not allowed") {
    return res.status(403).json({ success: false, error: "CORS origin not allowed" });
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

  console.error(err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// ── Start ──
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/certchain";

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
