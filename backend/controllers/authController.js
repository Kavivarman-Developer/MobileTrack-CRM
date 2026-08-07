const { OAuth2Client } = require("google-auth-library");
const Organization = require("../models/Organization");
const User = require("../models/User");
const { signAccessToken, signRefreshToken } = require("../utils/tokens");

const GOOGLE_AUDIENCE = [
  process.env.GOOGLE_CLIENT_ID,
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_ID_ANDROID,
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  process.env.GOOGLE_CLIENT_ID_IOS,
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
].filter(Boolean);

async function authPayload(user) {
  if (user.role && !["superadmin", "admin", "staff"].includes(user.role)) user.role = "admin";
  if (user.isActive === false) {
    const error = new Error("Account is blocked");
    error.statusCode = 403;
    error.reason = user.blockedReason || undefined;
    throw error;
  }
  if (user.role !== "superadmin" && user.organizationId) {
    const organization = await Organization.findById(user.organizationId);
    if (!organization?.isActive) {
      const error = new Error("Organization is inactive");
      error.statusCode = 403;
      throw error;
    }
    if (organization.subscriptionStatus === "cancelled") {
      const error = new Error("Subscription is cancelled");
      error.statusCode = 403;
      throw error;
    }
  }
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshToken = refreshToken;
  await user.save();
  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      organizationId: user.organizationId,
      avatarUrl: user.avatarUrl,
      authProvider: user.authProvider,
    },
    accessToken,
    refreshToken,
  };
}

async function register(req, res, next) {
  try {
    const { name, email, password, phone, role = "admin", businessName } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required" });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "Email already registered" });
    const safeRole = role === "staff" ? "staff" : "admin";
    const organization = await Organization.create({ name: businessName || `${name}'s Business` });
    const user = await User.create({ name, email, password, phone, role: safeRole, organizationId: organization._id, authProvider: "local" });
    organization.ownerUserId = user._id;
    await organization.save();
    res.status(201).json(await authPayload(user));
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) return res.status(401).json({ message: "Invalid credentials" });
    if (user.isActive === false) {
      return res.status(403).json({ message: "Account is blocked", reason: user.blockedReason || undefined });
    }
    res.json(await authPayload(user));
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message, reason: error.reason });
    next(error);
  }
}

async function forgotPasswordStatus(req, res, next) {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) {
      const enabledOrganization = await Organization.exists({
        forgotPasswordEnabled: true,
        isActive: { $ne: false },
        subscriptionStatus: { $ne: "cancelled" },
      });
      return res.json({ enabled: !!enabledOrganization });
    }

    const user = await User.findOne({ email }).select("role organizationId authProvider");
    if (!user || user.role !== "admin" || !user.organizationId || user.authProvider !== "local") {
      return res.json({ enabled: false });
    }

    const organization = await Organization.findById(user.organizationId).select("forgotPasswordEnabled isActive subscriptionStatus");
    const enabled = !!organization?.forgotPasswordEnabled && organization.isActive !== false && organization.subscriptionStatus !== "cancelled";
    res.json({ enabled });
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || password.length < 6) return res.status(400).json({ message: "Email and a 6 character password are required" });

    const user = await User.findOne({ email });
    if (!user || user.role !== "admin" || !user.organizationId || user.authProvider !== "local") {
      return res.status(403).json({ message: "Password reset is not enabled for this account" });
    }

    const organization = await Organization.findById(user.organizationId).select("forgotPasswordEnabled isActive subscriptionStatus");
    const enabled = !!organization?.forgotPasswordEnabled && organization.isActive !== false && organization.subscriptionStatus !== "cancelled";
    if (!enabled) return res.status(403).json({ message: "Password reset is not enabled for this account" });

    user.password = password;
    user.refreshToken = null;
    await user.save();
    res.json({ message: "Password updated. Please sign in with your new password." });
  } catch (error) {
    next(error);
  }
}

async function googleLogin(req, res, next) {
  try {
    const { idToken, businessName } = req.body;
    if (!idToken) return res.status(400).json({ message: "Google ID token is required" });
    if (!GOOGLE_AUDIENCE.length) return res.status(500).json({ message: "Google login is not configured" });

    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_AUDIENCE });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(401).json({ message: "Google account email is required" });

    let user = await User.findOne({ email: payload.email.toLowerCase() });
    if (user) {
      if (user.isActive === false) {
        return res.status(403).json({ message: "Account is blocked", reason: user.blockedReason || undefined });
      }
      user.googleId = user.googleId || payload.sub;
      user.authProvider = "google";
      user.avatarUrl = payload.picture || user.avatarUrl;
      user.name = user.name || payload.name || payload.email;
      if (!user.organizationId && user.role !== "superadmin") {
        const organization = await Organization.create({ name: businessName || `${user.name}'s Business`, ownerUserId: user._id });
        user.organizationId = organization._id;
      }
      return res.json(await authPayload(user));
    }

    const organization = await Organization.create({ name: businessName || `${payload.name || "New"}'s Business` });
    user = await User.create({
      name: payload.name || payload.email,
      email: payload.email,
      role: "admin",
      organizationId: organization._id,
      authProvider: "google",
      googleId: payload.sub,
      avatarUrl: payload.picture,
    });
    organization.ownerUserId = user._id;
    await organization.save();
    res.status(201).json(await authPayload(user));
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message, reason: error.reason });
    next(error);
  }
}

module.exports = { register, login, googleLogin, forgotPasswordStatus, resetPassword };
