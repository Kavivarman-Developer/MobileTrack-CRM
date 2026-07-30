require("dotenv").config();
const http = require("http");
const cors = require("cors");
const express = require("express");
const morgan = require("morgan");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const { errorHandler, notFound } = require("./middleware/errorHandler");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.set("io", io);
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/config", require("./routes/configRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/expenses", require("./routes/expenseRoutes"));
app.use(notFound);
app.use(errorHandler);

io.on("connection", (socket) => {
  socket.emit("connected", { id: socket.id });
});

const port = process.env.PORT || 5000;
const host = process.env.HOST || "0.0.0.0";

connectDB()
  .then(() => server.listen(port, host, () => console.log(`API running on http://${host}:${port}`)))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
