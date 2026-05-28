const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
      enum: [
        "LOGIN",
        "LOGIN_METAMASK",
        "LOGOUT",
        "ISSUE_CERT",
        "REVOKE_CERT",
        "ADD_WALLET",
        "UPDATE_WALLET",
        "DELETE_WALLET",
      ],
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      index: true,
    },
    adminUsername: {
      type: String,
      default: "",
      trim: true,
    },
    ip: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    userAgent: {
      type: String,
      default: "",
      trim: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["success", "failure"],
      default: "success",
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: { expires: 60 * 60 * 24 * 90 },
    },
  },
  { versionKey: false }
);

auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
