const { OAuth2Client } = require("google-auth-library");
const admin = require("../config/firebase");
const Organization = require("../models/Organization");
const User = require("../models/User");
const { signAccessToken, signRefreshToken, hashResetToken, createPasswordResetToken } = require("../utils/tokens");
const { sendPasswordResetEmail } = require("../services/emailService");

const GOOGLE_AUDIENCE = [
  process.env.GOOGLE_CLIENT_ID,
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_ID_ANDROID,
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  process.env.GOOGLE_CLIENT_ID_IOS,
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
].filter(Boolean);

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("91")) return digits.slice(-10);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isPhone(value) {
  const digits = normalizePhone(value);
  return digits.length >= 10 && digits.length <= 15;
}

function detectIdentifierKind(value) {
  const trimmed = String(value || "").trim();
  if (isEmail(trimmed)) return "email";
  if (isPhone(trimmed)) return "phone";
  return null;
}

async function findUserByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const users = await User.find({ phone: { $exists: true, $nin: [null, ""] } });
  return (
    users.find((user) => {
      const stored = normalizePhone(user.phone);
      return stored === normalized || stored.endsWith(normalized) || normalized.endsWith(stored);
    }) || null
  );
}

async function findUserByIdentifier(identifier) {
  const trimmed = String(identifier || "").trim();
  const kind = detectIdentifierKind(trimmed);
  if (kind === "email") return User.findOne({ email: trimmed.toLowerCase() });
  if (kind === "phone") return findUserByPhone(trimmed);
  return null;
}

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

async function lookupAccount(req, res, next) {
  try {
    const identifier = String(req.body.identifier || "").trim();
    const kind = detectIdentifierKind(identifier);
    if (!kind) {
      return res.status(400).json({ message: "Enter a valid email or 10-digit mobile number" });
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return res.json({
        exists: false,
        kind,
        email: kind === "email" ? identifier.toLowerCase() : "",
        phone: kind === "phone" ? normalizePhone(identifier) : "",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: "Account is blocked", reason: user.blockedReason || undefined });
    }

    res.json({
      exists: true,
      kind,
      email: user.email,
      phone: user.phone || "",
      nameHint: user.name ? String(user.name).split(" ")[0] : "",
      authProvider: user.authProvider || "local",
    });
  } catch (error) {
    next(error);
  }
}

async function register(req, res, next) {
  try {
    const { name, email, password, phone, role = "admin", businessName } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = phone ? normalizePhone(phone) : "";
    if (!name || !cleanEmail || !password) return res.status(400).json({ message: "Name, email and password are required" });
    if (String(password).length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    if (!isEmail(cleanEmail)) return res.status(400).json({ message: "Enter a valid email" });
    if (phone && !isPhone(phone)) return res.status(400).json({ message: "Enter a valid mobile number" });

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) return res.status(409).json({ message: "Email already registered" });
    if (cleanPhone) {
      const existingPhone = await findUserByPhone(cleanPhone);
      if (existingPhone) return res.status(409).json({ message: "Mobile number already registered" });
    }

    const safeRole = role === "staff" ? "staff" : "admin";
    const organization = await Organization.create({ name: businessName || `${name}'s Shop` });
    const user = await User.create({
      name: String(name).trim(),
      email: cleanEmail,
      password,
      phone: cleanPhone || undefined,
      role: safeRole,
      organizationId: organization._id,
      authProvider: "local",
    });
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
    const identifier = String(req.body.identifier || req.body.email || req.body.phone || "").trim();
    const password = String(req.body.password || "");
    if (!identifier || !password) return res.status(400).json({ message: "Email/mobile and password are required" });

    const user = await findUserByIdentifier(identifier);
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

async function isPasswordResetEnabledForUser(user) {
  if (!user || user.role !== "admin" || !user.organizationId || user.authProvider !== "local") return false;
  const organization = await Organization.findById(user.organizationId).select("forgotPasswordEnabled isActive subscriptionStatus");
  return !!organization?.forgotPasswordEnabled && organization.isActive !== false && organization.subscriptionStatus !== "cancelled";
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
    const enabled = await isPasswordResetEnabledForUser(user);
    res.json({ enabled });
  } catch (error) {
    next(error);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email is required" });

    const acceptedResponse = { message: "If that account can reset its password, an email with instructions has been sent." };

    const user = await User.findOne({ email });
    if (!(await isPasswordResetEnabledForUser(user))) return res.json(acceptedResponse);

    const { token, tokenHash, expiresAt } = createPasswordResetToken();
    user.resetTokenHash = tokenHash;
    user.resetTokenExpiry = expiresAt;
    await user.save();

    const resetUrl = `${process.env.PASSWORD_RESET_URL_BASE}?token=${token}&email=${encodeURIComponent(email)}`;
    await sendPasswordResetEmail(email, token, resetUrl);

    res.json(acceptedResponse);
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const token = String(req.body.token || "").trim();
    const password = String(req.body.password || "");
    if (!email || !token || password.length < 6) {
      return res.status(400).json({ message: "Email, reset token and a 6 character password are required" });
    }

    const tokenHash = hashResetToken(token);
    const user = await User.findOne({ email }).select("+resetTokenHash");
    const tokenValid = user?.resetTokenHash === tokenHash && user?.resetTokenExpiry && user.resetTokenExpiry.getTime() > Date.now();
    if (!tokenValid || !(await isPasswordResetEnabledForUser(user))) {
      return res.status(400).json({ message: "Reset link is invalid or has expired" });
    }

    user.password = password;
    user.refreshToken = null;
    user.resetTokenHash = null;
    user.resetTokenExpiry = null;
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

async function firebaseLogin(req, res, next) {
  try {
    const { idToken, name, businessName } = req.body;
    if (!idToken) return res.status(400).json({ message: "Firebase ID token is required" });

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const { uid, email, phone_number: phoneNumber } = decoded;
    const cleanEmail = email ? email.toLowerCase() : "";
    const cleanPhone = phoneNumber ? normalizePhone(phoneNumber) : "";

    let user = await User.findOne({ firebaseUid: uid });
    if (!user && cleanEmail) user = await User.findOne({ email: cleanEmail });
    if (!user && cleanPhone) user = await findUserByPhone(cleanPhone);

    if (user) {
      if (user.isActive === false) {
        return res.status(403).json({ message: "Account is blocked", reason: user.blockedReason || undefined });
      }
      user.firebaseUid = user.firebaseUid || uid;
      user.authProvider = "firebase";
      if (cleanEmail && !user.email) user.email = cleanEmail;
      if (cleanPhone && !user.phone) user.phone = cleanPhone;
      if (!user.organizationId && user.role !== "superadmin") {
        const organization = await Organization.create({ name: businessName || `${user.name}'s Business`, ownerUserId: user._id });
        user.organizationId = organization._id;
      }
      return res.json(await authPayload(user));
    }

    if (!name) return res.status(400).json({ message: "Name is required for new accounts" });

    const organization = await Organization.create({ name: businessName || `${name}'s Shop` });
    user = await User.create({
      name: String(name).trim(),
      email: cleanEmail || undefined,
      phone: cleanPhone || undefined,
      role: "admin",
      organizationId: organization._id,
      authProvider: "firebase",
      firebaseUid: uid,
    });
    organization.ownerUserId = user._id;
    await organization.save();
    res.status(201).json(await authPayload(user));
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message, reason: error.reason });
    next(error);
  }
}

module.exports = { lookupAccount, register, login, googleLogin, firebaseLogin, forgotPasswordStatus, requestPasswordReset, resetPassword };
