const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  { title: String, amount: Number, notes: String },
  { timestamps: true }
);

module.exports = mongoose.model("Expense", expenseSchema);
