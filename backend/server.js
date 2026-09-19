require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const http = require("http");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsOrigin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  callback(new Error("Not allowed by CORS"));
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: corsOrigin } });

app.set("io", io);
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "https:", "data:", "blob:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://sdk.cashfree.com", "https://*.cashfree.com", "https://apis.google.com"],
        scriptSrcElem: ["'self'", "'unsafe-inline'", "https://sdk.cashfree.com", "https://*.cashfree.com", "https://apis.google.com"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:", "ws:"],
        frameSrc: ["'self'", "https://*.cashfree.com", "https://sdk.cashfree.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  })
);
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/store", require("./routes/storeRoutes"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/manual-orders", require("./routes/manualOrders"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/config", require("./routes/configRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/expenses", require("./routes/expenseRoutes"));
app.use("/api/vendors", require("./routes/vendors"));
app.use("/api/purchase-orders", require("./routes/purchaseOrders"));
app.use("/api/inventory-adjustments", require("./routes/inventoryAdjustments"));
app.use("/api/subscription", require("./routes/subscriptionRoutes"));
app.use("/api/admin", require("./routes/admin"));
app.use(notFound);
app.use(errorHandler);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user || user.isActive === false) return next(new Error("Unauthorized"));
    socket.user = user;
    next();
  } catch (error) {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  if (socket.user.role === "superadmin") socket.join("admin");
  else if (socket.user.organizationId) socket.join("org:" + socket.user.organizationId);
  socket.emit("connected", { id: socket.id });
});

const port = process.env.PORT || 5000;
const host = process.env.HOST || "0.0.0.0";

function startServer() {
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error('Port ' + port + ' is already in use. Stop the existing API process or set a different PORT.');
      process.exit(1);
    }
    console.error(error);
    process.exit(1);
  });

  return connectDB()
    .then(() => server.listen(port, host, () => console.log('API running on http://' + host + ':' + port)))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server, startServer };
