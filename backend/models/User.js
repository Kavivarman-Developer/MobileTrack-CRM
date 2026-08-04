const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    role: { type: String, enum: ["superadmin", "admin", "staff"], default: "admin" },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    googleId: { type: String, unique: true, sparse: true },
    avatarUrl: String,
    phone: String,
    refreshToken: String,
    isActive: { type: Boolean, default: true },
    blockedAt: { type: Date, default: null },
    blockedReason: { type: String, default: null },
  },
  { timestamps: true }
);

userSchema.pre("validate", function normalizeLegacyRole() {
  if (!["superadmin", "admin", "staff"].includes(this.role)) this.role = "admin";
});

userSchema.pre("save", async function hashPassword() {
  if (!this.password) return;
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function matchPassword(password) {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
