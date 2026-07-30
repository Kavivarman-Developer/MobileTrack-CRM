const express = require("express");
const { createOrder, listOrders, quickSale } = require("../controllers/orderController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.post("/quick-sale", quickSale);
router.route("/").get(listOrders).post(createOrder);

module.exports = router;
