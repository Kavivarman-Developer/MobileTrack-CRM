const { app } = require("../server");

const DEFAULT_MODULE_PATHS = [
  "/dashboard",
  "/inventory/products",
  "/customers",
  "/orders",
  "/reports/sales",
  "/expenses",
  "/vendors",
  "/purchase-orders",
  "/inventory-adjustments",
  "/config/upi",
];

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/$/, "");
}

async function checkLocalHealth() {
  const instance = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => instance.once("listening", resolve));
  const { port } = instance.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    if (!response.ok) throw new Error(`local /health returned ${response.status}`);
    console.log("OK local /health");
  } finally {
    await new Promise((resolve, reject) => instance.close((error) => error ? reject(error) : resolve()));
  }
}

async function checkRemoteHealth(apiBaseUrl) {
  const healthBase = apiBaseUrl.replace(/\/api$/, "");
  const response = await fetch(`${healthBase}/health`);
  if (!response.ok) throw new Error(`remote /health returned ${response.status}`);
  console.log("OK remote /health");
}

async function checkAuthenticatedModules(apiBaseUrl) {
  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;
  if (!email || !password) {
    console.log("SKIP authenticated module checks; set SMOKE_EMAIL and SMOKE_PASSWORD to enable them.");
    return;
  }

  const login = await fetch(`${apiBaseUrl}/auth/login`, {
    body: JSON.stringify({ email, password }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!login.ok) throw new Error(`/auth/login returned ${login.status}`);

  const body = await login.json();
  const token = body.accessToken || body.token;
  if (!token) throw new Error("/auth/login did not return an access token");

  const modulePaths = process.env.SMOKE_PATHS ? process.env.SMOKE_PATHS.split(",") : DEFAULT_MODULE_PATHS;
  for (const path of modulePaths) {
    const response = await fetch(`${apiBaseUrl}${path.trim()}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    console.log(`OK ${path}`);
  }
}

async function main() {
  await checkLocalHealth();

  const apiBaseUrl = normalizeBaseUrl(process.env.SMOKE_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL);
  if (!apiBaseUrl) {
    console.log("SKIP remote checks; set SMOKE_API_BASE_URL or EXPO_PUBLIC_API_URL.");
    return;
  }

  await checkRemoteHealth(apiBaseUrl);
  await checkAuthenticatedModules(apiBaseUrl);
}

main().catch((error) => {
  console.error(`SMOKE_FAIL ${error.message}`);
  process.exit(1);
});
