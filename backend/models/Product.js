const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },
    price: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, required: true, min: 0 },
    stockQty: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    images: [String],
    type: { type: String, enum: ["standalone", "accessory"], default: "standalone" },
    compatibleWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    barcode: { type: String, unique: true, sparse: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
