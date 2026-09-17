const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2025-01-01";

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

async function createPaymentOrder({ orderId, amount, customer, returnUrl, notifyUrl }) {
  const orderMeta = { return_url: returnUrl };
  if (notifyUrl) orderMeta.notify_url = notifyUrl;
  return cashfreeRequest("/orders", {
    method: "POST",
    body: JSON.stringify({
      order_id: orderId,
      order_amount: Number(amount.toFixed(2)),
      order_currency: "INR",
      customer_details: {
        customer_id: customer.id,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
      },
      order_meta: orderMeta,
      order_tags: {
        checkout_context: "Guest grocery checkout",
      },
    }),
  });
}

async function getPaymentOrder(orderId) {
  return cashfreeRequest(`/orders/${encodeURIComponent(orderId)}`);
}

module.exports = { createPaymentOrder, getPaymentOrder, isConfigured };
