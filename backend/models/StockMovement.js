const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  type: { type: String, enum: ["IN", "OUT"], required: true },
  quantity: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true },
  refOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  note: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

stockMovementSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model("StockMovement", stockMovementSchema);
