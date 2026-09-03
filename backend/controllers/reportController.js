const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Expense = require("../models/Expense");
const PurchaseOrder = require("../models/PurchaseOrder");
const Vendor = require("../models/Vendor");
const Customer = require("../models/Customer");
const Product = require("../models/Product");

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

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

const MAX_REPORT_RANGE_DAYS = 366;

function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

function validateReportRange(req, res, next) {
  const { from, to } = req.query;
  if (from !== undefined && !isValidDateString(from)) {
    return res.status(400).json({ message: "Invalid 'from' date. Expected format YYYY-MM-DD." });
  }
  if (to !== undefined && !isValidDateString(to)) {
    return res.status(400).json({ message: "Invalid 'to' date. Expected format YYYY-MM-DD." });
  }
  if (from && to) {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T00:00:00.000Z`);
    if (fromDate > toDate) {
      return res.status(400).json({ message: "'from' date must be on or before 'to' date." });
    }
    const rangeDays = (toDate - fromDate) / (1000 * 60 * 60 * 24);
    if (rangeDays > MAX_REPORT_RANGE_DAYS) {
      return res.status(400).json({ message: `Date range too large. Maximum allowed range is ${MAX_REPORT_RANGE_DAYS} days.` });
    }
  }
  next();
}

function dailyGroupStage(dateField, extraFields) {
  return { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: dateField, timezone: "Asia/Kolkata" } }, ...extraFields } };
}

async function getSalesReport(req, res, next) {
  try {
    const match = { ...dateMatch(req.query), organizationId: req.orgId };
    const [salesRows, profitRows] = await Promise.all([
      Order.aggregate([
        { $match: match },
        dailyGroupStage("$createdAt", { totalSales: { $sum: "$total" }, invoiceCount: { $sum: 1 } }),
        { $sort: { _id: 1 } },
      ]),
      OrderItem.aggregate([
        { $match: match },
        dailyGroupStage("$createdAt", { totalProfit: { $sum: { $multiply: [{ $subtract: ["$price", "$costPrice"] }, "$qty"] } } } ),
      ]),
    ]);
    const profitByDate = new Map(profitRows.map((row) => [row._id, row.totalProfit]));
    res.json(salesRows.map((row) => ({
      date: row._id,
      totalSales: row.totalSales,
      totalProfit: profitByDate.get(row._id) || 0,
      invoiceCount: row.invoiceCount,
    })));
  } catch (error) {
    next(error);
  }
}

async function buildFullReport(req) {
  const orgId = req.orgId;
  const range = dateMatch(req.query);
  const orderMatch = { ...range, organizationId: orgId };
  const expenseDateMatch = {};
  if (req.query.from) expenseDateMatch.$gte = new Date(req.query.from);
  if (req.query.to) {
    const end = new Date(req.query.to);
    end.setHours(23, 59, 59, 999);
    expenseDateMatch.$lte = end;
  }
  const expenseMatch = { organizationId: orgId, ...(Object.keys(expenseDateMatch).length ? { date: expenseDateMatch } : {}) };
  const poDateMatch = {};
  if (req.query.from) poDateMatch.$gte = new Date(req.query.from);
  if (req.query.to) {
    const end = new Date(req.query.to);
    end.setHours(23, 59, 59, 999);
    poDateMatch.$lte = end;
  }
  const poMatch = { organizationId: orgId, ...(Object.keys(poDateMatch).length ? { orderDate: poDateMatch } : {}) };

  const [salesRows, profitRows, expenseItems, expenseTotalAgg, expenseByCategory, purchaseOrders, purchaseByVendor, products, salesByCustomer, customers] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch },
      dailyGroupStage("$createdAt", { totalSales: { $sum: "$total" }, invoiceCount: { $sum: 1 } }),
      { $sort: { _id: 1 } },
    ]),
    OrderItem.aggregate([
      { $match: orderMatch },
      dailyGroupStage("$createdAt", { totalProfit: { $sum: { $multiply: [{ $subtract: ["$price", "$costPrice"] }, "$qty"] } } } ),
    ]),
    Expense.find(expenseMatch).sort({ date: -1 }),
    Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: "$category", total: { $sum: "$amount" } } }, { $sort: { total: -1 } }]),
    PurchaseOrder.find(poMatch).populate("vendor", "name"),
    PurchaseOrder.aggregate([
      { $match: poMatch },
      { $group: { _id: "$vendor", totalAmount: { $sum: "$totalAmount" }, orderCount: { $sum: 1 } } },
      { $sort: { totalAmount: -1 } },
    ]),
    Product.find({ organizationId: orgId }),
    Order.aggregate([
      { $match: orderMatch },
      { $group: { _id: "$customer", totalSales: { $sum: "$total" }, invoiceCount: { $sum: 1 } } },
      { $sort: { totalSales: -1 } },
    ]),
    Customer.find({ organizationId: orgId }),
  ]);

  const profitByDate = new Map(profitRows.map((row) => [row._id, row.totalProfit]));
  const salesDaily = salesRows.map((row) => ({
    date: row._id,
    totalSales: row.totalSales,
    totalProfit: profitByDate.get(row._id) || 0,
    invoiceCount: row.invoiceCount,
  }));
  const salesTotals = salesDaily.reduce((acc, row) => ({
    sales: acc.sales + row.totalSales,
    profit: acc.profit + row.totalProfit,
    invoices: acc.invoices + row.invoiceCount,
  }), { sales: 0, profit: 0, invoices: 0 });

  const expensesTotal = expenseTotalAgg[0]?.total || 0;

  const vendorMap = new Map(await Vendor.find({ organizationId: orgId }).then((rows) => rows.map((v) => [String(v._id), v.name])));
  const purchasesTotal = purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount || 0), 0);
  const purchasesByVendor = purchaseByVendor.map((row) => ({
    vendorId: row._id ? String(row._id) : null,
    vendorName: row._id ? (vendorMap.get(String(row._id)) || "Unknown vendor") : "Unassigned",
    totalAmount: row.totalAmount,
    orderCount: row.orderCount,
  }));

  const inventoryTotalValue = products.reduce((sum, p) => sum + Number(p.stockQty || 0) * Number(p.costPrice || 0), 0);
  const lowStockItems = products
    .filter((p) => Number(p.stockQty || 0) <= Number(p.lowStockThreshold || 0))
    .map((p) => ({ name: p.name, sku: p.sku, stockQty: p.stockQty, lowStockThreshold: p.lowStockThreshold }));

  const customerMap = new Map(customers.map((c) => [String(c._id), c]));
  const customersReport = salesByCustomer.map((row) => {
    const customer = row._id ? customerMap.get(String(row._id)) : null;
    return {
      customerId: row._id ? String(row._id) : null,
      customerName: customer ? customer.name : "Walk-in / Unassigned",
      totalSales: row.totalSales,
      invoiceCount: row.invoiceCount,
      pendingBalance: customer ? customer.pendingBalance : 0,
    };
  });
  const pendingBalanceTotal = customers.reduce((sum, c) => sum + Number(c.pendingBalance || 0), 0);

  return {
    range: { from: req.query.from || null, to: req.query.to || null },
    sales: { daily: salesDaily, totals: salesTotals },
    expenses: { items: expenseItems, total: expensesTotal, byCategory: expenseByCategory.map((r) => ({ category: r._id || "general", total: r.total })) },
    purchases: { total: purchasesTotal, orderCount: purchaseOrders.length, byVendor: purchasesByVendor },
    inventory: { totalProducts: products.length, totalStockValue: inventoryTotalValue, lowStockCount: lowStockItems.length, lowStockItems },
    vendors: { count: vendorMap.size, byVendor: purchasesByVendor },
    customers: { count: customers.length, byCustomer: customersReport, pendingBalanceTotal },
    summary: {
      totalSales: salesTotals.sales,
      grossProfit: salesTotals.profit,
      totalExpenses: expensesTotal,
      totalPurchases: purchasesTotal,
      netProfit: salesTotals.profit - expensesTotal,
    },
  };
}

async function getFullReport(req, res, next) {
  try {
    res.json(await buildFullReport(req));
  } catch (error) {
    next(error);
  }
}

function pdfSectionTitle(doc, text) {
  doc.moveDown(0.6).fontSize(14).fillColor("#111827").text(text, { underline: true });
  doc.moveDown(0.2);
}

function pdfRow(doc, left, right) {
  const rightWidth = 150;
  const gap = 10;
  const leftX = doc.page.margins.left;
  const rightX = doc.page.width - doc.page.margins.right - rightWidth;
  const leftWidth = rightX - leftX - gap;
  const startY = doc.y;

  doc.fontSize(10).fillColor("#374151");
  doc.text(left, leftX, startY, { width: leftWidth });
  const leftEndY = doc.y;
  doc.text(right, rightX, startY, { width: rightWidth, align: "right" });
  const rightEndY = doc.y;

  doc.x = leftX;
  doc.y = Math.max(leftEndY, rightEndY);
}

async function exportFullReportPdf(req, res, next) {
  try {
    const report = await buildFullReport(req);
    const orgName = req.organization?.name || "Business";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="full-report-${Date.now()}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    doc.fontSize(20).fillColor("#111827").text(orgName, { align: "left" });
    doc.fontSize(16).fillColor("#fc8019").text("Full Business Report", { align: "left" });
    const rangeText = report.range.from || report.range.to
      ? `Period: ${report.range.from || "start"} to ${report.range.to || "today"}`
      : "Period: All time";
    doc.fontSize(10).fillColor("#6b7280").text(rangeText);
    doc.moveDown();

    pdfSectionTitle(doc, "Summary");
    pdfRow(doc, "Total Sales", `Rs ${money(report.summary.totalSales)}`);
    pdfRow(doc, "Gross Profit", `Rs ${money(report.summary.grossProfit)}`);
    pdfRow(doc, "Total Expenses", `Rs ${money(report.summary.totalExpenses)}`);
    pdfRow(doc, "Total Purchases", `Rs ${money(report.summary.totalPurchases)}`);
    pdfRow(doc, "Net Profit", `Rs ${money(report.summary.netProfit)}`);

    pdfSectionTitle(doc, "Sales (Daily)");
    if (report.sales.daily.length) {
      report.sales.daily.forEach((row) => pdfRow(doc, `${row.date} (${row.invoiceCount} invoices)`, `Rs ${money(row.totalSales)}`));
    } else {
      doc.fontSize(10).fillColor("#6b7280").text("No sales found for this period.");
    }

    pdfSectionTitle(doc, "Expenses by Category");
    if (report.expenses.byCategory.length) {
      report.expenses.byCategory.forEach((row) => pdfRow(doc, row.category, `Rs ${money(row.total)}`));
    } else {
      doc.fontSize(10).fillColor("#6b7280").text("No expenses found for this period.");
    }

    pdfSectionTitle(doc, "Purchases by Vendor");
    if (report.purchases.byVendor.length) {
      report.purchases.byVendor.forEach((row) => pdfRow(doc, `${row.vendorName} (${row.orderCount} orders)`, `Rs ${money(row.totalAmount)}`));
    } else {
      doc.fontSize(10).fillColor("#6b7280").text("No purchase orders found for this period.");
    }

    pdfSectionTitle(doc, "Inventory");
    pdfRow(doc, "Total Products", String(report.inventory.totalProducts));
    pdfRow(doc, "Total Stock Value", `Rs ${money(report.inventory.totalStockValue)}`);
    pdfRow(doc, "Low Stock Items", String(report.inventory.lowStockCount));
    if (report.inventory.lowStockItems.length) {
      doc.moveDown(0.3);
      report.inventory.lowStockItems.slice(0, 20).forEach((item) => pdfRow(doc, `${item.name} (${item.sku})`, `${item.stockQty} left`));
    }

    pdfSectionTitle(doc, "Top Customers");
    if (report.customers.byCustomer.length) {
      report.customers.byCustomer.slice(0, 20).forEach((row) => pdfRow(doc, `${row.customerName} (${row.invoiceCount} orders)`, `Rs ${money(row.totalSales)}`));
    } else {
      doc.fontSize(10).fillColor("#6b7280").text("No customer sales found for this period.");
    }
    doc.moveDown(0.3);
    pdfRow(doc, "Total Pending Balance (All Customers)", `Rs ${money(report.customers.pendingBalanceTotal)}`);

    doc.end();
  } catch (error) {
    next(error);
  }
}

async function exportFullReportExcel(req, res, next) {
  try {
    const report = await buildFullReport(req);
    const orgName = req.organization?.name || "Business";
    const workbook = new ExcelJS.Workbook();
    workbook.creator = orgName;
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.columns = [{ header: "Metric", key: "metric", width: 30 }, { header: "Value", key: "value", width: 20 }];
    summarySheet.addRows([
      { metric: "Organization", value: orgName },
      { metric: "Period From", value: report.range.from || "All time" },
      { metric: "Period To", value: report.range.to || "Today" },
      { metric: "Total Sales", value: report.summary.totalSales },
      { metric: "Gross Profit", value: report.summary.grossProfit },
      { metric: "Total Expenses", value: report.summary.totalExpenses },
      { metric: "Total Purchases", value: report.summary.totalPurchases },
      { metric: "Net Profit", value: report.summary.netProfit },
      { metric: "Total Products", value: report.inventory.totalProducts },
      { metric: "Total Stock Value", value: report.inventory.totalStockValue },
      { metric: "Low Stock Items", value: report.inventory.lowStockCount },
    ]);
    summarySheet.getRow(1).font = { bold: true };

    const salesSheet = workbook.addWorksheet("Sales");
    salesSheet.columns = [
      { header: "Date", key: "date", width: 15 },
      { header: "Total Sales", key: "totalSales", width: 15 },
      { header: "Total Profit", key: "totalProfit", width: 15 },
      { header: "Invoice Count", key: "invoiceCount", width: 15 },
    ];
    salesSheet.addRows(report.sales.daily);
    salesSheet.getRow(1).font = { bold: true };

    const expensesSheet = workbook.addWorksheet("Expenses");
    expensesSheet.columns = [
      { header: "Description", key: "description", width: 30 },
      { header: "Category", key: "category", width: 18 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "Date", key: "date", width: 15 },
      { header: "Notes", key: "notes", width: 30 },
    ];
    expensesSheet.addRows(report.expenses.items.map((e) => ({ description: e.description, category: e.category, amount: e.amount, date: new Date(e.date).toISOString().slice(0, 10), notes: e.notes || "" })));
    expensesSheet.getRow(1).font = { bold: true };

    const purchasesSheet = workbook.addWorksheet("Purchases by Vendor");
    purchasesSheet.columns = [
      { header: "Vendor", key: "vendorName", width: 25 },
      { header: "Total Amount", key: "totalAmount", width: 18 },
      { header: "Order Count", key: "orderCount", width: 15 },
    ];
    purchasesSheet.addRows(report.purchases.byVendor);
    purchasesSheet.getRow(1).font = { bold: true };

    const inventorySheet = workbook.addWorksheet("Inventory (Low Stock)");
    inventorySheet.columns = [
      { header: "Product", key: "name", width: 28 },
      { header: "SKU", key: "sku", width: 18 },
      { header: "Stock Qty", key: "stockQty", width: 12 },
      { header: "Low Stock Threshold", key: "lowStockThreshold", width: 18 },
    ];
    inventorySheet.addRows(report.inventory.lowStockItems);
    inventorySheet.getRow(1).font = { bold: true };

    const customersSheet = workbook.addWorksheet("Customers");
    customersSheet.columns = [
      { header: "Customer", key: "customerName", width: 25 },
      { header: "Total Sales", key: "totalSales", width: 15 },
      { header: "Invoice Count", key: "invoiceCount", width: 15 },
      { header: "Pending Balance", key: "pendingBalance", width: 15 },
    ];
    customersSheet.addRows(report.customers.byCustomer);
    customersSheet.getRow(1).font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="full-report-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
}

async function exportFullReport(req, res, next) {
  const format = String(req.query.format || "pdf").toLowerCase();
  if (format === "excel" || format === "xlsx") return exportFullReportExcel(req, res, next);
  return exportFullReportPdf(req, res, next);
}

module.exports = { getSalesReport, getFullReport, exportFullReport, validateReportRange };
