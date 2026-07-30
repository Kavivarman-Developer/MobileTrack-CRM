const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");

function dateMatch(query) {
  const createdAt = {};
  if (query.from) createdAt.$gte = new Date(query.from);
  if (query.to) {
    const end = new Date(query.to);
    end.setHours(23, 59, 59, 999);
    createdAt.$lte = end;
  }
  return Object.keys(createdAt).length ? { createdAt } : {};
}

async function getSalesReport(req, res, next) {
  try {
    const match = dateMatch(req.query);
    const [salesRows, profitRows] = await Promise.all([
      Order.aggregate([
        { $match: match },
        { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" }, d: { $dayOfMonth: "$createdAt" } }, totalSales: { $sum: "$total" }, invoiceCount: { $sum: 1 } } },
        { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
      ]),
      OrderItem.aggregate([
        { $match: match },
        { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" }, d: { $dayOfMonth: "$createdAt" } }, totalProfit: { $sum: { $multiply: [{ $subtract: ["$price", "$costPrice"] }, "$qty"] } } } },
      ]),
    ]);
    const profitByDate = new Map(profitRows.map((row) => [`${row._id.y}-${row._id.m}-${row._id.d}`, row.totalProfit]));
    res.json(salesRows.map((row) => {
      const date = new Date(row._id.y, row._id.m - 1, row._id.d);
      const key = `${row._id.y}-${row._id.m}-${row._id.d}`;
      return {
        date: date.toISOString().slice(0, 10),
        totalSales: row.totalSales,
        totalProfit: profitByDate.get(key) || 0,
        invoiceCount: row.invoiceCount,
      };
    }));
  } catch (error) {
    next(error);
  }
}

module.exports = { getSalesReport };
