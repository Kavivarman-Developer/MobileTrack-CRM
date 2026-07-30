const express = require("express");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/upi", protect, (req, res) => {
  res.json({
    upiId: process.env.UPI_ID || "",
    payeeName: process.env.UPI_PAYEE_NAME || "MobileTrack CRM",
  });
});

module.exports = router;
