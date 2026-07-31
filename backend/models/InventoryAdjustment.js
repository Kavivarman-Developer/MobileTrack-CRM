const mongoose = require("mongoose");

const inventoryAdjustmentSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    adjustmentType: { type: String, enum: ["increase", "decrease"], required: true },
    quantity: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InventoryAdjustment", inventoryAdjustmentSchema);
