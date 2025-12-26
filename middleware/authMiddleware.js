const jwt = require("jsonwebtoken");
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
};