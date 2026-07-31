const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Product = require("../models/Product");
const Expense = require("../models/Expense");

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDateRange(query) {
  if (!query.dateFrom && !query.dateTo) return null;
  const range = {};
  if (query.dateFrom) range.$gte = new Date(query.dateFrom);
  if (query.dateTo) {
    const end = new Date(query.dateTo);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
}

async function getDashboard(req, res, next) {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const selectedRange = getDateRange(req.query);
    const orgMatch = { organizationId: req.orgId };
    const selectedMatch = selectedRange ? { ...orgMatch, createdAt: selectedRange } : { ...orgMatch, createdAt: { $gte: today } };

    const expenseMatch = selectedRange ? { ...orgMatch, date: selectedRange } : { ...orgMatch, date: { $gte: today } };
    const [totalProducts, lowStockProductCount, todaySalesAgg, monthSalesAgg, selectedSalesAgg, profitItems, expenseAgg, monthlySales] = await Promise.all([
      Product.countDocuments(orgMatch),
      Product.countDocuments({ ...orgMatch, $expr: { $lte: ["$stockQty", "$lowStockThreshold"] } }),
      Order.aggregate([{ $match: { ...orgMatch, createdAt: { $gte: today } } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
      Order.aggregate([{ $match: { ...orgMatch, createdAt: { $gte: month } } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
      Order.aggregate([{ $match: selectedMatch }, { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } }]),
      OrderItem.aggregate([
        { $match: selectedMatch },
        { $group: { _id: null, profit: { $sum: { $multiply: [{ $subtract: ["$price", "$costPrice"] }, "$qty"] } } } },
      ]),
      Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Order.aggregate([
        { $match: { ...orgMatch, createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } },
        { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } }, total: { $sum: "$total" } } },
        { $sort: { "_id.y": 1, "_id.m": 1 } },
      ]),
    ]);

    const lowStockProducts = await Product.find({ ...orgMatch, $expr: { $lte: ["$stockQty", "$lowStockThreshold"] } }).limit(8);
    res.json({
      totalProducts,
      todaySales: todaySalesAgg[0]?.total || 0,
      monthSales: monthSalesAgg[0]?.total || 0,
      selectedSales: selectedSalesAgg[0]?.total || 0,
      selectedOrderCount: selectedSalesAgg[0]?.count || 0,
      todayProfit: (profitItems[0]?.profit || 0) - (expenseAgg[0]?.total || 0),
      selectedExpenses: expenseAgg[0]?.total || 0,
      lowStockProductCount,
      lowStockProducts,
      monthlySales: monthlySales.map((row) => ({ month: `${row._id.m}/${row._id.y}`, total: row.total })),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getDashboard };
