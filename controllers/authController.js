const bcrypt = require("bcrypt");
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
};