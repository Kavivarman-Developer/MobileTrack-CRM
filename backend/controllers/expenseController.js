const Expense = require("../models/Expense");

function rangeQuery(query) {
  const filter = {};
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = new Date(query.from);
    if (query.to) {
      const end = new Date(query.to);
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }
  return filter;
}

async function listExpenses(req, res, next) {
  try {
    const filter = rangeQuery(req.query);
    const [items, totalAgg] = await Promise.all([
      Expense.find(filter).sort({ date: -1, createdAt: -1 }),
      Expense.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    ]);
    res.json({ items, total: totalAgg[0]?.total || 0 });
  } catch (error) {
    next(error);
  }
}

async function createExpense(req, res, next) {
  try {
    const { description, amount, category, date, notes } = req.body;
    if (!description || Number(amount) < 0) return res.status(400).json({ message: "Description and amount are required" });
    res.status(201).json(await Expense.create({ description, amount: Number(amount), category, date, notes }));
  } catch (error) {
    next(error);
  }
}

async function updateExpense(req, res, next) {
  try {
    const payload = { ...req.body };
    if (payload.amount !== undefined) payload.amount = Number(payload.amount);
    const expense = await Expense.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    res.json(expense);
  } catch (error) {
    next(error);
  }
}

async function deleteExpense(req, res, next) {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { listExpenses, createExpense, updateExpense, deleteExpense };
