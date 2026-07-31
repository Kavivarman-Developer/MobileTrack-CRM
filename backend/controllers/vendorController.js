const Vendor = require("../models/Vendor");

function scoped(req, extra = {}) {
  return req.orgId ? { ...extra, organizationId: req.orgId } : { ...extra, _id: null };
}

async function listVendors(req, res, next) {
  try {
    const { search } = req.query;
    const query = scoped(req, search ? { name: new RegExp(search, "i") } : {});
    res.json(await Vendor.find(query).sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
}

async function createVendor(req, res, next) {
  try {
    res.status(201).json(await Vendor.create({ ...req.body, organizationId: req.orgId }));
  } catch (error) {
    next(error);
  }
}

async function getVendor(req, res, next) {
  try {
    const vendor = await Vendor.findOne(scoped(req, { _id: req.params.id }));
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.json(vendor);
  } catch (error) {
    next(error);
  }
}

async function updateVendor(req, res, next) {
  try {
    const vendor = await Vendor.findOneAndUpdate(scoped(req, { _id: req.params.id }), req.body, { new: true });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.json(vendor);
  } catch (error) {
    next(error);
  }
}

async function deleteVendor(req, res, next) {
  try {
    const vendor = await Vendor.findOneAndDelete(scoped(req, { _id: req.params.id }));
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { listVendors, createVendor, getVendor, updateVendor, deleteVendor };
