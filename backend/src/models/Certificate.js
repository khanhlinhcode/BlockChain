const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
  {
    certHash: {
      type: String,
      required: true,
      unique: true,
    },
    certId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    ipfsCID: {
      type: String,
      required: true,
    },
    ipfsUrl: {
      type: String,
      required: true,
    },
    recipientName: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    courseName: {
      type: String,
      required: true,
      trim: true,
    },
    issuingOrg: {
      type: String,
      required: true,
      trim: true,
    },
    issuerAddress: {
      type: String,
      required: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: String,
      default: null,
    },
    revokeReason: {
      type: String,
      default: null,
    },
    revokeTxHash: {
      type: String,
      default: null,
    },
    revokeBlockNumber: {
      type: Number,
      default: null,
    },
    txHash: {
      type: String,
      default: null,
    },
    blockNumber: {
      type: Number,
      default: null,
    },
    qrCodeUrl: {
      type: String,
      default: null,
    },
    qrVerifyUrl: {
      type: String,
      default: "",
    },
    verificationCount: {
      type: Number,
      default: 0,
    },
    lastVerifiedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Text index for search across recipient and course
certificateSchema.index({ recipientName: "text", courseName: "text", certId: "text" });

module.exports = mongoose.model("Certificate", certificateSchema);
