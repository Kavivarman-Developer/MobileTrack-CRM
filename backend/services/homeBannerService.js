const HomeBanner = require("../models/HomeBanner");

async function getOrCreateHomeBanner() {
  let banner = await HomeBanner.findOne({ key: "home" });
  if (!banner) {
    banner = await HomeBanner.create({
      key: "home",
      enabled: true,
      title: "Welcome to your shop",
      message: "Quick actions below — start a sale, add items, or check orders.",
      ctaLabel: "Start a sale",
      ctaAction: "Sales",
      tone: "promo",
    });
  }
  return banner;
}

module.exports = { getOrCreateHomeBanner };
