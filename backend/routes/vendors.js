const express = require("express");
const { createVendor, createVendorCall, deleteVendor, getVendor, getVendorCallSummary, listVendorCalls, listVendors, updateVendor } = require("../controllers/vendorController");
const { protect } = require("../middleware/auth");
const { tenantScope } = require("../middleware/tenantScope");

const router = express.Router();

router.use(protect, tenantScope);
router.route("/").get(listVendors).post(createVendor);
router.get("/calls/summary", getVendorCallSummary);
router.route("/:id/calls").get(listVendorCalls).post(createVendorCall);
router.route("/:id").get(getVendor).put(updateVendor).delete(deleteVendor);

module.exports = router;
