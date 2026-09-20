const { messaging } = require("../config/firebase");
const User = require("../models/User");

/**
 * Register an FCM token for a user
 */
async function registerDeviceToken(userId, token, platform = "android") {
  if (!userId || !token) return;
  const cleanToken = String(token).trim();
  if (!cleanToken) return;

  await User.findByIdAndUpdate(userId, {
    $pull: { fcmTokens: { token: cleanToken } },
  });

  await User.findByIdAndUpdate(userId, {
    $push: {
      fcmTokens: {
        token: cleanToken,
        platform: String(platform || "android").toLowerCase(),
        updatedAt: new Date(),
      },
    },
  });
}

/**
 * Remove an FCM token on logout
 */
async function removeDeviceToken(userId, token) {
  if (!userId || !token) return;
  await User.findByIdAndUpdate(userId, {
    $pull: { fcmTokens: { token: String(token).trim() } },
  });
}

/**
 * Send a push notification to all users in an organization
 */
async function sendPushToOrg(organizationId, { title, body, data = {} }) {
  try {
    if (!organizationId) return;

    const users = await User.find({
      organizationId,
      isActive: true,
      "fcmTokens.0": { $exists: true },
    }).select("fcmTokens");

    const tokens = [];
    users.forEach((u) => {
      (u.fcmTokens || []).forEach((t) => {
        if (t.token && !tokens.includes(t.token)) {
          tokens.push(t.token);
        }
      });
    });

    if (!tokens.length) {
      return { success: false, reason: "no_tokens" };
    }

    const stringifiedData = {};
    for (const [k, v] of Object.entries(data)) {
      stringifiedData[k] = String(v ?? "");
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: stringifiedData,
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "low_stock_channel",
          priority: "high",
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      tokens,
    };

    const response = await messaging().sendEachForMulticast(message);

    if (response.failureCount > 0) {
      const badTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            badTokens.push(tokens[idx]);
          }
        }
      });

      if (badTokens.length > 0) {
        await User.updateMany(
          { organizationId },
          { $pull: { fcmTokens: { token: { $in: badTokens } } } }
        ).catch(() => {});
      }
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error("FCM Send Error:", error.message || error);
    return { success: false, error: error.message };
  }
}

/**
 * Send low-stock alert to an organization
 */
async function sendLowStockAlert(organizationId, product) {
  if (!organizationId || !product) return;

  const title = `⚠️ Low Stock Alert: ${product.name}`;
  const qty = product.stockQty ?? 0;
  const threshold = product.lowStockThreshold ?? 5;
  const body = `Only ${qty} unit(s) remaining in stock (Reorder point: ${threshold}). Tap to view and restock.`;

  return sendPushToOrg(organizationId, {
    title,
    body,
    data: {
      type: "LOW_STOCK",
      productId: String(product._id || product.id || ""),
      sku: String(product.sku || ""),
      stockQty: String(qty),
      lowStockThreshold: String(threshold),
    },
  });
}

module.exports = {
  registerDeviceToken,
  removeDeviceToken,
  sendPushToOrg,
  sendLowStockAlert,
};
