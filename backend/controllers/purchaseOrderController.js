const Product = require("../models/Product");
const PurchaseOrder = require("../models/PurchaseOrder");
const StockMovement = require("../models/StockMovement");
const Vendor = require("../models/Vendor");

function scoped(req, extra = {}) {
  return req.orgId ? { ...extra, organizationId: req.orgId } : { ...extra, _id: null };
}

function cleanItems(items = []) {
  return items
    .map((item) => ({
      product: item.product || item.productId,
      quantity: Number(item.quantity || 0),
      costPrice: Number(item.costPrice || 0),
    }))
    .filter((item) => item.product && item.quantity > 0 && item.costPrice >= 0);
}

function totalFor(items) {
  return items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.costPrice || 0), 0);
}

function localDayRange(dateKey) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || "")) ? dateKey : new Date().toISOString().slice(0, 10);
  const start = new Date(`${key}T00:00:00+05:30`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function dateRange(query) {
  const range = {};
  if (query.date) {
    const day = localDayRange(query.date);
    return { $gte: day.start, $lt: day.end };
  }
  if (query.from) range.$gte = new Date(query.from);
  if (query.to) {
    const end = new Date(query.to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  if (query.month && /^\d{4}-\d{2}$/.test(query.month)) {
    const [year, month] = query.month.split("-").map(Number);
    range.$gte = new Date(year, month - 1, 1);
    range.$lt = new Date(year, month, 1);
  }
  return Object.keys(range).length ? range : null;
}

async function purchaseQuery(req) {
  const query = scoped(req);
  const range = dateRange(req.query);
  if (range) query.orderDate = range;
  if (req.query.search) {
    const vendors = await Vendor.find(scoped(req, { name: new RegExp(String(req.query.search), "i") })).select("_id");
    query.vendor = { $in: vendors.map((vendor) => vendor._id) };
  }
  return query;
}

async function listPurchaseOrders(req, res, next) {
  try {
    const query = await purchaseQuery(req);
    const orders = await PurchaseOrder.find(query).populate("vendor items.product").sort({ orderDate: -1, createdAt: -1 });
    const summaryRows = await PurchaseOrder.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$orderDate", timezone: "Asia/Kolkata" } },
          totalAmount: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
          itemCount: { $sum: { $sum: "$items.quantity" } },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 12 },
    ]);
    const summary = {
      totalAmount: orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      orderCount: orders.length,
      monthly: summaryRows.map((row) => ({ month: row._id, totalAmount: row.totalAmount, orderCount: row.orderCount, itemCount: row.itemCount })),
    };
    res.json({ items: orders, summary });
  } catch (error) {
    next(error);
  }
}

async function createPurchaseOrder(req, res, next) {
  try {
    const items = cleanItems(req.body.items);
    if (!req.body.vendor || !items.length) return res.status(400).json({ message: "Vendor and at least one item are required" });
    const vendor = await Vendor.findOne(scoped(req, { _id: req.body.vendor }));
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    const productCount = await Product.countDocuments(scoped(req, { _id: { $in: items.map((item) => item.product) } }));
    if (productCount !== items.length) return res.status(404).json({ message: "One or more products were not found" });
    const po = await PurchaseOrder.create({ ...req.body, organizationId: req.orgId, items, totalAmount: totalFor(items) });
    res.status(201).json(await po.populate("vendor items.product"));
  } catch (error) {
    next(error);
  }
}

async function getPurchaseOrder(req, res, next) {
  try {
    const po = await PurchaseOrder.findOne(scoped(req, { _id: req.params.id })).populate("vendor items.product");
    if (!po) return res.status(404).json({ message: "Purchase order not found" });
    res.json(po);
  } catch (error) {
    next(error);
  }
}

async function updatePurchaseOrder(req, res, next) {
  try {
    const payload = { ...req.body };
    if (payload.items) {
      payload.items = cleanItems(payload.items);
      payload.totalAmount = totalFor(payload.items);
    }
    const po = await PurchaseOrder.findOneAndUpdate(scoped(req, { _id: req.params.id }), payload, { new: true, runValidators: true }).populate("vendor items.product");
    if (!po) return res.status(404).json({ message: "Purchase order not found" });
    res.json(po);
  } catch (error) {
    next(error);
  }
}

async function deletePurchaseOrder(req, res, next) {
  try {
    const po = await PurchaseOrder.findOneAndDelete(scoped(req, { _id: req.params.id }));
    if (!po) return res.status(404).json({ message: "Purchase order not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function receivePurchaseOrder(req, res, next) {
  const session = await PurchaseOrder.startSession();
  try {
    let po;
    await session.withTransaction(async () => {
      po = await PurchaseOrder.findOne(scoped(req, { _id: req.params.id })).session(session);
      if (!po) {
        const error = new Error("Purchase order not found");
        error.statusCode = 404;
        throw error;
      }
      if (po.status === "received") {
        const error = new Error("Purchase order already received");
        error.statusCode = 400;
        throw error;
      }
      for (const item of po.items) {
        await Product.findOneAndUpdate(scoped(req, { _id: item.product }), { $inc: { stockQty: item.quantity } }, { session });
        await StockMovement.create([{
          product: item.product,
          organizationId: req.orgId,
          type: "IN",
          quantity: item.quantity,
          reason: "Purchase Order Received",
          note: `PO ${po._id}`,
          createdBy: req.user?._id,
        }], { session });
      }
      po.status = "received";
      po.receivedDate = new Date();
      await po.save({ session });
    });

    const saved = await PurchaseOrder.findOne(scoped(req, { _id: po._id })).populate("vendor items.product");
    req.app.get("io")?.emit("inventory:changed", saved);
    res.json(saved);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
}

module.exports = { listPurchaseOrders, createPurchaseOrder, getPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, receivePurchaseOrder };
