const express = require("express");
const { createExpense, deleteExpense, listExpenses, updateExpense } = require("../controllers/expenseController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.route("/").get(listExpenses).post(createExpense);
router.route("/:id").put(updateExpense).delete(deleteExpense);

module.exports = router;
