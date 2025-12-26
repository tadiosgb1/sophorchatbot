const { User, Role, Permission, Op } = require("../models");

module.exports = {
  async getAll(req, res) {
    try {
      let page = parseInt(req.query.page) || 1;
      let page_size = parseInt(req.query.page_size) || 10;
      let search = req.query.search || "";
      let ordering = req.query.ordering || "id";
      if (page < 1) page = 1;
      if (page_size < 1) page_size = 10;
      const searchFields = [{ first_name: { [Op.like]: '%' + search + '%' } }, { middle_name: { [Op.like]: '%' + search + '%' } }, { last_name: { [Op.like]: '%' + search + '%' } }, { phone: { [Op.like]: '%' + search + '%' } }, { email: { [Op.like]: '%' + search + '%' } }];
      const where = search ? { [Op.or]: searchFields } : {};
      const order = ordering.startsWith("-") ? [[ordering.slice(1), "DESC"]] : [[ordering, "ASC"]];
      const offset = (page - 1) * page_size;
      const { rows, count } = await User.findAndCountAll({ where, order, offset, limit: page_size, include: [Role, Permission] });
      const baseUrl = `${req.protocol}://${req.get("host")}${req.path}`;
      const total_pages = Math.ceil(count / page_size);
      res.json({ count, total_pages, current_page: page, next: page < total_pages ? `${baseUrl}?page=${page + 1}&page_size=${page_size}` : null, previous: page > 1 ? `${baseUrl}?page=${page - 1}&page_size=${page_size}` : null, page_size, data: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  async getOne(req, res) { try { const user = await User.findByPk(req.params.id, { include: [Role, Permission] }); if (!user) return res.status(404).json({ error: "Not found" }); res.json(user); } catch (e) { res.status(500).json({ error: e.message }); } },

  async patch(req, res) { try { const user = await User.findByPk(req.params.id); if (!user) return res.status(404).json({ error: "Not found" }); Object.assign(user, req.body); await user.save(); res.json(user); } catch (e) { res.status(500).json({ error: e.message }); } },

  async update(req, res) { try { const [affected] = await User.update(req.body, { where: { id: req.params.id } }); if (!affected) return res.status(404).json({ error: "Not found" }); const updated = await User.findByPk(req.params.id, { include: [Role, Permission] }); res.json(updated); } catch (e) { res.status(500).json({ error: e.message }); } },

  async delete(req, res) { try { const deleted = await User.destroy({ where: { id: req.params.id } }); if (!deleted) return res.status(404).json({ error: "Not found" }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } },

  async assignRoles(req, res) { try { const user = await User.findByPk(req.params.id); const roles = await Role.findAll({ where: { id: req.body.roleIds } }); await user.setRoles(roles); res.send("Roles assigned"); } catch (e) { res.status(500).json({ error: e.message }); } },

  async assignPermissions(req, res) { try { const user = await User.findByPk(req.params.id); const permissions = await Permission.findAll({ where: { id: req.body.permissionIds } }); await user.setPermissions(permissions); res.send("Permissions assigned"); } catch (e) { res.status(500).json({ error: e.message }); } },

  async getEffectivePermissions(req, res) {
    try {
      const user = await User.findByPk(req.params.id, { include: [Role, Permission] });
      if (!user) return res.status(404).json({ error: "Not found" });
      const rolePermissions = user.Roles.flatMap(r => r.Permissions.map(p => p.code));
      const userPermissions = user.Permissions.map(p => p.code);
      const effectivePermissions = [...new Set([...rolePermissions, ...userPermissions])];
      res.json({ roles: user.Roles, permissions: effectivePermissions });
    } catch (e) { res.status(500).json({ error: e.message }); }
  }
};