require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { getOrCreateHomeBanner } = require("../services/homeBannerService");
const HomeBanner = require("../models/HomeBanner");

async function seedHomeBanner() {
  await connectDB();
  let banner = await getOrCreateHomeBanner();

  const needsContent = !banner.title && !banner.message;
  if (needsContent || !banner.enabled) {
    banner = await HomeBanner.findOneAndUpdate(
      { key: "home" },
      {
        $set: {
          enabled: true,
          title: banner.title || "Welcome to your shop",
          message: banner.message || "Quick actions below — start a sale, add items, or check orders.",
          ctaLabel: banner.ctaLabel || "Start a sale",
          ctaAction: banner.ctaAction || "Sales",
          tone: banner.tone || "promo",
        },
      },
      { new: true }
    );
  }

  console.log("Home banner ready:", {
    enabled: banner.enabled,
    title: banner.title,
    message: banner.message,
    ctaLabel: banner.ctaLabel,
    ctaAction: banner.ctaAction,
  });
  await mongoose.disconnect();
}

seedHomeBanner().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
