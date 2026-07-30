const Customer = require("../models/Customer");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

function normalizeItems(items) {
  return items.map((item) => ({
    product: item.product || item.productId,
    qty: Number(item.qty),
  }));
}

async function createSaleOrder({ customer, items = [], discount = 0, gst = 0, paymentStatus = "paid", paymentMethod, paymentRef, createdBy }, session) {
  const normalizedItems = normalizeItems(items);
  if (!normalizedItems.length) {
    const error = new Error("At least one product is required");
    error.statusCode = 400;
    throw error;
  }
  if (normalizedItems.some((item) => !item.product || !Number.isInteger(item.qty) || item.qty <= 0)) {
    const error = new Error("Each item must include a product and positive quantity");
    error.statusCode = 400;
    throw error;
  }

  const productIds = normalizedItems.map((item) => item.product);
  const products = await Product.find({ _id: { $in: productIds } }).session(session);
  const byId = new Map(products.map((product) => [product._id.toString(), product]));

  let subtotal = 0;
  for (const item of normalizedItems) {
    const product = byId.get(item.product);
    if (!product) {
      const error = new Error("Product not found");
      error.statusCode = 404;
      throw error;
    }
    if (product.stockQty < item.qty) {
      const error = new Error(`${product.name} has only ${product.stockQty} in stock`);
      error.statusCode = 400;
      throw error;
    }
    subtotal += product.price * item.qty;
  }

  const total = Math.max(subtotal - Number(discount) + Number(gst), 0);
  const [order] = await Order.create([{ customer, subtotal, discount, gst, total, paymentStatus, paymentMethod, paymentRef }], { session });
  const orderItems = [];
  const movements = [];

  for (const item of normalizedItems) {
    const product = byId.get(item.product);
    product.stockQty -= item.qty;
    await product.save({ session });
    const [orderItem] = await OrderItem.create([{
      order: order._id,
      product: product._id,
      qty: item.qty,
      price: product.price,
      costPrice: product.costPrice,
    }], { session });
    orderItems.push(orderItem._id);
    movements.push({
      product: product._id,
      type: "OUT",
      quantity: item.qty,
      reason: "sale",
      refOrder: order._id,
      createdBy,
    });
  }

  await StockMovement.create(movements, { session });
  order.items = orderItems;
  await order.save({ session });
  if (customer && paymentStatus !== "paid") {
    await Customer.findByIdAndUpdate(customer, { $inc: { pendingBalance: total } }, { session });
  }

  return order;
}

async function createOrder(req, res, next) {
  const session = await Order.startSession();
  try {
    let order;
    await session.withTransaction(async () => {
      order = await createSaleOrder({ ...req.body, createdBy: req.user?._id }, session);
    });
    const saved = await Order.findById(order._id).populate("customer items").populate({ path: "items", populate: "product" });
    req.app.get("io")?.emit("sales:created", saved);
    res.status(201).json(saved);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
}

async function quickSale(req, res, next) {
  const session = await Order.startSession();
  try {
    let order;
    await session.withTransaction(async () => {
      order = await createSaleOrder({
        customer: req.body.customerId,
        items: req.body.items,
        paymentStatus: "paid",
        paymentMethod: req.body.paymentMethod || "cash",
        paymentRef: req.body.paymentRef,
        createdBy: req.user?._id,
      }, session);
    });
    const saved = await Order.findById(order._id).populate("customer items").populate({ path: "items", populate: "product" });
    req.app.get("io")?.emit("sales:created", saved);
    res.status(201).json(saved);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
}

async function listOrders(req, res, next) {
  try {
    const query = req.query.customer ? { customer: req.query.customer } : {};
    if (req.query.dateFrom || req.query.dateTo) {
      query.createdAt = {};
      if (req.query.dateFrom) query.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) {
        const end = new Date(req.query.dateTo);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }
    const orders = await Order.find(query).populate("customer items").populate({ path: "items", populate: "product" }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    next(error);
  }
}

module.exports = { createOrder, listOrders, quickSale };
