const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: "OrderItem" }],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentStatus: { type: String, enum: ["paid", "partial", "pending"], default: "paid" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
