const Customer = require("../models/Customer");
const Expense = require("../models/Expense");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Organization = require("../models/Organization");
const Product = require("../models/Product");
const User = require("../models/User");

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

async function orgStats(organizationId) {
  const now = new Date();
  const today = startOfDay(now);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const match = { organizationId };
  const [productCount, customerCount, salesAgg, orderCount, todaySalesAgg, monthSalesAgg, expenseAgg, profitAgg, lowStockProducts] = await Promise.all([
    Product.countDocuments(match),
    Customer.countDocuments(match),
    Order.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$total" } } }]),
    Order.countDocuments(match),
    Order.aggregate([{ $match: { ...match, createdAt: { $gte: today } } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
    Order.aggregate([{ $match: { ...match, createdAt: { $gte: month } } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
    Expense.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    OrderItem.aggregate([{ $match: match }, { $group: { _id: null, profit: { $sum: { $multiply: [{ $subtract: ["$price", "$costPrice"] }, "$qty"] } } } }]),
    Product.find({ ...match, $expr: { $lte: ["$stockQty", "$lowStockThreshold"] } }).limit(8),
  ]);
  return {
    productCount,
    customerCount,
    totalSales: salesAgg[0]?.total || 0,
    totalOrders: orderCount,
    todaySales: todaySalesAgg[0]?.total || 0,
    monthSales: monthSalesAgg[0]?.total || 0,
    totalExpenses: expenseAgg[0]?.total || 0,
    totalProfit: (profitAgg[0]?.profit || 0) - (expenseAgg[0]?.total || 0),
    lowStockProductCount: lowStockProducts.length,
    lowStockProducts,
  };
}

async function listOrganizations(req, res, next) {
  try {
    const organizations = await Organization.find().populate("ownerUserId", "email name").sort({ createdAt: -1 });
    const rows = await Promise.all(organizations.map(async (org) => ({
      _id: org._id,
      name: org.name,
      ownerEmail: org.ownerUserId?.email || "",
      ownerName: org.ownerUserId?.name || "",
      createdAt: org.createdAt,
      isActive: org.isActive,
      plan: org.plan,
      stats: await orgStats(org._id),
    })));
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function getOrganization(req, res, next) {
  try {
    const organization = await Organization.findById(req.params.id).populate("ownerUserId", "email name");
    if (!organization) return res.status(404).json({ message: "Organization not found" });
    res.json({ organization, dashboard: await orgStats(organization._id) });
  } catch (error) {
    next(error);
  }
}

async function listOrganizationUsers(req, res, next) {
  try {
    res.json(await User.find({ organizationId: req.params.id }).select("-password -refreshToken").sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
}

async function updateOrganization(req, res, next) {
  try {
    const payload = {};
    if (typeof req.body.isActive === "boolean") payload.isActive = req.body.isActive;
    if (typeof req.body.plan === "string") payload.plan = req.body.plan;
    const organization = await Organization.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!organization) return res.status(404).json({ message: "Organization not found" });
    res.json(organization);
  } catch (error) {
    next(error);
  }
}

module.exports = { listOrganizations, getOrganization, listOrganizationUsers, updateOrganization };
