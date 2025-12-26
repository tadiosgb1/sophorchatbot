#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const baseDir = process.cwd();
const folders = ["controllers", "models", "routes", "middleware", "config", "uploads"];

// Create folders
folders.forEach(folder => {
  const folderPath = path.join(baseDir, folder);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);
});

// ===================
// .env
// ===================
fs.writeFileSync(path.join(baseDir, ".env"), `ACCESS_SECRET=your_access_secret
REFRESH_SECRET=your_refresh_secret
PORT=5000
UPLOAD_DIR=uploads/
`);

// ===================
// config/config.js
// ===================
fs.writeFileSync(path.join(baseDir, "config", "config.js"), `module.exports = {
  development: {
    username: "root",
    password: "",
    database: "web_db",
    host: "127.0.0.1",
    dialect: "mysql",
    logging: false
  }
};`);

// ===================
// models/index.js
// ===================
fs.writeFileSync(path.join(baseDir, "models", "index.js"), `const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const config = require("../config/config").development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
  logging: config.logging
});

const db = {};

fs.readdirSync(__dirname)
  .filter(file => file !== "index.js" && file.endsWith(".js"))
  .forEach(file => {
    const modelDef = require(path.join(__dirname, file));
    const model = modelDef(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) db[modelName].associate(db);
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;
module.exports = db;`);

// ===================
// Models
// ===================

// User.js
fs.writeFileSync(path.join(baseDir, "models", "User.js"), `module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
    first_name: DataTypes.STRING,
    middle_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: { type: DataTypes.STRING, unique: true },
    password: DataTypes.STRING,
    avatar_url: DataTypes.STRING,
    resetToken: DataTypes.STRING,
    resetTokenExpiry: DataTypes.DATE
  });

  User.associate = models => {
    User.belongsToMany(models.Role, { through: "UserRoles" });
    User.belongsToMany(models.Permission, { through: "UserPermissions" });
  };

  return User;
};`);

// Role.js
fs.writeFileSync(path.join(baseDir, "models", "Role.js"), `module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define("Role", {
    name: { type: DataTypes.STRING, unique: true },
    description: DataTypes.STRING
  });

  Role.associate = models => {
    Role.belongsToMany(models.User, { through: "UserRoles" });
    Role.belongsToMany(models.Permission, { through: "RolePermissions" });
  };

  return Role;
};`);

// Permission.js
fs.writeFileSync(path.join(baseDir, "models", "Permission.js"), `module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define("Permission", {
    name: DataTypes.STRING,
    code: { type: DataTypes.STRING, unique: true },
    description: DataTypes.STRING
  });

  Permission.associate = models => {
    Permission.belongsToMany(models.Role, { through: "RolePermissions" });
    Permission.belongsToMany(models.User, { through: "UserPermissions" });
  };

  return Permission;
};`);

// UserRole.js
fs.writeFileSync(path.join(baseDir, "models", "UserRole.js"), `module.exports = (sequelize, DataTypes) => {
  const UserRole = sequelize.define("UserRole", {
    userId: DataTypes.INTEGER,
    roleId: DataTypes.INTEGER
  });
  return UserRole;
};`);

// RolePermission.js
fs.writeFileSync(path.join(baseDir, "models", "RolePermission.js"), `module.exports = (sequelize, DataTypes) => {
  const RolePermission = sequelize.define("RolePermission", {
    roleId: DataTypes.INTEGER,
    permissionId: DataTypes.INTEGER
  });
  return RolePermission;
};`);

// UserPermission.js
fs.writeFileSync(path.join(baseDir, "models", "UserPermission.js"), `module.exports = (sequelize, DataTypes) => {
  const UserPermission = sequelize.define("UserPermission", {
    userId: DataTypes.INTEGER,
    permissionId: DataTypes.INTEGER
  });
  return UserPermission;
};`);

// ===================
// Middleware
// ===================

// authMiddleware.js
fs.writeFileSync(path.join(baseDir, "middleware", "authMiddleware.js"), `const jwt = require("jsonwebtoken");
module.exports = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(401).send("Access denied");
  try {
    const payload = jwt.verify(token, process.env.ACCESS_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    res.status(403).send("Invalid token");
  }
};`);

