const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
    amount: { type: Number, required: true },
    method: { type: String, default: "cash" },
    paymentRef: String,
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
