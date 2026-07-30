const Customer = require("../models/Customer");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Product = require("../models/Product");

async function createOrder(req, res, next) {
  try {
    const { customer, items = [], discount = 0, gst = 0, paymentStatus = "paid" } = req.body;
    if (!items.length) return res.status(400).json({ message: "At least one product is required" });

    const productIds = items.map((item) => item.product);
    const products = await Product.find({ _id: { $in: productIds } });
    const byId = new Map(products.map((product) => [product._id.toString(), product]));

    let subtotal = 0;
    for (const item of items) {
      const product = byId.get(item.product);
      if (!product) throw new Error("Product not found");
      if (product.stockQty < item.qty) throw new Error(`${product.name} has only ${product.stockQty} in stock`);
      subtotal += product.price * item.qty;
    }

    const total = Math.max(subtotal - Number(discount) + Number(gst), 0);
    const order = await Order.create({ customer, subtotal, discount, gst, total, paymentStatus });
    const orderItems = [];

    for (const item of items) {
      const product = byId.get(item.product);
      product.stockQty -= item.qty;
      await product.save();
      const orderItem = await OrderItem.create({ order: order._id, product: product._id, qty: item.qty, price: product.price, costPrice: product.costPrice });
      orderItems.push(orderItem._id);
    }

    order.items = orderItems;
    await order.save();
    if (customer && paymentStatus !== "paid") {
      await Customer.findByIdAndUpdate(customer, { $inc: { pendingBalance: total } });
    }

    const saved = await Order.findById(order._id).populate("customer items").populate({ path: "items", populate: "product" });
    req.app.get("io")?.emit("sales:created", saved);
    res.status(201).json(saved);
  } catch (error) {
    next(error);
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

module.exports = { createOrder, listOrders };
