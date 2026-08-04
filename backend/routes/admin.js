const express = require("express");
const { blockUser, createShopOwner, getOrganization, listOrganizationUsers, listOrganizations, unblockUser, updateOrganization } = require("../controllers/adminController");
const { protect } = require("../middleware/auth");
const { requireSuperAdmin } = require("../middleware/requireSuperAdmin");

const router = express.Router();

router.use(protect, requireSuperAdmin);
router.get("/organizations", listOrganizations);
router.post("/shop-owners", createShopOwner);
router.patch("/users/:id/block", blockUser);
router.patch("/users/:id/unblock", unblockUser);
router.get("/organizations/:id", getOrganization);
router.get("/organizations/:id/users", listOrganizationUsers);
router.patch("/organizations/:id", updateOrganization);

module.exports = router;
