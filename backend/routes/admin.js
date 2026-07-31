const express = require("express");
const { getOrganization, listOrganizationUsers, listOrganizations, updateOrganization } = require("../controllers/adminController");
const { protect } = require("../middleware/auth");
const { requireSuperAdmin } = require("../middleware/requireSuperAdmin");

const router = express.Router();

router.use(protect, requireSuperAdmin);
router.get("/organizations", listOrganizations);
router.get("/organizations/:id", getOrganization);
router.get("/organizations/:id/users", listOrganizationUsers);
router.patch("/organizations/:id", updateOrganization);

module.exports = router;
