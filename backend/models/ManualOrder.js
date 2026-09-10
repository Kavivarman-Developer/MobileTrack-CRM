const mongoose = require("mongoose");

const timelineEntrySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, required: true },
  },
  { _id: false }
);

const manualOrderSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    orderNo: { type: String, required: true },
    customerName: { type: String, required: true },
    phone: String,
    shippingAddress: String,
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["new", "process", "pending", "shipped", "delivered"], default: "new" },
    paymentStatus: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    timeline: { type: [timelineEntrySchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ManualOrder", manualOrderSchema);
