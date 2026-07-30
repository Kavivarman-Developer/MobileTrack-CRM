require("dotenv").config();
const connectDB = require("../config/db");
const Brand = require("../models/Brand");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Role = require("../models/Role");
const User = require("../models/User");

async function seed() {
  await connectDB();
  const adminRole = await Role.findOneAndUpdate({ name: "admin" }, { name: "admin" }, { upsert: true, returnDocument: "after" });
  await Role.findOneAndUpdate({ name: "staff" }, { name: "staff" }, { upsert: true, returnDocument: "after" });

  let admin = await User.findOne({ email: "kavin@gmail.com" });
  if (!admin) {
    admin = new User({ name: "Admin User", email: "kavin@gmail.com", password: "kavin@123", role: adminRole._id, phone: "9943958576" });
  } else {
    admin.name = "Admin User";
    admin.password = "kavin@123";
    admin.role = adminRole._id;
    admin.phone = "9943958576";
  }
  await admin.save();

  const smartphones = await Category.findOneAndUpdate({ name: "Smartphones" }, { name: "Smartphones" }, { upsert: true, returnDocument: "after" });
  const tablets = await Category.findOneAndUpdate({ name: "Tablets" }, { name: "Tablets" }, { upsert: true, returnDocument: "after" });
  const accessories = await Category.findOneAndUpdate({ name: "Accessories" }, { name: "Accessories" }, { upsert: true, returnDocument: "after" });
  const samsung = await Brand.findOneAndUpdate({ name: "Samsung" }, { name: "Samsung" }, { upsert: true, returnDocument: "after" });
  const apple = await Brand.findOneAndUpdate({ name: "Apple" }, { name: "Apple" }, { upsert: true, returnDocument: "after" });
  const xiaomi = await Brand.findOneAndUpdate({ name: "Xiaomi" }, { name: "Xiaomi" }, { upsert: true, returnDocument: "after" });
  const boat = await Brand.findOneAndUpdate({ name: "boAt" }, { name: "boAt" }, { upsert: true, returnDocument: "after" });
  const acme = await Brand.findOneAndUpdate({ name: "Acme" }, { name: "Acme" }, { upsert: true, returnDocument: "after" });

  // Products
  const products = [
    { name: "Samsung Galaxy M14 5G (128GB)", sku: "SAM-M14-128", category: smartphones._id, brand: samsung._id, price: 12999, costPrice: 10800, stockQty: 15, lowStockThreshold: 5 },
    { name: "iPhone 13 (128GB)", sku: "APL-IP13-128", category: smartphones._id, brand: apple._id, price: 46999, costPrice: 41000, stockQty: 6, lowStockThreshold: 3 },
    { name: "Redmi Note 13 (128GB)", sku: "XMI-RN13-128", category: smartphones._id, brand: xiaomi._id, price: 14999, costPrice: 12500, stockQty: 22, lowStockThreshold: 6 },
    { name: "Samsung Galaxy Tab A9", sku: "SAM-TABA9", category: tablets._id, brand: samsung._id, price: 13999, costPrice: 11800, stockQty: 8, lowStockThreshold: 3 },
    { name: "boAt Airdopes 141", sku: "BOAT-AD141", category: accessories._id, brand: boat._id, price: 1299, costPrice: 850, stockQty: 40, lowStockThreshold: 10 },
    { name: "Fast Charger 33W (Type-C)", sku: "ACC-CHG33W", category: accessories._id, brand: xiaomi._id, price: 799, costPrice: 550, stockQty: 3, lowStockThreshold: 8 },
    { name: "Tempered Glass Screen Guard", sku: "ACC-GLASS", category: accessories._id, brand: acme._id, price: 149, costPrice: 60, stockQty: 60, lowStockThreshold: 15 },
  ];

  for (const product of products) {
    await Product.findOneAndUpdate({ sku: product.sku }, product, { upsert: true, returnDocument: "after" });
  }

  console.log("Seed complete: kavin@gmail.com / kavin@123");
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
