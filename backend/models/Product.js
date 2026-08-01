const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },
    price: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, required: true, min: 0 },
    stockQty: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    images: [String],
    type: { type: String, enum: ["standalone", "accessory"], default: "standalone" },
    compatibleWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    barcode: { type: String, trim: true },
    itemType: { type: String, enum: ["goods", "service"], default: "goods" },
    unit: { type: String, default: "pcs" },
    returnable: { type: Boolean, default: true },
    sellingPrice: { type: Number, required: true, min: 0 },
    salesAccount: { type: String, default: "Sales" },
    salesDescription: { type: String, default: "" },
    purchaseAccount: { type: String, default: "Cost of Goods Sold" },
    purchaseDescription: { type: String, default: "" },
    preferredVendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
    trackInventory: { type: Boolean, default: true },
    inventoryAccount: { type: String, default: "Inventory Asset" },
    openingStock: { type: Number, default: 0 },
    openingStockRatePerUnit: { type: Number, default: 0 },
    inventoryValuationMethod: { type: String, enum: ["FIFO", "LIFO", "Average"], default: "FIFO" },
    // Kept alongside lowStockThreshold so existing dashboard/sales logic remains compatible.
    reorderPoint: { type: Number, default: 0, min: 0 },
    dimensions: {
      length: { type: Number, default: null },
      width: { type: Number, default: null },
      height: { type: Number, default: null },
      unit: { type: String, default: "cm" },
    },
    weight: { type: Number, default: null },
    weightUnit: { type: String, default: "kg" },
    manufacturer: { type: String, default: "" },
    upc: { type: String, default: "" },
    mpn: { type: String, default: "" },
    ean: { type: String, default: "" },
    isbn: { type: String, default: "" },
  },
  { timestamps: true }
);

productSchema.index(
  { organizationId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: "string", $gt: "" } } }
);
productSchema.index(
  { organizationId: 1, barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: "string", $gt: "" } } }
);

productSchema.pre("validate", function syncZohoInventoryFields(next) {
  if (this.sellingPrice === undefined || this.sellingPrice === null) this.sellingPrice = this.price;
  if (this.price === undefined || this.price === null) this.price = this.sellingPrice;
  if (!this.reorderPoint && this.reorderPoint !== 0) this.reorderPoint = this.lowStockThreshold;
  if (this.lowStockThreshold === undefined || this.lowStockThreshold === null) this.lowStockThreshold = this.reorderPoint;
  next();
});

module.exports = mongoose.model("Product", productSchema);
