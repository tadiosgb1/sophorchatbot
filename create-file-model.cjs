// create-file-model.cjs
// Generator: models/controllers/routes (file fields + foreign keys + pagination/search/order)

// Imports
const fs = require("fs");
const path = require("path");

// CLI
const args = process.argv.slice(2);
const [modelName, tableName, ...fieldArgsRaw] = args;

if (!modelName || !tableName || fieldArgsRaw.length === 0) {
  console.log("Usage: node create-file-model.cjs Model table field:type field2:type ...");
  process.exit(1);
}

// Helpers
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Parse fields
const fields = fieldArgsRaw.map((f) => {
  const parts = f.split(":");
  return {
    name: parts[0],
    type: parts[1],
    isFK: parts[1] === "fk",
    ref: parts[1] === "fk" ? parts[2] : null,
    isFile: parts[1] === "file"
  };
});

// Prepare lists
const fileFields = fields.filter((f) => f.isFile).map((f) => f.name);
const fkFields = fields.filter((f) => f.isFK);
const requiresUpload = fileFields.length > 0;

// Type map
const typeMap = {
  string: "Sequelize.STRING",
  int: "Sequelize.INTEGER",
  boolean: "Sequelize.BOOLEAN",
  date: "Sequelize.DATE",
  float: "Sequelize.FLOAT",
  file: "Sequelize.STRING"
};

// Paths
const modelDir = path.join(process.cwd(), "models");
const controllerDir = path.join(process.cwd(), "controllers");
const routeDir = path.join(process.cwd(), "routes");
const middlewareDir = path.join(process.cwd(), "middleware");
const configDir = path.join(process.cwd(), "config");
const serverPath = path.join(process.cwd(), "server.js");

[modelDir, controllerDir, routeDir, configDir, middlewareDir].forEach((p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p);
});

// Ensure uploadMiddleware exists
const uploadMiddlewarePath = path.join(middlewareDir, "uploadMiddleware.js");
if (!fs.existsSync(uploadMiddlewarePath)) {
  const uploadMiddlewareTemplate = `
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + ext);
  }
});

module.exports = multer({ storage });
`;
  fs.writeFileSync(uploadMiddlewarePath, uploadMiddlewareTemplate);
  console.log("✔ uploadMiddleware.js created");
}

// Create config if missing
const configFile = path.join(configDir, "config.js");
if (!fs.existsSync(configFile)) {
  const configTemplate = `module.exports = {
  development: {
    username: "root",
    password: "",
    database: "project_db",
    host: "127.0.0.1",
    dialect: "mysql",
    logging: false
  }
};`;
  fs.writeFileSync(configFile, configTemplate);
  console.log("✔ config.js created");
}

// Build model file
const assocLines = fkFields
  .map((f) => `${cap(modelName)}.belongsTo(db.${cap(f.ref)}, { foreignKey: "${f.name}" });`)
  .join("\n    ");

const modelTemplate = `module.exports = (sequelize, Sequelize) => {
  const ${cap(modelName)} = sequelize.define("${cap(modelName)}", {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    ${fields
      .map((f) => {
        if (f.isFK) {
          const refTable = f.ref.toLowerCase() + "s";
          return `${f.name}: { type: Sequelize.INTEGER, references: { model: "${refTable}", key: "id" } }`;
        }
        return `${f.name}: { type: ${typeMap[f.type] || "Sequelize.STRING"} }`;
      })
      .join(",\n    ")}
  }, {
    tableName: "${tableName}"
  });

  ${assocLines ? `${cap(modelName)}.associate = (db) => {\n    ${assocLines}\n  };` : ""}

  return ${cap(modelName)};
};`;

fs.writeFileSync(path.join(modelDir, `${cap(modelName)}.js`), modelTemplate);
console.log("✔ Model created");

// Build controller
const fkIncludeList = fkFields.map((f) => `db.${cap(f.ref)}`).join(", ");

