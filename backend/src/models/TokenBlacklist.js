const mongoose = require("mongoose");

const tokenBlacklistSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    invalidatedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      default: "logout",
      trim: true,
      maxlength: 80,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TokenBlacklist", tokenBlacklistSchema);
