require("dotenv").config();
const fs = require("fs");
const path = require("path");
const connectDB = require("../config/db");
const User = require("../models/User");

function rawEnvValue(key) {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return "";
  const line = fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((row) => row.trim().startsWith(`${key}=`));
  if (!line) return "";
  const value = line.slice(line.indexOf("=") + 1).trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

async function createSuperAdmin() {
  await connectDB();
  const rawEmail = process.env.SUPERADMIN_EMAIL || process.argv[2];
  const password = process.argv[3] || rawEnvValue("SUPERADMIN_PASSWORD") || process.env.SUPERADMIN_PASSWORD;
  if (!rawEmail || !password) {
    throw new Error("Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD, or pass email/password as CLI args");
  }
  const email = rawEmail.toLowerCase();

  const user = await User.findOne({ email });
  if (user) {
    user.name = user.name || "Super Admin";
    user.password = password;
    user.role = "superadmin";
    user.organizationId = null;
    user.authProvider = "local";
    await user.save();
  } else {
    await User.create({ name: "Super Admin", email, password, role: "superadmin", organizationId: null, authProvider: "local" });
  }
  console.log(`Super admin ready: ${email}`);
  process.exit(0);
}

createSuperAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
