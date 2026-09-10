const express = require("express");
const {
  listManualOrders,
  createManualOrder,
  updateManualOrderStatus,
  updateManualOrderPaymentStatus,
} = require("../controllers/manualOrderController");
const { protect } = require("../middleware/auth");
const { tenantScope } = require("../middleware/tenantScope");

const router = express.Router();

router.use(protect, tenantScope);
router.route("/").get(listManualOrders).post(createManualOrder);
router.patch("/:id/status", updateManualOrderStatus);
router.patch("/:id/payment-status", updateManualOrderPaymentStatus);

module.exports = router;
