const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGO_URI or MONGODB_URI is required");
  await mongoose.connect(uri);
  console.log("MongoDB connected");
}

module.exports = connectDB;
