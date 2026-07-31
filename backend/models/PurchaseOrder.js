const mongoose = require("mongoose");

const purchaseOrderSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    items: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
      quantity: { type: Number, required: true, min: 1 },
      costPrice: { type: Number, required: true, min: 0 },
    }],
    status: { type: String, enum: ["draft", "ordered", "received", "cancelled"], default: "draft" },
    totalAmount: { type: Number, default: 0 },
    orderDate: { type: Date, default: Date.now },
    receivedDate: Date,
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

purchaseOrderSchema.pre("validate", function calculateTotal(next) {
  this.totalAmount = (this.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.costPrice || 0), 0);
  next();
});

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