// permissionMiddleware.js
fs.writeFileSync(path.join(baseDir, "middleware", "permissionMiddleware.js"), `const { User, Role, Permission } = require("../models");
module.exports = permissionCode => async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, { include: [{ model: Role, include: [Permission] }, { model: Permission }] });
    const rolePermissions = user.Roles.flatMap(r => r.Permissions.map(p => p.code));
    const userPermissions = user.Permissions.map(p => p.code);
    const effectivePermissions = [...new Set([...rolePermissions, ...userPermissions])];
    if (!effectivePermissions.includes(permissionCode)) return res.status(403).send("Forbidden");
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
};`);

// uploadMiddleware.js
fs.writeFileSync(path.join(baseDir, "middleware", "uploadMiddleware.js"), `const multer = require("multer");
const path = require("path");
const fs = require("fs");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.UPLOAD_DIR || "uploads/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
module.exports = multer({ storage });`);

// ===================
// Controllers
// ===================

// authController.js
fs.writeFileSync(path.join(baseDir, "controllers", "authController.js"), `const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { User, Role, Permission } = require("../models");
const generateAccessToken = user => jwt.sign({ id: user.id }, process.env.ACCESS_SECRET, { expiresIn: "15m" });
const generateRefreshToken = user => jwt.sign({ id: user.id }, process.env.REFRESH_SECRET, { expiresIn: "7d" });

module.exports = {
  register: async (req, res) => {
    try {
      const { first_name, middle_name, last_name, phone, email, password } = req.body;
      if (!req.file) return res.status(400).send("Avatar required");
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({ first_name, middle_name, last_name, phone, email, password: hashedPassword, avatar_url: req.file.path });
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      const userData = await User.findByPk(user.id, { include: [Role, Permission] });
      const effectivePermissions = [...new Set([...userData.Roles.flatMap(r => r.Permissions.map(p => p.code)), ...userData.Permissions.map(p => p.code)])];
      res.json({ id: user.id, email: user.email, roles: userData.Roles, permissions: effectivePermissions, accessToken, refreshToken });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ where: { email }, include: [Role, Permission] });
      if (!user) return res.status(400).send("User not found");
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).send("Invalid password");
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      const effectivePermissions = [...new Set([...user.Roles.flatMap(r => r.Permissions.map(p => p.code)), ...user.Permissions.map(p => p.code)])];
      res.json({ id: user.id, email: user.email, roles: user.Roles, permissions: effectivePermissions, accessToken, refreshToken });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  refreshToken: (req, res) => {
    const { token } = req.body;
    if (!token) return res.sendStatus(401);
    try {
      const payload = jwt.verify(token, process.env.REFRESH_SECRET);
      res.json({ accessToken: generateAccessToken({ id: payload.id }) });
    } catch (e) { res.status(403).send("Invalid token"); }
  },

  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user) return res.status(400).send("User not found");
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.resetToken = resetToken;
      user.resetTokenExpiry = Date.now() + 3600000;
      await user.save();
      res.send("Reset link sent (simulate email)");
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  resetPassword: async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      const { Op } = require("sequelize");
      const user = await User.findOne({ where: { resetToken: token, resetTokenExpiry: { [Op.gt]: Date.now() } } });
      if (!user) return res.status(400).send("Invalid or expired token");
      user.password = await bcrypt.hash(newPassword, 10);
      user.resetToken = null;
      user.resetTokenExpiry = null;
      await user.save();
      res.send("Password reset successful");
    } catch (e) { res.status(500).json({ error: e.message }); }
  }
};`);

// ===================
// userController.js
// ===================
fs.writeFileSync(path.join(baseDir, "controllers", "userController.js"), `const { User, Role, Permission, Op } = require("../models");

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
      const baseUrl = \`\${req.protocol}://\${req.get("host")}\${req.path}\`;
      const total_pages = Math.ceil(count / page_size);
      res.json({ count, total_pages, current_page: page, next: page < total_pages ? \`\${baseUrl}?page=\${page + 1}&page_size=\${page_size}\` : null, previous: page > 1 ? \`\${baseUrl}?page=\${page - 1}&page_size=\${page_size}\` : null, page_size, data: rows });
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
};`);

