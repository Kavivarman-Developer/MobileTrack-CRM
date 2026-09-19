const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2023-08-01";

function getCashfreeBaseUrl() {
  return process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

function getCredentials() {
  const clientId = process.env.CASHFREE_APP_ID || process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_SECRET_KEY || process.env.CASHFREE_CLIENT_SECRET;
  return { clientId, clientSecret };
}

function isConfigured() {
  const { clientId, clientSecret } = getCredentials();
  return Boolean(clientId && clientSecret);
}

async function cashfreeRequest(path, options = {}) {
  const { clientId, clientSecret } = getCredentials();
  if (!clientId || !clientSecret) {
    const error = new Error("Cashfree credentials are not configured");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${getCashfreeBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Client-Id": clientId,
      "X-Client-Secret": clientSecret,
      "x-api-version": CASHFREE_API_VERSION,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error_description || "Cashfree request failed");
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function createPaymentOrder({ orderId, amount, customer, returnUrl, notifyUrl, tags = {} }) {
  const orderMeta = { return_url: returnUrl };
  if (notifyUrl) orderMeta.notify_url = notifyUrl;
  return cashfreeRequest("/orders", {
    method: "POST",
    body: JSON.stringify({
      order_id: orderId,
      order_amount: Number(Number(amount).toFixed(2)),
      order_currency: "INR",
      customer_details: {
        customer_id: String(customer.id || customer._id || "cust_" + Date.now()),
        customer_name: customer.name || "Kadai Kanakku User",
        customer_email: customer.email || "billing@kadaikanakku.in",
        customer_phone: customer.phone || "9999999999",
      },
      order_meta: orderMeta,
      order_tags: tags || {
        checkout_context: "Kadai Kanakku Subscription Activation",
      },
    }),
  });
}

async function getPaymentOrder(orderId) {
  return cashfreeRequest(`/orders/${encodeURIComponent(orderId)}`);
}

module.exports = { createPaymentOrder, getPaymentOrder, isConfigured, getCashfreeBaseUrl };

