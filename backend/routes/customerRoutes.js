const express = require("express");
const {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} = require("../controllers/customerController");
const { protect } = require("../middleware/auth");
const { tenantScope } = require("../middleware/tenantScope");

const router = express.Router();

router.use(protect, tenantScope);
router.route("/").get(listCustomers).post(createCustomer);
router.route("/:id").get(getCustomer).put(updateCustomer).delete(deleteCustomer);

module.exports = router;
