const express = require("express");
const { getSalesReport } = require("../controllers/reportController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/sales", protect, getSalesReport);

module.exports = router;
