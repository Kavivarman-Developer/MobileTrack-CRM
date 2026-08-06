const Customer = require("../models/Customer");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Payment = require("../models/Payment");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const { emitToOrg } = require("../utils/emitEvent");

function scoped(orgId, extra = {}) {
  return orgId ? { ...extra, organizationId: orgId } : { ...extra, _id: null };
}

function normalizeItems(items) {
  return items.map((item) => ({
    product: item.product || item.productId,
    qty: Number(item.qty),
  }));
}

async function nextInvoiceNumber(organizationId, session) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = await Order.countDocuments(scoped(organizationId)).session(session);
  return `INV-${datePart}-${String(count + 1).padStart(4, "0")}`;
}

function resolvePayment(total, paymentStatus, amountPaid) {
  if (paymentStatus === "paid") return { status: "paid", paid: total, due: 0 };
  const paid = Math.min(Math.max(Number(amountPaid || 0), 0), total);
  const due = Math.max(total - paid, 0);
  if (due <= 0) return { status: "paid", paid: total, due: 0 };
  if (paid > 0) return { status: "partial", paid, due };
  return { status: "pending", paid: 0, due: total };
}

async function createSaleOrder({ customer, items = [], discount = 0, gst = 0, paymentStatus = "paid", paymentMethod, paymentRef, amountPaid, dueDate, notes, createdBy, organizationId }, session) {
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
  if (customer) {
    const customerExists = await Customer.exists(scoped(organizationId, { _id: customer })).session(session);
    if (!customerExists) {
      const error = new Error("Customer not found");
      error.statusCode = 404;
      throw error;
    }
  }
  const products = await Product.find(scoped(organizationId, { _id: { $in: productIds } })).session(session);
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

  const total = Math.max(subtotal - Number(discount || 0) + Number(gst || 0), 0);
  const payment = resolvePayment(total, paymentStatus, amountPaid);
  const [order] = await Order.create([{
    organizationId,
    customer,
    subtotal,
    discount: Number(discount || 0),
    gst: Number(gst || 0),
    total,
    invoiceNumber: await nextInvoiceNumber(organizationId, session),
    amountPaid: payment.paid,
    balanceDue: payment.due,
    dueDate: dueDate ? new Date(dueDate) : undefined,
    notes,
    paymentStatus: payment.status,
    paymentMethod: paymentMethod || "cash",
    paymentRef,
  }], { session });
  const orderItems = [];
  const movements = [];

  for (const item of normalizedItems) {
    const product = byId.get(item.product);
    product.stockQty -= item.qty;
    await product.save({ session });
    const [orderItem] = await OrderItem.create([{
      order: order._id,
      organizationId,
      product: product._id,
      qty: item.qty,
      price: product.price,
      costPrice: product.costPrice,
    }], { session });
    orderItems.push(orderItem._id);
    movements.push({
      product: product._id,
      organizationId,
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
  if (payment.paid > 0) {
    await Payment.create([{ order: order._id, organizationId, amount: payment.paid, method: paymentMethod || "cash", paymentRef }], { session });
  }
  if (customer && payment.due > 0) {
    await Customer.findOneAndUpdate(scoped(organizationId, { _id: customer }), { $inc: { pendingBalance: payment.due } }, { session });
  }

  return order;
}

async function createOrder(req, res, next) {
  const session = await Order.startSession();
  try {
    let order;
    await session.withTransaction(async () => {
      order = await createSaleOrder({ ...req.body, createdBy: req.user?._id, organizationId: req.orgId }, session);
    });
    const saved = await Order.findOne(scoped(req.orgId, { _id: order._id })).populate("customer items").populate({ path: "items", populate: "product" });
    emitToOrg(req, "order:created", saved);
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
        organizationId: req.orgId,
      }, session);
    });
    const saved = await Order.findOne(scoped(req.orgId, { _id: order._id })).populate("customer items").populate({ path: "items", populate: "product" });
    emitToOrg(req, "order:created", saved);
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
    const query = scoped(req.orgId, req.query.customer ? { customer: req.query.customer } : {});
    if (req.query.paymentStatus && req.query.paymentStatus !== "all") query.paymentStatus = req.query.paymentStatus;
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

async function recordPayment(req, res, next) {
  const session = await Order.startSession();
  try {
    let saved;
    await session.withTransaction(async () => {
      const amount = Number(req.body.amount || 0);
      if (amount <= 0) {
        const error = new Error("Payment amount must be greater than zero");
        error.statusCode = 400;
        throw error;
      }

      const order = await Order.findOne(scoped(req.orgId, { _id: req.params.id })).session(session);
      if (!order) {
        const error = new Error("Invoice not found");
        error.statusCode = 404;
        throw error;
      }
      const balance = Number(order.balanceDue ?? Math.max(order.total - Number(order.amountPaid || 0), 0));
      const received = Math.min(amount, balance);
      if (received <= 0) {
        const error = new Error("Invoice is already paid");
        error.statusCode = 400;
        throw error;
      }

      order.amountPaid = Number(order.amountPaid || 0) + received;
      order.balanceDue = Math.max(Number(order.total || 0) - order.amountPaid, 0);
      order.paymentStatus = order.balanceDue <= 0 ? "paid" : "partial";
      order.paymentMethod = req.body.method || order.paymentMethod || "cash";
      order.paymentRef = req.body.paymentRef || order.paymentRef;
      await order.save({ session });

      await Payment.create([{
        order: order._id,
        organizationId: req.orgId,
        amount: received,
        method: req.body.method || "cash",
        paymentRef: req.body.paymentRef,
        receivedAt: req.body.receivedAt ? new Date(req.body.receivedAt) : new Date(),
      }], { session });

      if (order.customer) {
        await Customer.findOneAndUpdate(scoped(req.orgId, { _id: order.customer }), { $inc: { pendingBalance: -received } }, { session });
      }
    });
    saved = await Order.findOne(scoped(req.orgId, { _id: req.params.id })).populate("customer items").populate({ path: "items", populate: "product" });
    emitToOrg(req, "order:updated", saved);
    res.json(saved);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  } finally {
    await session.endSession();
  }
}

module.exports = { createOrder, listOrders, quickSale, recordPayment };
