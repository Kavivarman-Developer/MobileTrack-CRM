const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    amount: { type: Number, required: true },
    method: { type: String, default: "cash" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
