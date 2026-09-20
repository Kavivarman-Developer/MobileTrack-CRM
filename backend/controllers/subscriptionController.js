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

    let clientBaseUrl = "https://app.kadaikanakku.in";
    if (req.body?.returnUrl) {
      // Use client-provided returnUrl directly
    } else if (req.headers.origin) {
      clientBaseUrl = req.headers.origin;
    } else if (req.headers.referer) {
      try {
        clientBaseUrl = new URL(req.headers.referer).origin;
      } catch (e) {}
    } else if (process.env.APP_BASE_URL) {
      clientBaseUrl = process.env.APP_BASE_URL;
    }

    const returnUrl = req.body?.returnUrl || `${clientBaseUrl}/?order_id={order_id}&payment=complete`;

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

  res.removeHeader("X-Frame-Options");
  res.setHeader(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' https://sdk.cashfree.com https://*.cashfree.com; script-src-elem * 'unsafe-inline' https://sdk.cashfree.com https://*.cashfree.com; script-src-attr * 'unsafe-inline'; frame-src * https://*.cashfree.com https://sdk.cashfree.com; frame-ancestors * https://app-kadaikanakku.web.app https://www.kadaikanakku.in https://kadaikanakku.in; connect-src * https://*.cashfree.com https://api.cashfree.com;"
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Kadai Kanakku · Secure Checkout</title>
  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body {
      background-color: #F8FAFC;
      color: #0F172A;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
    }
    .card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 20px;
      padding: 28px 22px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #FEF3C7;
      color: #92400E;
      font-weight: 700;
      font-size: 11px;
      padding: 5px 12px;
      border-radius: 999px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 14px;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      color: #0D3666;
      margin-bottom: 6px;
    }
    p.desc {
      color: #64748B;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .price-box {
      background: #F1F5F9;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 20px;
      border: 1.5px dashed #CBD5E1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .price-left { text-align: left; }
    .amount {
      font-size: 28px;
      font-weight: 800;
      color: #0D3666;
    }
    .period {
      font-size: 12px;
      color: #64748B;
      font-weight: 500;
    }
    .price-right {
      background: #DCFCE7;
      color: #166534;
      font-weight: 700;
      font-size: 12px;
      padding: 6px 10px;
      border-radius: 8px;
    }
    .features {
      text-align: left;
      margin-bottom: 22px;
      list-style: none;
    }
    .features li {
      font-size: 13px;
      color: #334155;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .features li svg {
      width: 16px;
      height: 16px;
      color: #10B981;
      flex-shrink: 0;
    }
    .btn {
      background: linear-gradient(135deg, #F59926 0%, #D97706 100%);
      color: #FFFFFF;
      border: none;
      font-size: 15px;
      font-weight: 700;
      padding: 14px;
      border-radius: 12px;
      width: 100%;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(245, 153, 38, 0.35);
      transition: all 0.2s;
    }
    .btn:active { transform: scale(0.98); }
    .footer-secure {
      font-size: 11px;
      color: #94A3B8;
      margin-top: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #FFFFFF;
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      ⚡ Special Activation Offer
    </div>
    <h1>Activate Kadai Kanakku</h1>
    <p class="desc">Complete 1 Rupee instant verification to unlock full store billing, khata & multi-device access.</p>
    
    <div class="price-box">
      <div class="price-left">
        <div class="amount">₹1.00</div>
        <div class="period">Full 30-Day Store Access</div>
      </div>
      <div class="price-right">Save 99%</div>
    </div>

    <ul class="features">
      <li>
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
        Unlimited POS & Barcode Billing
      </li>
      <li>
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
        Customer Khata & Credit Reminders
      </li>
      <li>
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
        Real-time Multi-Device Cloud Sync
      </li>
      <li>
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
        UPI, GPay, PhonePe, Cards & NetBanking
      </li>
    </ul>

    <button class="btn" id="payBtn" onclick="openCheckout()">
      Proceed to Pay ₹1
    </button>

    <div class="footer-secure">
      🔒 256-bit Secure Cashfree Payment Gateway
    </div>
  </div>

  <script>
    var cashfree = Cashfree({ mode: "${isProd ? 'production' : 'sandbox'}" });
    var sessionId = "${sessionId}";

    function notifyNative(type, payload) {
      var msg = JSON.stringify({ type: type, payload: payload, orderId: "${orderId}" });
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(msg);
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, "*");
      }
    }

    function openCheckout() {
      if (!sessionId) {
        alert("Payment session missing. Please try again from the app.");
        return;
      }
      var btn = document.getElementById("payBtn");
      btn.innerHTML = '<span class="spinner"></span> Opening Payment...';
      btn.disabled = true;

      notifyNative("CHECKOUT_START", { orderId: "${orderId}" });

      cashfree.checkout({
        paymentSessionId: sessionId,
        redirectTarget: "_self"
      });
    }

    window.addEventListener("load", function() {
      notifyNative("CHECKOUT_PAGE_LOADED", { orderId: "${orderId}" });
      setTimeout(openCheckout, 350);
    });
  </script>
</body>
</html>`;

  res.send(html);
}

module.exports = {
  createActivationOrder,
  verifyActivation,
  getSubscriptionStatus,
  renderCheckoutPage,
};
