const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, default: "general", trim: true },
    date: { type: Date, default: Date.now },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Expense", expenseSchema);
