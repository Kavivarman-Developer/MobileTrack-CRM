const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGO_URI or MONGODB_URI is required");
  const serverSelectionTimeoutMS = Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 10000);
  await mongoose.connect(uri, { serverSelectionTimeoutMS });
  console.log("MongoDB connected");
}

module.exports = connectDB;
