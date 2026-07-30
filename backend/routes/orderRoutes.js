const express = require("express");
const { createOrder, listOrders } = require("../controllers/orderController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.route("/").get(listOrders).post(createOrder);

module.exports = router;