const controllerTemplate = `const { Op } = require("sequelize");
const db = require("../models");
const ${cap(modelName)} = db.${cap(modelName)};

module.exports = {
  async getAll(req, res) {
    try {
      let page = parseInt(req.query.page) || 1;
      let page_size = parseInt(req.query.page_size) || 10;
      let search = req.query.search || "";
      let ordering = req.query.ordering || "id";

      if (page < 1) page = 1;
      if (page_size < 1) page_size = 10;

      const searchableFields = [${fields.filter(f => f.type === "string").map(f => `"${f.name}"`).join(", ")}];
      const searchConditions = searchableFields.map(field => ({ [field]: { [Op.like]: "%" + search + "%" } }));
      const where = search ? { [Op.or]: searchConditions } : {};
      const order = ordering.startsWith("-") ? [[ordering.slice(1), "DESC"]] : [[ordering, "ASC"]];
      const offset = (page - 1) * page_size;

      const include = [${fkIncludeList}].filter(Boolean);
      const findOptions = { where, order, offset, limit: page_size };
      if (include.length) findOptions.include = include;

      const { rows, count } = await ${cap(modelName)}.findAndCountAll(findOptions);

      const host = \`\${req.protocol}://\${req.get("host")}\`;
      const dataWithFiles = rows.map(item => {
        const obj = item.toJSON();
        ${fileFields.map(f => `if (obj.${f}) obj.${f} = host + "/" + obj.${f}.replace(/\\\\/g, "/");`).join("\n        ")}
        return obj;
      });

      const total_pages = Math.ceil(count / page_size);
      const baseUrl = \`\${req.protocol}://\${req.get("host")}\${req.path}\`;

      res.json({
        count,
        total_pages,
        current_page: page,
        next: page < total_pages ? \`\${baseUrl}?page=\${page + 1}&page_size=\${page_size}\` : null,
        previous: page > 1 ? \`\${baseUrl}?page=\${page - 1}&page_size=\${page_size}\` : null,
        page_size,
        data: dataWithFiles
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async getOne(req, res) {
    try {
      const include = [${fkIncludeList}].filter(Boolean);
      const opts = include.length ? { include } : {};
      const data = await ${cap(modelName)}.findByPk(req.params.id, opts);
      if (!data) return res.status(404).json({ error: "Not found" });

      const obj = data.toJSON();
      const host = \`\${req.protocol}://\${req.get("host")}\`;
      ${fileFields.map(f => `if (obj.${f}) obj.${f} = host + "/" + obj.${f}.replace(/\\\\/g, "/");`).join("\n      ")}
      res.json(obj);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async create(req, res) {
    try {
      const body = { ...req.body };
      ${fileFields.map(f => `if (req.files && req.files['${f}']) body.${f} = req.files['${f}'][0].path;`).join("\n      ")}
      const data = await ${cap(modelName)}.create(body);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async update(req, res) {
    try {
      const body = { ...req.body };
      ${fileFields.map(f => `if (req.files && req.files['${f}']) body.${f} = req.files['${f}'][0].path;`).join("\n      ")}
      await ${cap(modelName)}.update(body, { where: { id: req.params.id } });
      const updated = await ${cap(modelName)}.findByPk(req.params.id);
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  async delete(req, res) {
    try {
      await ${cap(modelName)}.destroy({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
};
`;

fs.writeFileSync(path.join(controllerDir, `${cap(modelName)}Controller.js`), controllerTemplate);
console.log("✔ Controller created");

// Build routes
let uploadRoutePart = "";
if (requiresUpload) {
  uploadRoutePart = `
const upload = require("../middleware/uploadMiddleware");
const uploadFields = upload.fields([${fileFields.map(f => `{ name: "${f}", maxCount: 1 }`).join(", ")}]);
`;
}

const routesTemplate = `const express = require("express");
const router = express.Router();
const controller = require("../controllers/${cap(modelName)}Controller");
${uploadRoutePart}

router.get("/", controller.getAll);
router.get("/:id", controller.getOne);
router.post("/", ${requiresUpload ? "uploadFields," : ""} controller.create);
router.put("/:id", ${requiresUpload ? "uploadFields," : ""} controller.update);
router.delete("/:id", controller.delete);

module.exports = router;
`;

const routeFileName = `${modelName.toLowerCase()}Routes.js`;
fs.writeFileSync(path.join(routeDir, routeFileName), routesTemplate);
console.log("✔ Routes created");

// Append route to existing server.js
if (fs.existsSync(serverPath)) {
  let serverContent = fs.readFileSync(serverPath, "utf8");

  const importLine = `const ${modelName.toLowerCase()}Routes = require('./routes/${routeFileName}');\n`;
  const useLine = `app.use("/api/${modelName.toLowerCase()}", ${modelName.toLowerCase()}Routes);\n`;

  if (!serverContent.includes(importLine)) {
    serverContent = serverContent.replace(/(const .*?;\s*)/s, `$1${importLine}`);
  }

  if (!serverContent.includes(useLine)) {
    serverContent = serverContent.replace(/app\.listen/, `${useLine}app.listen`);
  }

  fs.writeFileSync(serverPath, serverContent);
  console.log("✔ Route appended to server.js");
} else {
  console.log("⚠ server.js not found — route not appended (script does NOT create server.js).");
}

console.log(`🎉 File-upload & FK model created: ${modelName}`);
