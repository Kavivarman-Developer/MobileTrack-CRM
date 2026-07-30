const Role = require("../models/Role");
const User = require("../models/User");
const { signAccessToken, signRefreshToken } = require("../utils/tokens");

async function authPayload(user) {
  await user.populate("role");
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshToken = refreshToken;
  await user.save();
  return {
    user: { id: user._id, name: user.name, email: user.email, role: user.role?.name, phone: user.phone },
    accessToken,
    refreshToken,
  };
}

async function register(req, res, next) {
  try {
    const { name, email, password, phone, role = "admin" } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required" });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "Email already registered" });
    const roleDoc = await Role.findOneAndUpdate({ name: role }, { name: role }, { upsert: true, new: true });
    const user = await User.create({ name, email, password, phone, role: roleDoc._id });
    res.status(201).json(await authPayload(user));
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).populate("role");
    if (!user || !(await user.matchPassword(password))) return res.status(401).json({ message: "Invalid credentials" });
    res.json(await authPayload(user));
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login };
