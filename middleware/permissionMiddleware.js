const { User, Role, Permission } = require("../models");
module.exports = permissionCode => async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, { include: [{ model: Role, include: [Permission] }, { model: Permission }] });
    const rolePermissions = user.Roles.flatMap(r => r.Permissions.map(p => p.code));
    const userPermissions = user.Permissions.map(p => p.code);
    const effectivePermissions = [...new Set([...rolePermissions, ...userPermissions])];
    if (!effectivePermissions.includes(permissionCode)) return res.status(403).send("Forbidden");
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
};