// ===================
// roleController.js
// ===================
fs.writeFileSync(path.join(baseDir, "controllers", "roleController.js"), `const { Role, Permission, Op } = require("../models");
module.exports = {
  async getAll(req, res) {
    try {
      let page = parseInt(req.query.page) || 1;
      let page_size = parseInt(req.query.page_size) || 10;
      let search = req.query.search || "";
      let ordering = req.query.ordering || "id";
      if (page < 1) page = 1;
      if (page_size < 1) page_size = 10;
      const where = search ? { name: { [Op.like]: '%' + search + '%' } } : {};
      const order = ordering.startsWith("-") ? [[ordering.slice(1), "DESC"]] : [[ordering, "ASC"]];
      const offset = (page - 1) * page_size;
      const { rows, count } = await Role.findAndCountAll({ where, order, offset, limit: page_size, include: [Permission] });
      const baseUrl = \`\${req.protocol}://\${req.get("host")}\${req.path}\`;
      const total_pages = Math.ceil(count / page_size);
      res.json({ count, total_pages, current_page: page, next: page < total_pages ? \`\${baseUrl}?page=\${page + 1}&page_size=\${page_size}\` : null, previous: page > 1 ? \`\${baseUrl}?page=\${page - 1}&page_size=\${page_size}\` : null, page_size, data: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  async getOne(req, res) { try { const role = await Role.findByPk(req.params.id, { include: [Permission] }); if (!role) return res.status(404).json({ error: "Not found" }); res.json(role); } catch (e) { res.status(500).json({ error: e.message }); } },

  async create(req, res) { try { const role = await Role.create(req.body); res.json(role); } catch (e) { res.status(500).json({ error: e.message }); } },

  async patch(req, res) { try { const role = await Role.findByPk(req.params.id); if (!role) return res.status(404).json({ error: "Not found" }); Object.assign(role, req.body); await role.save(); res.json(role); } catch (e) { res.status(500).json({ error: e.message }); } },

  async update(req, res) { try { const [affected] = await Role.update(req.body, { where: { id: req.params.id } }); if (!affected) return res.status(404).json({ error: "Not found" }); const updated = await Role.findByPk(req.params.id, { include: [Permission] }); res.json(updated); } catch (e) { res.status(500).json({ error: e.message }); } },

  async delete(req, res) { try { const deleted = await Role.destroy({ where: { id: req.params.id } }); if (!deleted) return res.status(404).json({ error: "Not found" }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } },

  async assignPermissions(req, res) { try { const role = await Role.findByPk(req.params.id); const permissions = await Permission.findAll({ where: { id: req.body.permissionIds } }); await role.setPermissions(permissions); res.send("Permissions assigned"); } catch (e) { res.status(500).json({ error: e.message }); } }
};`);

// ===================
// permissionController.js
// ===================
fs.writeFileSync(path.join(baseDir, "controllers", "permissionController.js"), `const { Permission, Op } = require("../models");
module.exports = {
  async getAll(req, res) {
    try {
      let page = parseInt(req.query.page) || 1;
      let page_size = parseInt(req.query.page_size) || 10;
      let search = req.query.search || "";
      let ordering = req.query.ordering || "id";
      if (page < 1) page = 1;
      if (page_size < 1) page_size = 10;
      const where = search ? { code: { [Op.like]: '%' + search + '%' } } : {};
      const order = ordering.startsWith("-") ? [[ordering.slice(1), "DESC"]] : [[ordering, "ASC"]];
      const offset = (page - 1) * page_size;
      const { rows, count } = await Permission.findAndCountAll({ where, order, offset, limit: page_size });
      const baseUrl = \`\${req.protocol}://\${req.get("host")}\${req.path}\`;
      const total_pages = Math.ceil(count / page_size);
      res.json({ count, total_pages, current_page: page, next: page < total_pages ? \`\${baseUrl}?page=\${page + 1}&page_size=\${page_size}\` : null, previous: page > 1 ? \`\${baseUrl}?page=\${page - 1}&page_size=\${page_size}\` : null, page_size, data: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  async getOne(req, res) { try { const permission = await Permission.findByPk(req.params.id); if (!permission) return res.status(404).json({ error: "Not found" }); res.json(permission); } catch (e) { res.status(500).json({ error: e.message }); } },

  async create(req, res) { try { const permission = await Permission.create(req.body); res.json(permission); } catch (e) { res.status(500).json({ error: e.message }); } },

  async patch(req, res) { try { const permission = await Permission.findByPk(req.params.id); if (!permission) return res.status(404).json({ error: "Not found" }); Object.assign(permission, req.body); await permission.save(); res.json(permission); } catch (e) { res.status(500).json({ error: e.message }); } },

  async update(req, res) { try { const [affected] = await Permission.update(req.body, { where: { id: req.params.id } }); if (!affected) return res.status(404).json({ error: "Not found" }); const updated = await Permission.findByPk(req.params.id); res.json(updated); } catch (e) { res.status(500).json({ error: e.message }); } },

  async delete(req, res) { try { const deleted = await Permission.destroy({ where: { id: req.params.id } }); if (!deleted) return res.status(404).json({ error: "Not found" }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } }
};`);

