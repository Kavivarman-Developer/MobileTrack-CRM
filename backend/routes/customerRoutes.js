const express = require("express");
const {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} = require("../controllers/customerController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.route("/").get(listCustomers).post(createCustomer);
router.route("/:id").get(getCustomer).put(updateCustomer).delete(deleteCustomer);

module.exports = router;
