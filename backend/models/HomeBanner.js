const mongoose = require("mongoose");

const homeBannerSchema = new mongoose.Schema(
  {
    key: { type: String, default: "home", unique: true },
    enabled: { type: Boolean, default: false },
    title: { type: String, default: "" },
    message: { type: String, default: "" },
    ctaLabel: { type: String, default: "" },
    ctaAction: { type: String, default: "" },
    tone: { type: String, enum: ["promo", "info", "warning"], default: "promo" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HomeBanner", homeBannerSchema);
