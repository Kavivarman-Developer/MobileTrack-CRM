const express = require("express");
const { createOrder, listOrders, quickSale, recordPayment } = require("../controllers/orderController");
const { protect } = require("../middleware/auth");
const { tenantScope } = require("../middleware/tenantScope");

const router = express.Router();

router.use(protect, tenantScope);
router.post("/quick-sale", quickSale);
router.post("/:id/payments", recordPayment);
router.route("/").get(listOrders).post(createOrder);

module.exports = router;
