require("dotenv").config();
const connectDB = require("../config/db");
const Product = require("../models/Product");

async function migrate() {
  await connectDB();
  const products = await Product.find();
  for (const product of products) {
    product.sellingPrice = product.sellingPrice ?? product.price;
    product.price = product.price ?? product.sellingPrice;
    product.reorderPoint = product.reorderPoint ?? product.lowStockThreshold;
    product.lowStockThreshold = product.lowStockThreshold ?? product.reorderPoint;
    await product.save();
  }
  console.log(`Migrated ${products.length} products`);
  process.exit(0);
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
