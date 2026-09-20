const Customer = require("../models/Customer");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Organization = require("../models/Organization");
const Payment = require("../models/Payment");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const { createPaymentOrder, getPaymentOrder, isConfigured } = require("../services/cashfreeService");

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

async function resolveStoreOrganization() {
  const configuredId = process.env.PUBLIC_STORE_ORG_ID || process.env.STORE_ORGANIZATION_ID;
  if (configuredId) {
    const org = await Organization.findOne({ _id: configuredId, isActive: true });
    if (org) return org;
  }
  const groceryOrg = await Organization.findOne({ name: /grocery|fresh|basket|mart/i, isActive: true }).sort({ createdAt: 1 });
  if (groceryOrg) return groceryOrg;
  return Organization.findOne({ isActive: true }).sort({ createdAt: 1 });
}

function publicProduct(product) {
  return {
    _id: product._id,
    name: product.name,
    price: product.sellingPrice || product.price,
    unit: product.unit || "pcs",
    stockQty: product.stockQty,
    images: product.images || [],
    category: product.category,
    brand: product.brand,
  };
}

async function listStoreProducts(req, res, next) {
  try {
    const org = await resolveStoreOrganization();
    if (!org) return res.status(404).json({ message: "Store is not configured" });
    const query = { organizationId: org._id, stockQty: { $gt: 0 }, itemType: "goods" };
    if (req.query.search) query.name = new RegExp(req.query.search, "i");
    const products = await Product.find(query).populate("category brand").sort({ name: 1 });
    res.json({ store: { _id: org._id, name: org.name }, products: products.map(publicProduct) });
  } catch (error) {
    next(error);
  }
}

async function createGuestOrder(req, res, next) {
  const session = await Order.startSession();
  try {
    const org = await resolveStoreOrganization();
    if (!org) return res.status(404).json({ message: "Store is not configured" });

    const customerInput = req.body.customer || {};
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!customerInput.name?.trim() || !customerInput.phone?.trim() || !customerInput.address?.trim()) {
      return res.status(400).json({ message: "Name, phone, and address are required" });
    }
    if (!items.length) return res.status(400).json({ message: "Cart is empty" });

    const normalizedItems = items.map((item) => ({ product: item.product || item.productId, qty: Number(item.qty) }));
    if (normalizedItems.some((item) => !item.product || !Number.isInteger(item.qty) || item.qty <= 0)) {
      return res.status(400).json({ message: "Each cart item needs a product and valid quantity" });
    }

    let order;
    let savedCustomer;
    await session.withTransaction(async () => {
      const products = await Product.find({ organizationId: org._id, _id: { $in: normalizedItems.map((item) => item.product) } }).session(session);
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
        subtotal += Number(product.sellingPrice || product.price) * item.qty;
      }

      const deliveryFee = subtotal >= 499 ? 0 : 35;
      const total = money(subtotal + deliveryFee);
      savedCustomer = await Customer.findOneAndUpdate(
        { organizationId: org._id, phone: customerInput.phone.trim() },
        {
          organizationId: org._id,
          name: customerInput.name.trim(),
          phone: customerInput.phone.trim(),
          address: [customerInput.address, customerInput.city, customerInput.state, customerInput.pincode].filter(Boolean).join(", "),
        },
        { upsert: true, returnDocument: "after", session }
      );

      const orderCount = await Order.countDocuments({ organizationId: org._id }).session(session);
      const invoiceNumber = `WEB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(orderCount + 1).padStart(4, "0")}`;
      [order] = await Order.create([{
        organizationId: org._id,
        customer: savedCustomer._id,
        subtotal: money(subtotal),
        discount: 0,
        gst: deliveryFee,
        total,
        invoiceNumber,
        amountPaid: 0,
        balanceDue: total,
        notes: `Guest grocery order. Delivery fee: ${deliveryFee}. Email: ${customerInput.email || "not provided"}`,
        paymentStatus: "pending",
        paymentMethod: "cashfree",
      }], { session });

      const orderItems = [];
      const movements = [];
      for (const item of normalizedItems) {
        const product = byId.get(item.product);
        product.stockQty -= item.qty;
        await product.save({ session });
        const [orderItem] = await OrderItem.create([{
          organizationId: org._id,
          order: order._id,
          product: product._id,
          qty: item.qty,
          price: Number(product.sellingPrice || product.price),
          costPrice: product.costPrice,
        }], { session });
        orderItems.push(orderItem._id);
        movements.push({ organizationId: org._id, product: product._id, type: "OUT", quantity: item.qty, reason: "sale", refOrder: order._id });
      }
      await StockMovement.create(movements, { session });
      order.items = orderItems;
      await order.save({ session });
    });

    let cashfree = null;
    if (isConfigured()) {
      const publicBaseUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://example.com";
      cashfree = await createPaymentOrder({
        orderId: order.invoiceNumber,
        amount: order.total,
        customer: {
          id: savedCustomer._id.toString(),
          name: savedCustomer.name,
          email: customerInput.email || `${savedCustomer.phone}@guest.local`,
          phone: savedCustomer.phone,
        },
        returnUrl: `${publicBaseUrl}/checkout-return?order_id=${order.invoiceNumber}`,
        notifyUrl: process.env.CASHFREE_NOTIFY_URL,
      });
      order.paymentRef = cashfree.cf_order_id || cashfree.order_id || order.invoiceNumber;
      await order.save();
    }

    const saved = await Order.findById(order._id).populate("customer items").populate({ path: "items", populate: "product" });
    res.status(201).json({
      order: saved,
      payment: cashfree || {
        order_id: order.invoiceNumber,
        payment_session_id: null,
        payment_link: null,
        message: "Cashfree credentials are not configured. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY.",
      },
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message, details: error.details });
    next(error);
  } finally {
    await session.endSession();
  }
}

async function verifyGuestOrder(req, res, next) {
  try {
    const order = await Order.findOne({ invoiceNumber: req.params.orderId }).populate("customer items").populate({ path: "items", populate: "product" });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!isConfigured()) return res.json({ order, cashfree: null });

    const cashfree = await getPaymentOrder(order.invoiceNumber);
    const status = String(cashfree.order_status || "").toUpperCase();
    if (status === "PAID" && order.paymentStatus !== "paid") {
      order.paymentStatus = "paid";
      order.amountPaid = order.total;
      order.balanceDue = 0;
      order.paymentRef = cashfree.cf_order_id || order.paymentRef;
      await order.save();
      await Payment.create({ organizationId: order.organizationId, order: order._id, amount: order.total, method: "cashfree", paymentRef: order.paymentRef });
    }

    const saved = await Order.findById(order._id).populate("customer items").populate({ path: "items", populate: "product" });
    res.json({ order: saved, cashfree });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message, details: error.details });
    next(error);
  }
}

module.exports = { createGuestOrder, listStoreProducts, verifyGuestOrder };
