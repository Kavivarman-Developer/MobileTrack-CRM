const express = require("express");
const { getSalesReport } = require("../controllers/reportController");
const { protect } = require("../middleware/auth");
const { tenantScope } = require("../middleware/tenantScope");

const router = express.Router();

router.get("/sales", protect, tenantScope, getSalesReport);

module.exports = router;
