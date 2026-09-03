const express = require("express");
const { getSalesReport, getFullReport, exportFullReport, validateReportRange } = require("../controllers/reportController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");
const { tenantScope } = require("../middleware/tenantScope");

const router = express.Router();

router.get("/sales", protect, tenantScope, getSalesReport);
router.get("/full", protect, requireAdmin, tenantScope, validateReportRange, getFullReport);
router.get("/full/export", protect, requireAdmin, tenantScope, validateReportRange, exportFullReport);

module.exports = router;
