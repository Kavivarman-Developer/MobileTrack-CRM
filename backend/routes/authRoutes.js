const express = require("express");
const { googleLogin, login, register } = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);

console.log(
  "authRoutes loaded, routes:",
  router.stack.map((layer) => `${Object.keys(layer.route?.methods || {}).join(",").toUpperCase()} ${layer.route?.path}`)
);

module.exports = router;
