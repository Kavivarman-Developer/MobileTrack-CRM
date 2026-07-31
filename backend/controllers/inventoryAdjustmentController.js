const InventoryAdjustment = require("../models/InventoryAdjustment");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

function scoped(req, extra = {}) {
  return req.orgId ? { ...extra, organizationId: req.orgId } : { ...extra, _id: null };
}

async function listInventoryAdjustments(req, res, next) {
  try {
    const items = await InventoryAdjustment.find(scoped(req))
      .populate("product", "name sku stockQty")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    next(error);
  }
}

async function createInventoryAdjustment(req, res, next) {
  const session = await Product.startSession();
  try {
    const { productId, adjustmentType, reason, notes } = req.body;
    const quantity = Number(req.body.quantity);
    if (!productId || !["increase", "decrease"].includes(adjustmentType) || !Number.isInteger(quantity) || quantity <= 0 || !reason) {
      return res.status(400).json({ message: "Product, adjustment type, quantity, and reason are required" });
    }

    let adjustment;
    await session.withTransaction(async () => {
      const product = await Product.findOne(scoped(req, { _id: productId })).session(session);
      if (!product) {
        const error = new Error("Product not found");
        error.statusCode = 404;
        throw error;
      }
      const nextQty = adjustmentType === "increase" ? product.stockQty + quantity : product.stockQty - quantity;
      if (nextQty < 0) {
        const error = new Error("Stock cannot go below zero");
        error.statusCode = 400;
        throw error;
      }
      product.stockQty = nextQty;
      await product.save({ session });
      [adjustment] = await InventoryAdjustment.create([{
        product: product._id,
        organizationId: req.orgId,
        adjustmentType,
        quantity,
        reason,
        notes,
        createdBy: req.user?._id,
      }], { session });
      await StockMovement.create([{
        product: product._id,
        organizationId: req.orgId,
        type: adjustmentType === "increase" ? "IN" : "OUT",
        quantity,
        reason: `Inventory Adjustment: ${reason}`,
        note: notes,
        createdBy: req.user?._id,
      }], { session });
    });

    const saved = await InventoryAdjustment.findOne(scoped(req, { _id: adjustment._id })).populate("product", "name sku stockQty");
    req.app.get("io")?.emit("inventory:changed", saved);
    res.status(201).json(saved);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
}

module.exports = { listInventoryAdjustments, createInventoryAdjustment };
