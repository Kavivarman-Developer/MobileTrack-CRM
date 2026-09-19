const Organization = require("../models/Organization");
const Payment = require("../models/Payment");
const { createPaymentOrder, getPaymentOrder, isConfigured } = require("../services/cashfreeService");

function subscriptionDates(cycle = "monthly", startDate = new Date()) {
  const start = new Date(startDate);
  const end = new Date(start);
  if (cycle === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setDate(end.getDate() + 30);
  }
  return { start, end };
}

async function createActivationOrder(req, res, next) {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ message: "Cashfree payment gateway is not configured" });
    }

    const org = req.organization;
    const user = req.user;
    if (!org) {
      return res.status(400).json({ message: "Organization context missing" });
    }

    const orderId = "ACT_" + String(org._id).slice(-6) + "_" + Date.now();
    const amount = 1.00;

    const returnUrl = (process.env.APP_BASE_URL || "https://app.kadaikanakku.in") + "/subscription?order_id={order_id}";

    const customer = {
      id: String(user._id || org._id),
      name: user.name || org.name || "Store Owner",
      email: user.email || "billing@kadaikanakku.in",
      phone: user.phone || "9999999999",
    };

    const cashfreeOrder = await createPaymentOrder({
      orderId,
      amount,
      customer,
      returnUrl,
      tags: {
        organization_id: String(org._id),
        user_id: String(user._id),
        type: "shop_activation",
      },
    });

    res.json({
      orderId,
      cfOrderId: cashfreeOrder.cf_order_id,
      paymentSessionId: cashfreeOrder.payment_session_id,
      amount,
      currency: "INR",
      organizationId: org._id,
      checkoutUrl: "/api/subscription/checkout/" + orderId + "?session_id=" + encodeURIComponent(cashfreeOrder.payment_session_id),
    });
  } catch (error) {
    next(error);
  }
}

async function verifyActivation(req, res, next) {
  try {
    const orderId = req.body.orderId || req.query.order_id;
    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    const cashfree = await getPaymentOrder(orderId);
    const status = String(cashfree.order_status || "").toUpperCase();

    if (status === "PAID") {
      const orgId = req.organization?._id;
      const { start, end } = subscriptionDates("monthly");

      const updatedOrg = await Organization.findByIdAndUpdate(
        orgId,
        {
          subscriptionStatus: "active",
          subscriptionStartDate: start,
          subscriptionEndDate: end,
          isActive: true,
        },
        { new: true }
      );

      await Payment.create({
        organizationId: orgId,
        amount: cashfree.order_amount || 1.00,
        method: "cashfree",
        paymentRef: cashfree.cf_order_id || orderId,
        status: "completed",
        createdAt: new Date(),
      }).catch((e) => console.error("Payment log error:", e));

      return res.json({
        success: true,
        status: "PAID",
        organization: updatedOrg,
        message: "Account successfully activated! Enjoy full 30-day access to Kadai Kanakku.",
      });
    }

    res.json({
      success: false,
      status: status || "PENDING",
      message: "Payment is not completed yet (Status: " + status + ")",
    });
  } catch (error) {
    next(error);
  }
}

async function getSubscriptionStatus(req, res, next) {
  try {
    const org = req.organization;
    if (!org) return res.status(404).json({ message: "Organization not found" });

    const now = new Date();
    const endDate = org.subscriptionEndDate ? new Date(org.subscriptionEndDate) : null;
    const isExpired = endDate ? now > endDate : false;
    const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))) : 0;

    res.json({
      organizationId: org._id,
      organizationName: org.name,
      plan: org.plan || "standard",
      billingCycle: org.billingCycle || "monthly",
      subscriptionStatus: org.subscriptionStatus || "trial",
      subscriptionStartDate: org.subscriptionStartDate,
      subscriptionEndDate: org.subscriptionEndDate,
      isExpired,
      daysLeft,
      activationAmount: 1.00,
      isActive: org.isActive !== false && org.subscriptionStatus === "active",
    });
  } catch (error) {
    next(error);
  }
}

function renderCheckoutPage(req, res) {
  const { orderId } = req.params;
  const sessionId = req.query.session_id || "";
  const isProd = process.env.CASHFREE_ENV === "production";

  const html = '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'  <meta charset="UTF-8">' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'  <title>Kadai Kanakku - Shop Activation (Rs 1)</title>' +
'  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>' +
'  <style>' +
'    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; }' +
'    body { background: #0b1e36; color: #fff; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }' +
'    .card { background: #112d4e; border: 1px solid #1f4068; border-radius: 16px; padding: 32px 24px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 12px 30px rgba(0,0,0,0.4); }' +
'    .badge { display: inline-block; background: #f59926; color: #000; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; margin-bottom: 16px; }' +
'    h1 { font-size: 22px; margin: 0 0 8px; color: #ffffff; }' +
'    p { color: #94a3b8; font-size: 14px; margin: 0 0 24px; line-height: 1.5; }' +
'    .price-box { background: #0b1e36; border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px dashed #334e68; }' +
'    .price-box .amount { font-size: 36px; font-weight: 800; color: #22c55e; }' +
'    .price-box .sub { font-size: 13px; color: #94a3b8; }' +
'    .btn { background: #f59926; color: #000; border: none; font-size: 16px; font-weight: 700; padding: 14px 28px; border-radius: 10px; width: 100%; cursor: pointer; transition: all 0.2s; }' +
'    .btn:hover { background: #e08518; }' +
'    .features { text-align: left; margin: 20px 0; font-size: 13px; color: #cbd5e1; }' +
'    .features li { margin-bottom: 8px; }' +
'  </style>' +
'</head>' +
'<body>' +
'  <div class="card">' +
'    <div class="badge">Special Activation Offer</div>' +
'    <h1>Activate Kadai Kanakku</h1>' +
'    <p>Complete 1 Rupee instant verification to unlock full store billing, inventory & multi-device POS access.</p>' +
'    <div class="price-box">' +
'      <div class="amount">Rs 1.00</div>' +
'      <div class="sub">30 Days Full Access Included</div>' +
'    </div>' +
'    <ul class="features">' +
'      <li>* Unlimited POS & Barcode Billing</li>' +
'      <li>* Multi-device real-time sync</li>' +
'      <li>* Reports, GST Bills & Customer Ledger</li>' +
'      <li>* Instant UPI / GPay / PhonePe activation</li>' +
'    </ul>' +
'    <button class="btn" id="payBtn" onclick="openCheckout()">Pay Rs 1 with Cashfree</button>' +
'  </div>' +
'  <script>' +
'    const cashfree = Cashfree({ mode: "' + (isProd ? 'production' : 'sandbox') + '" });' +
'    function openCheckout() {' +
'      const sessionId = "' + sessionId + '";' +
'      if (!sessionId) {' +
'        alert("Payment session missing. Please try again from the app.");' +
'        return;' +
'      }' +
'      cashfree.checkout({' +
'        paymentSessionId: sessionId,' +
'        redirectTarget: "_self"' +
'      });' +
'    }' +
'    window.addEventListener("load", function() {' +
'      setTimeout(openCheckout, 400);' +
'    });' +
'  </script>' +
'</body>' +
'</html>'

  res.send(html);
}

module.exports = {
  createActivationOrder,
  verifyActivation,
  getSubscriptionStatus,
  renderCheckoutPage,
};
