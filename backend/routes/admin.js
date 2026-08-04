const express = require("express");
const { createShopOwner, getOrganization, listOrganizationUsers, listOrganizations, updateOrganization } = require("../controllers/adminController");
const { protect } = require("../middleware/auth");
const { requireSuperAdmin } = require("../middleware/requireSuperAdmin");

const router = express.Router();

router.use(protect, requireSuperAdmin);
router.get("/organizations", listOrganizations);
router.post("/shop-owners", createShopOwner);
router.get("/organizations/:id", getOrganization);
router.get("/organizations/:id/users", listOrganizationUsers);
router.patch("/organizations/:id", updateOrganization);

module.exports = router;
