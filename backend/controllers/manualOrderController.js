const ManualOrder = require("../models/ManualOrder");
const { emitToOrg } = require("../utils/emitEvent");

function scoped(req, extra = {}) {
  return req.orgId ? { ...extra, organizationId: req.orgId } : { ...extra, _id: null };
}

async function nextOrderNo(orgId) {
  const count = await ManualOrder.countDocuments(orgId ? { organizationId: orgId } : { _id: null });
  return `#SC${String(count + 1).padStart(4, "0")}`;
}

async function listManualOrders(req, res, next) {
  try {
    const orders = await ManualOrder.find(scoped(req)).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    next(error);
  }
}

async function createManualOrder(req, res, next) {
  try {
    const { customerName, phone, shippingAddress, itemName, quantity } = req.body;
    if (!customerName?.trim() || !itemName?.trim()) {
      return res.status(400).json({ message: "Customer name and item name are required" });
    }
    const now = new Date();
    const order = await ManualOrder.create({
      organizationId: req.orgId,
      orderNo: await nextOrderNo(req.orgId),
      customerName: customerName.trim(),
      phone: phone?.trim(),
      shippingAddress: shippingAddress?.trim(),
      itemName: itemName.trim(),
      quantity: Math.max(Number(quantity || 1), 1),
      status: "new",
      paymentStatus: "unpaid",
      timeline: [{ status: "new", timestamp: now }],
      createdBy: req.user?._id,
    });
    emitToOrg(req, "manual-order:created", order);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
}

async function updateManualOrderStatus(req, res, next) {
  try {
    const order = await ManualOrder.findOne(scoped(req, { _id: req.params.id }));
    if (!order) return res.status(404).json({ message: "Order not found" });
    const { status } = req.body;
    if (order.status !== status) {
      order.status = status;
      order.timeline.unshift({ status, timestamp: new Date() });
      await order.save();
    }
    emitToOrg(req, "manual-order:updated", order);
    res.json(order);
  } catch (error) {
    next(error);
  }
}

async function updateManualOrderPaymentStatus(req, res, next) {
  try {
    const order = await ManualOrder.findOneAndUpdate(
      scoped(req, { _id: req.params.id }),
      { paymentStatus: req.body.paymentStatus },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    emitToOrg(req, "manual-order:updated", order);
    res.json(order);
  } catch (error) {
    next(error);
  }
}

module.exports = { listManualOrders, createManualOrder, updateManualOrderStatus, updateManualOrderPaymentStatus };
