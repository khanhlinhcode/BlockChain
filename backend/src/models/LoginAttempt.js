const mongoose = require("mongoose");

const loginAttemptSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    ip: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
      index: true,
    },
    lastAttemptAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

loginAttemptSchema.index({ identifier: 1, ip: 1 }, { unique: true });

module.exports = mongoose.model("LoginAttempt", loginAttemptSchema);
