const mongoose = require("mongoose");

const vendorCallSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    type: { type: String, enum: ["outgoing", "incoming", "missed"], required: true },
    phone: { type: String, default: "", trim: true },
    note: { type: String, default: "" },
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

vendorCallSchema.index({ organizationId: 1, vendor: 1, occurredAt: -1 });

module.exports = mongoose.model("VendorCall", vendorCallSchema);
