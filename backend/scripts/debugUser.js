require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../models/User");

async function debugUser() {
  await connectDB();
  const email = (process.argv[2] || process.env.SUPERADMIN_EMAIL || "kavinkamal@gmail.com").toLowerCase();
  const user = await User.findOne({ email });
  if (!user) {
    console.log(`User not found: ${email}`);
    process.exit(1);
  }
  console.log({
    email: user.email,
    password: user.password,
    role: user.role,
  });
  process.exit(0);
}

debugUser().catch((error) => {
  console.error(error);
  process.exit(1);
});
