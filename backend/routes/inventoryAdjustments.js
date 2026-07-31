const express = require("express");
const { createInventoryAdjustment, listInventoryAdjustments } = require("../controllers/inventoryAdjustmentController");
const { protect } = require("../middleware/auth");
const { tenantScope } = require("../middleware/tenantScope");

const router = express.Router();

router.use(protect, tenantScope);
router.route("/").get(listInventoryAdjustments).post(createInventoryAdjustment);

module.exports = router;
