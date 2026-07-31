const Customer = require("../models/Customer");
const Order = require("../models/Order");

function scoped(req, extra = {}) {
  return req.orgId ? { ...extra, organizationId: req.orgId } : { ...extra, _id: null };
}

async function listCustomers(req, res, next) {
  try {
    res.json(await Customer.find(scoped(req)).sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
}

async function createCustomer(req, res, next) {
  try {
    res.status(201).json(await Customer.create({ ...req.body, organizationId: req.orgId }));
  } catch (error) {
    next(error);
  }
}

async function getCustomer(req, res, next) {
  try {
    const customer = await Customer.findOne(scoped(req, { _id: req.params.id }));
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    const orders = await Order.find(scoped(req, { customer: customer._id })).populate("items").sort({ createdAt: -1 });
    const pendingBalance = orders.filter((order) => order.paymentStatus !== "paid").reduce((sum, order) => sum + order.total, 0);
    if (customer.pendingBalance !== pendingBalance) {
      customer.pendingBalance = pendingBalance;
      await customer.save();
    }
    res.json({ customer, orders });
  } catch (error) {
    next(error);
  }
}

async function updateCustomer(req, res, next) {
  try {
    const customer = await Customer.findOneAndUpdate(scoped(req, { _id: req.params.id }), req.body, { new: true });
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  } catch (error) {
    next(error);
  }
}

async function deleteCustomer(req, res, next) {
  try {
    const customer = await Customer.findOneAndDelete(scoped(req, { _id: req.params.id }));
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { listCustomers, createCustomer, getCustomer, updateCustomer, deleteCustomer };
