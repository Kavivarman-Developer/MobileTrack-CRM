const express = require("express");
const { getDashboard } = require("../controllers/dashboardController");
const { protect } = require("../middleware/auth");
const { tenantScope } = require("../middleware/tenantScope");

const router = express.Router();

router.get("/", protect, tenantScope, getDashboard);

module.exports = router;
