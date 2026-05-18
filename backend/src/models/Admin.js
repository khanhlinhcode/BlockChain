const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
    },
    passwordHash: {
      type: String,
      required: [true, "Password is required"],
      select: false, // exclude from queries by default
    },
    walletAddress: {
      type: String,
      unique: true,
      sparse: true,
      set: (value) => {
        if (value === null || value === undefined || String(value).trim() === "") {
          return undefined;
        }
        return String(value).trim().toLowerCase();
      },
    },
    role: {
      type: String,
      enum: ["superadmin", "admin"],
      default: "admin",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/**
 * Hash password before saving (only when setting raw password via virtual).
 */
adminSchema.virtual("password").set(function (value) {
  this._rawPassword = value;
});

adminSchema.pre("save", async function (next) {
  if (!this.walletAddress) {
    this.walletAddress = undefined;
  }

  // If _rawPassword was set via the virtual, hash it
  if (this._rawPassword) {
    this.passwordHash = await bcrypt.hash(this._rawPassword, 12);
  }
  next();
});

/**
 * Compare a candidate password against the stored hash.
 */
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model("Admin", adminSchema);
