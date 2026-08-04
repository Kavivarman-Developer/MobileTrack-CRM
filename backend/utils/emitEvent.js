function emitToOrg(req, event, payload) {
  const io = req.app.get("io");
  if (!io) return;
  if (req.orgId) io.to(`org:${req.orgId}`).emit(event, payload);
  io.to("admin").emit(event, { organizationId: req.orgId, data: payload });
}

function emitOrgUpdated(req, organization) {
  const io = req.app.get("io");
  if (!io || !organization?._id) return;
  io.to("admin").emit("organization:updated", organization);
  io.to(`org:${organization._id}`).emit("organization:updated", organization);
}

function emitUserUpdated(req, user) {
  const io = req.app.get("io");
  if (!io || !user?._id) return;
  const payload = {
    _id: user._id,
    id: user._id,
    organizationId: user.organizationId,
    role: user.role,
    isActive: user.isActive,
    blockedAt: user.blockedAt,
    blockedReason: user.blockedReason,
  };
  io.to("admin").emit("user:updated", payload);
  if (user.organizationId) io.to(`org:${user.organizationId}`).emit("user:updated", payload);
}

module.exports = { emitOrgUpdated, emitToOrg, emitUserUpdated };
