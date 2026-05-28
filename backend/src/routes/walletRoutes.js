const router = require("express").Router();
const { ethers } = require("ethers");
const AllowedWallet = require("../models/AllowedWallet");
const { verifyJWT, requireSuperAdmin } = require("../middleware/auth");
const { auditLogger } = require("../middleware/auditLogger");
const { validateRequest, validators } = require("../middleware/security");

function normalizeAddress(value) {
  return ethers.getAddress(String(value || "").trim()).toLowerCase();
}

router.use(verifyJWT, requireSuperAdmin);

router.get("/", async (_req, res, next) => {
  try {
    const wallets = await AllowedWallet.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, wallets });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/",
  validators.wallet,
  validateRequest,
  auditLogger("ADD_WALLET", (req) => ({ address: req.body.address, label: req.body.label })),
  async (req, res, next) => {
    try {
      const address = normalizeAddress(req.body.address);
      const label = String(req.body.label || "").trim();
      const wallet = await AllowedWallet.findOneAndUpdate(
        { address },
        {
          $set: {
            address,
            label,
            isActive: true,
          },
          $setOnInsert: {
            addedBy: req.admin.id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return res.status(201).json({ success: true, wallet });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/:id",
  validators.walletId,
  validateRequest,
  auditLogger("UPDATE_WALLET", (req) => ({ id: req.params.id, isActive: req.body.isActive })),
  async (req, res, next) => {
    try {
      const update = {};
      if (typeof req.body.isActive === "boolean") update.isActive = req.body.isActive;
      if (typeof req.body.label === "string") update.label = req.body.label.trim().slice(0, 120);

      const wallet = await AllowedWallet.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
      if (!wallet) {
        return res.status(404).json({ success: false, error: "Wallet not found", code: "WALLET_NOT_FOUND" });
      }
      return res.json({ success: true, wallet });
    } catch (error) {
      return next(error);
    }
  }
);

router.delete(
  "/:id",
  validators.walletId,
  validateRequest,
  auditLogger("DELETE_WALLET", (req) => ({ id: req.params.id })),
  async (req, res, next) => {
    try {
      const wallet = await AllowedWallet.findByIdAndDelete(req.params.id);
      if (!wallet) {
        return res.status(404).json({ success: false, error: "Wallet not found", code: "WALLET_NOT_FOUND" });
      }
      return res.json({ success: true, message: "Wallet removed" });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
