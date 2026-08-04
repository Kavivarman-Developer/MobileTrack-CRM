const Vendor = require("../models/Vendor");
const VendorCall = require("../models/VendorCall");
const { emitToOrg } = require("../utils/emitEvent");

function scoped(req, extra = {}) {
  return req.orgId ? { ...extra, organizationId: req.orgId } : { ...extra, _id: null };
}

function localDayRange(dateKey) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || "")) ? dateKey : new Date().toISOString().slice(0, 10);
  const start = new Date(`${key}T00:00:00+05:30`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { key, start, end };
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
    const vendor = await Vendor.create({ ...req.body, organizationId: req.orgId });
    emitToOrg(req, "vendor:updated", vendor);
    res.status(201).json(vendor);
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
    emitToOrg(req, "vendor:updated", vendor);
    res.json(vendor);
  } catch (error) {
    next(error);
  }
}

async function deleteVendor(req, res, next) {
  try {
    const vendor = await Vendor.findOneAndDelete(scoped(req, { _id: req.params.id }));
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    await VendorCall.deleteMany(scoped(req, { vendor: req.params.id }));
    emitToOrg(req, "vendor:updated", { id: req.params.id, deleted: true });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function listVendorCalls(req, res, next) {
  try {
    const vendor = await Vendor.exists(scoped(req, { _id: req.params.id }));
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    const query = { vendor: req.params.id };
    if (req.query.date) {
      const { start, end } = localDayRange(req.query.date);
      query.occurredAt = { $gte: start, $lt: end };
    }
    res.json(await VendorCall.find(scoped(req, query)).sort({ occurredAt: -1 }).limit(100));
  } catch (error) {
    next(error);
  }
}

async function getVendorCallSummary(req, res, next) {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 31);
    const selected = localDayRange(req.query.date);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const rows = await VendorCall.aggregate([
      { $match: { organizationId: req.orgId, occurredAt: { $gte: start } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$occurredAt", timezone: "Asia/Kolkata" } },
            type: "$type",
            source: "$source",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": -1 } },
    ]);

    const byDay = new Map();
    for (let index = 0; index < days; index += 1) {
      const date = new Date();
      date.setDate(date.getDate() - index);
      const day = date.toISOString().slice(0, 10);
      byDay.set(day, { date: day, total: 0, outgoing: 0, appOutgoing: 0, incoming: 0, missed: 0 });
    }

    rows.forEach((row) => {
      const day = byDay.get(row._id.day) || { date: row._id.day, total: 0, outgoing: 0, appOutgoing: 0, incoming: 0, missed: 0 };
      day[row._id.type] += row.count;
      if (row._id.type === "outgoing" && row._id.source !== "auto") day.appOutgoing += row.count;
      day.total += row.count;
      byDay.set(row._id.day, day);
    });

    const daily = Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date));
    const selectedRows = await VendorCall.aggregate([
      { $match: { organizationId: req.orgId, occurredAt: { $gte: selected.start, $lt: selected.end } } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
    const today = { date: selected.key, total: 0, outgoing: 0, appOutgoing: 0, incoming: 0, missed: 0 };
    selectedRows.forEach((row) => {
      today[row._id] = row.count;
      today.total += row.count;
    });
    today.appOutgoing = await VendorCall.countDocuments(scoped(req, {
      type: "outgoing",
      source: { $ne: "auto" },
      occurredAt: { $gte: selected.start, $lt: selected.end },
    }));
    res.json({ today, daily });
  } catch (error) {
    next(error);
  }
}

async function createVendorCall(req, res, next) {
  try {
    const vendor = await Vendor.findOne(scoped(req, { _id: req.params.id }));
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    const type = ["outgoing", "incoming", "missed"].includes(req.body.type) ? req.body.type : "outgoing";
    const occurredAt = req.body.occurredAt ? new Date(req.body.occurredAt) : new Date();
    const phone = req.body.phone || vendor.phone || "";
    const nativeId = typeof req.body.nativeId === "string" ? req.body.nativeId.trim() : null;
    const toleranceStart = new Date(occurredAt.getTime() - 60000);
    const toleranceEnd = new Date(occurredAt.getTime() + 60000);
    const existing = await VendorCall.findOne(scoped(req, {
      vendor: vendor._id,
      type,
      phone,
      occurredAt: { $gte: toleranceStart, $lte: toleranceEnd },
    }));
    if (existing) return res.json(existing);
    const call = await VendorCall.create({
      organizationId: req.orgId,
      vendor: vendor._id,
      type,
      phone,
      note: req.body.note || "",
      occurredAt,
      source: req.body.source === "auto" ? "auto" : "manual",
      nativeId,
    });
    emitToOrg(req, "vendorCall:created", call);
    res.status(201).json(call);
  } catch (error) {
    next(error);
  }
}

module.exports = { listVendors, createVendor, getVendor, updateVendor, deleteVendor, listVendorCalls, getVendorCallSummary, createVendorCall };
