require("dotenv").config();
const connectDB = require("../config/db");
const Brand = require("../models/Brand");
const Category = require("../models/Category");
const Organization = require("../models/Organization");
const Product = require("../models/Product");
const PurchaseOrder = require("../models/PurchaseOrder");
const User = require("../models/User");
const Vendor = require("../models/Vendor");

async function seed() {
  await connectDB();
  const organization = await Organization.findOneAndUpdate(
    { name: "Kavin Mobile Store" },
    { name: "Kavin Mobile Store", plan: "free", isActive: true },
    { upsert: true, returnDocument: "after" }
  );

  let admin = await User.findOne({ email: "kavin@gmail.com" });
  if (!admin) {
    admin = new User({ name: "Admin User", email: "kavin@gmail.com", password: "kavin@123", role: "admin", organizationId: organization._id, phone: "9943958576" });
  } else {
    admin.name = "Admin User";
    admin.password = "kavin@123";
    admin.role = "admin";
    admin.organizationId = organization._id;
    admin.phone = "9943958576";
  }
  await admin.save();
  organization.ownerUserId = admin._id;
  await organization.save();

  const smartphones = await Category.findOneAndUpdate({ name: "Smartphones" }, { name: "Smartphones" }, { upsert: true, returnDocument: "after" });
  const tablets = await Category.findOneAndUpdate({ name: "Tablets" }, { name: "Tablets" }, { upsert: true, returnDocument: "after" });
  const accessories = await Category.findOneAndUpdate({ name: "Accessories" }, { name: "Accessories" }, { upsert: true, returnDocument: "after" });
  const samsung = await Brand.findOneAndUpdate({ name: "Samsung" }, { name: "Samsung" }, { upsert: true, returnDocument: "after" });
  const apple = await Brand.findOneAndUpdate({ name: "Apple" }, { name: "Apple" }, { upsert: true, returnDocument: "after" });
  const xiaomi = await Brand.findOneAndUpdate({ name: "Xiaomi" }, { name: "Xiaomi" }, { upsert: true, returnDocument: "after" });
  const boat = await Brand.findOneAndUpdate({ name: "boAt" }, { name: "boAt" }, { upsert: true, returnDocument: "after" });
  const acme = await Brand.findOneAndUpdate({ name: "Acme" }, { name: "Acme" }, { upsert: true, returnDocument: "after" });

  // Products
  const vendorOne = await Vendor.findOneAndUpdate(
    { organizationId: organization._id, name: "Chennai Mobile Distributors" },
    { organizationId: organization._id, name: "Chennai Mobile Distributors", email: "sales@cmd.example", phone: "9876501234", address: "T Nagar, Chennai", gstNumber: "33ABCDE1234F1Z5" },
    { upsert: true, returnDocument: "after" }
  );
  await Vendor.findOneAndUpdate(
    { organizationId: organization._id, name: "Accessory Hub" },
    { organizationId: organization._id, name: "Accessory Hub", email: "orders@accessoryhub.example", phone: "9876504321", address: "Ritchie Street, Chennai" },
    { upsert: true, returnDocument: "after" }
  );

  const products = [
    { organizationId: organization._id, name: "Samsung Galaxy M14 5G (128GB)", sku: "SAM-M14-128", category: smartphones._id, brand: samsung._id, price: 12999, sellingPrice: 12999, costPrice: 10800, stockQty: 15, lowStockThreshold: 5, reorderPoint: 5, preferredVendor: vendorOne._id },
    { organizationId: organization._id, name: "iPhone 13 (128GB)", sku: "APL-IP13-128", category: smartphones._id, brand: apple._id, price: 46999, sellingPrice: 46999, costPrice: 41000, stockQty: 6, lowStockThreshold: 3, reorderPoint: 3, preferredVendor: vendorOne._id },
    { organizationId: organization._id, name: "Redmi Note 13 (128GB)", sku: "XMI-RN13-128", category: smartphones._id, brand: xiaomi._id, price: 14999, sellingPrice: 14999, costPrice: 12500, stockQty: 22, lowStockThreshold: 6, reorderPoint: 6, preferredVendor: vendorOne._id },
    { organizationId: organization._id, name: "Samsung Galaxy Tab A9", sku: "SAM-TABA9", category: tablets._id, brand: samsung._id, price: 13999, sellingPrice: 13999, costPrice: 11800, stockQty: 8, lowStockThreshold: 3, reorderPoint: 3, preferredVendor: vendorOne._id },
    { organizationId: organization._id, name: "boAt Airdopes 141", sku: "BOAT-AD141", category: accessories._id, brand: boat._id, price: 1299, sellingPrice: 1299, costPrice: 850, stockQty: 40, lowStockThreshold: 10, reorderPoint: 10 },
    { organizationId: organization._id, name: "Fast Charger 33W (Type-C)", sku: "ACC-CHG33W", category: accessories._id, brand: xiaomi._id, price: 799, sellingPrice: 799, costPrice: 550, stockQty: 3, lowStockThreshold: 8, reorderPoint: 8 },
    { organizationId: organization._id, name: "Tempered Glass Screen Guard", sku: "ACC-GLASS", category: accessories._id, brand: acme._id, price: 149, sellingPrice: 149, costPrice: 60, stockQty: 60, lowStockThreshold: 15, reorderPoint: 15 },
  ];

  const savedProducts = [];
  for (const product of products) {
    savedProducts.push(await Product.findOneAndUpdate({ organizationId: organization._id, sku: product.sku }, product, { upsert: true, returnDocument: "after" }));
  }

  const purchaseItems = savedProducts.slice(0, 2).map((product) => ({ product: product._id, quantity: 2, costPrice: product.costPrice }));
  await PurchaseOrder.findOneAndUpdate(
    { organizationId: organization._id, notes: "Sample opening PO" },
    {
      vendor: vendorOne._id,
      organizationId: organization._id,
      items: purchaseItems,
      status: "ordered",
      totalAmount: purchaseItems.reduce((sum, item) => sum + item.quantity * item.costPrice, 0),
      notes: "Sample opening PO",
    },
    { upsert: true, returnDocument: "after" }
  );

  console.log("Seed complete: kavin@gmail.com / kavin@123");
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