// ===================
// Routes
// ===================

// authRoutes.js
fs.writeFileSync(path.join(baseDir, "routes", "authRoutes.js"), `const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const upload = require("../middleware/uploadMiddleware");
router.post("/register", upload.single("avatar"), authController.register);
router.post("/login", authController.login);
router.post("/refresh-token", authController.refreshToken);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
module.exports = router;`);

// userRoutes.js
fs.writeFileSync(path.join(baseDir, "routes", "userRoutes.js"), `const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const permissionMiddleware = require("../middleware/permissionMiddleware");
router.get("/", authMiddleware, permissionMiddleware("view_user"), userController.getAll);
router.get("/:id", authMiddleware, permissionMiddleware("view_user"), userController.getOne);
router.put("/:id", authMiddleware, permissionMiddleware("edit_user"), userController.update);
router.patch("/:id", authMiddleware, permissionMiddleware("edit_user"), userController.patch);
router.delete("/:id", authMiddleware, permissionMiddleware("delete_user"), userController.delete);
router.put("/:id/roles", authMiddleware, permissionMiddleware("assign_role"), userController.assignRoles);
router.put("/:id/permissions", authMiddleware, permissionMiddleware("assign_permission"), userController.assignPermissions);
router.get("/:id/effective-permissions", authMiddleware, permissionMiddleware("view_user"), userController.getEffectivePermissions);
module.exports = router;`);

// roleRoutes.js
fs.writeFileSync(path.join(baseDir, "routes", "roleRoutes.js"), `const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const authMiddleware = require("../middleware/authMiddleware");
const permissionMiddleware = require("../middleware/permissionMiddleware");
router.get("/", authMiddleware, permissionMiddleware("view_role"), roleController.getAll);
router.get("/:id", authMiddleware, permissionMiddleware("view_role"), roleController.getOne);
router.post("/", authMiddleware, permissionMiddleware("create_role"), roleController.create);
router.put("/:id", authMiddleware, permissionMiddleware("edit_role"), roleController.update);
router.patch("/:id", authMiddleware, permissionMiddleware("edit_role"), roleController.patch);
router.delete("/:id", authMiddleware, permissionMiddleware("delete_role"), roleController.delete);
router.put("/:id/permissions", authMiddleware, permissionMiddleware("assign_permission"), roleController.assignPermissions);
module.exports = router;`);

// permissionRoutes.js
fs.writeFileSync(path.join(baseDir, "routes", "permissionRoutes.js"), `const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");
const authMiddleware = require("../middleware/authMiddleware");
const permissionMiddleware = require("../middleware/permissionMiddleware");
router.get("/", authMiddleware, permissionMiddleware("view_permission"), permissionController.getAll);
router.get("/:id", authMiddleware, permissionMiddleware("view_permission"), permissionController.getOne);
router.post("/", authMiddleware, permissionMiddleware("create_permission"), permissionController.create);
router.put("/:id", authMiddleware, permissionMiddleware("edit_permission"), permissionController.update);
router.patch("/:id", authMiddleware, permissionMiddleware("edit_permission"), permissionController.patch);
router.delete("/:id", authMiddleware, permissionMiddleware("delete_permission"), permissionController.delete);
module.exports = router;`);

// ===================
// server.js
// ===================
fs.writeFileSync(path.join(baseDir, "server.js"), `require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./models");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const roleRoutes = require("./routes/roleRoutes");
const permissionRoutes = require("./routes/permissionRoutes");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);

const PORT = process.env.PORT || 5000;
db.sequelize.sync({ alter: true }).then(() => {
  console.log("Database synced");
  app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
}).catch(err => console.error("DB Connection Error:", err));`);

console.log("Full RBAC + JWT project scaffold complete!");
