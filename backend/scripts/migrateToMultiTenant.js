require("dotenv").config();
const connectDB = require("../config/db");
const Customer = require("../models/Customer");
const Expense = require("../models/Expense");
const InventoryAdjustment = require("../models/InventoryAdjustment");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Organization = require("../models/Organization");
const Product = require("../models/Product");
const PurchaseOrder = require("../models/PurchaseOrder");
const StockMovement = require("../models/StockMovement");
const User = require("../models/User");
const Vendor = require("../models/Vendor");

const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_TENANT_ADMIN_EMAIL || "kavin@gmail.com";

async function updateModel(Model, organizationId) {
  const result = await Model.updateMany(
    { $or: [{ organizationId: { $exists: false } }, { organizationId: null }] },
    { $set: { organizationId } }
  );
  return result.modifiedCount || 0;
}

async function migrate() {
  await connectDB();
  const owner = await User.findOne({ email: DEFAULT_ADMIN_EMAIL });
  if (!owner) throw new Error(`Owner user not found: ${DEFAULT_ADMIN_EMAIL}`);

  const organization = await Organization.findOneAndUpdate(
    { ownerUserId: owner._id },
    { name: owner.name ? `${owner.name}'s Organization` : "Default Organization", ownerUserId: owner._id, plan: "free", isActive: true },
    { upsert: true, returnDocument: "after" }
  );

  owner.role = "admin";
  owner.organizationId = organization._id;
  owner.authProvider = owner.authProvider || "local";
  await owner.save();

  const summary = {
    products: await updateModel(Product, organization._id),
    orders: await updateModel(Order, organization._id),
    orderItems: await updateModel(OrderItem, organization._id),
    customers: await updateModel(Customer, organization._id),
    expenses: await updateModel(Expense, organization._id),
    vendors: await updateModel(Vendor, organization._id),
    purchaseOrders: await updateModel(PurchaseOrder, organization._id),
    inventoryAdjustments: await updateModel(InventoryAdjustment, organization._id),
    stockMovements: await updateModel(StockMovement, organization._id),
  };

  await Product.collection.dropIndex("sku_1").catch(() => {});
  await Product.collection.dropIndex("barcode_1").catch(() => {});
  await Product.syncIndexes();

  console.log("Migration complete", {
    organizationId: organization._id.toString(),
    ownerEmail: owner.email,
    updated: summary,
  });
  process.exit(0);
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
