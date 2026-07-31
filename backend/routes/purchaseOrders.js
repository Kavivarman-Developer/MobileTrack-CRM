const express = require("express");
const {
  createPurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrder,
  updatePurchaseOrder,
} = require("../controllers/purchaseOrderController");
const { protect } = require("../middleware/auth");
const { tenantScope } = require("../middleware/tenantScope");

const router = express.Router();

router.use(protect, tenantScope);
router.route("/").get(listPurchaseOrders).post(createPurchaseOrder);
router.post("/:id/receive", receivePurchaseOrder);
router.route("/:id").get(getPurchaseOrder).put(updatePurchaseOrder).delete(deletePurchaseOrder);

module.exports = router;
