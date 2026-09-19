const express = require("express");
const { createGuestOrder, listStoreProducts, verifyGuestOrder } = require("../controllers/storeController");

const router = express.Router();

router.get("/products", listStoreProducts);
router.post("/guest-orders", createGuestOrder);
router.get("/guest-orders/:orderId/verify", verifyGuestOrder);

module.exports = router;
