require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../models/User");

async function createSuperAdmin() {
  await connectDB();
  const email = process.env.SUPERADMIN_EMAIL || process.argv[2];
  const password = process.env.SUPERADMIN_PASSWORD || process.argv[3];
  if (!email || !password) {
    throw new Error("Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD, or pass email/password as CLI args");
  }

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
