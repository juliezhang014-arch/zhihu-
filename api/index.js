// api/_app.ts
import crypto from "crypto";
import express from "express";

// api/_templates.ts
var BUILTIN_TEMPLATES = [
  {
    id: "folk-reviewer",
    name: "\u6C11\u95F4\u9510\u8BC4\u4EBA\xB7\u8BF7\u5C31\u4F4D",
    category: "\u70ED\u95E8\u6A21\u7248",
    description: "\u77E5\u4E4E\u98CE\u683C\u6C11\u95F4\u9510\u8BC4\u5361\u7247\uFF08\u5305\u542B\u592F\u3001\u9876\u7EA7\u3001\u4EBA\u4E0A\u4EBA\u3001NPC\u3001\u62C9\u5B8C\u4E86\u5206\u7EA7\uFF09",
    aspectRatio: 0.75,
    // 1125:1500 portrait poster
    width: 1125,
    height: 1500,
    bgType: "image",
    bgImageUrl: "https://picx.zhimg.com/v2-01d4b4d0a7a64017638b4f6936e243b0.png",
    defaultFontId: "zcool-kuaile",
    defaultColor: "#1e293b",
    isBuiltin: true,
    isPublished: true,
    slots: [
      {
        id: "slot-1",
        label: "\u592F",
        placeholder: "\u4F8B\u5982\uFF1A\u6708\u85AA\u4E09\u5343\uFF0C\u82B1\u4E24\u5343\u4E94\u79DF\u623F\uFF0C\u5269\u4E0B\u4E94\u767E\u7559\u7ED9\u53D1\u4E1D\u6297\u4E89",
        value: "",
        x: 28.44,
        y: 40.5,
        width: 55.11,
        height: 6.33,
        align: "left",
        fontSize: 26,
        color: "#1e293b",
        tagBgColor: "#ef4444",
        tagTextColor: "#ffffff",
        locked: true
      },
      {
        id: "slot-2",
        label: "\u9876\u7EA7",
        placeholder: "\u4F8B\u5982\uFF1A\u628A\u751F\u6D3B\u8FC7\u6210\u7701\u94B1\u6E38\u620F\uFF0C\u5168\u7F51\u641C\u5238\u53EA\u4E3A\u4F18\u60E0\u4E24\u5757\u94B1",
        value: "",
        x: 28.44,
        y: 49.17,
        width: 55.11,
        height: 6.33,
        align: "left",
        fontSize: 26,
        color: "#1e293b",
        tagBgColor: "#f97316",
        tagTextColor: "#ffffff",
        locked: true
      },
      {
        id: "slot-3",
        label: "\u4EBA\u4E0A\u4EBA",
        placeholder: "\u4F8B\u5982\uFF1A\u4E0B\u73ED\u81EA\u7531\u5206\u914D\u65F6\u95F4\uFF0C\u5076\u5C14\u4E70\u675F\u9C9C\u82B1\u5956\u52B1\u81EA\u5DF1",
        value: "",
        x: 28.44,
        y: 58.07,
        width: 55.11,
        height: 5.87,
        align: "left",
        fontSize: 26,
        color: "#1e293b",
        tagBgColor: "#eab308",
        tagTextColor: "#ffffff",
        locked: true
      },
      {
        id: "slot-4",
        label: "NPC",
        placeholder: "\u4F8B\u5982\uFF1A\u65E9\u516B\u665A\u516D\u6309\u65F6\u4E0A\u73ED\uFF0C\u65E2\u4E0D\u4E0A\u8FDB\u4E5F\u4E0D\u6446\u70C2",
        value: "",
        x: 28.44,
        y: 67,
        width: 55.11,
        height: 5.33,
        align: "left",
        fontSize: 26,
        color: "#1e293b",
        tagBgColor: "#facc15",
        tagTextColor: "#1e293b",
        locked: true
      },
      {
        id: "slot-5",
        label: "\u62C9\u5B8C\u4E86",
        placeholder: "\u4F8B\u5982\uFF1A\u4EE3\u7801\u8DD1\u5D29\u9879\u76EE\u5EF6\u671F\uFF0C\u5496\u5561\u52A0\u6D53\u4E5F\u6551\u4E0D\u4E86\u9ED1\u773C\u5708",
        value: "",
        x: 28.44,
        y: 75.5,
        width: 55.11,
        height: 6.33,
        align: "left",
        fontSize: 26,
        color: "#1e293b",
        tagBgColor: "#38bdf8",
        tagTextColor: "#ffffff",
        locked: true
      },
      {
        id: "slot-reviewer",
        label: "\u9510\u8BC4\u4EBA\uFF1A@",
        placeholder: "\u6DF1\u591C\u6253\u5DE5\u4EBA\u963F\u5F3A",
        value: "",
        x: 48.89,
        y: 84,
        width: 22.22,
        height: 2.67,
        align: "left",
        fontSize: 24,
        color: "#fdd937",
        tagBgColor: "#2563eb",
        tagTextColor: "#ffffff",
        fontWeight: "bold",
        locked: true
      }
    ]
  }
];

// api/_storage.ts
import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
var KEY_PREFIX = "zhihu-poster:";
var REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
var redisEnabled = !!(REDIS_URL && REDIS_TOKEN);
var redis = null;
function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: REDIS_URL,
      token: REDIS_TOKEN
    });
  }
  return redis;
}
var DATA_DIR = path.join(process.cwd(), "data_storage");
async function readJson(name, fallback) {
  if (redisEnabled) {
    try {
      const raw = await getRedis().get(KEY_PREFIX + name);
      if (raw !== null && raw !== void 0) {
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    } catch (err) {
      console.error(`[storage] Redis \u8BFB\u53D6 ${name} \u5931\u8D25:`, err);
    }
    return fallback;
  }
  try {
    const filePath = path.join(DATA_DIR, `${name}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (err) {
    console.error(`[storage] \u8BFB\u53D6 ${name}.json \u5931\u8D25:`, err);
  }
  return fallback;
}
async function writeJson(name, data) {
  if (redisEnabled) {
    try {
      await getRedis().set(KEY_PREFIX + name, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`[storage] Redis \u5199\u5165 ${name} \u5931\u8D25:`, err);
    }
    return;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[storage] \u5199\u5165 ${name}.json \u5931\u8D25:`, err);
  }
}
function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}
async function readRaw(name, fallback = null) {
  if (redisEnabled) {
    try {
      const raw = await getRedis().get(KEY_PREFIX + name);
      if (typeof raw === "string" && raw.length > 0) {
        return raw;
      }
    } catch (err) {
      console.error(`[storage] Redis \u8BFB\u53D6 ${name} \u5931\u8D25:`, err);
    }
    return fallback;
  }
  try {
    const filePath = path.join(DATA_DIR, `${sanitize(name)}.raw`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch (err) {
    console.error(`[storage] \u8BFB\u53D6 ${name}.raw \u5931\u8D25:`, err);
  }
  return fallback;
}
async function writeRaw(name, value) {
  if (redisEnabled) {
    try {
      await getRedis().set(KEY_PREFIX + name, value);
    } catch (err) {
      console.error(`[storage] Redis \u5199\u5165 ${name} \u5931\u8D25:`, err);
    }
    return;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(DATA_DIR, `${sanitize(name)}.raw`), value, "utf-8");
  } catch (err) {
    console.error(`[storage] \u5199\u5165 ${name}.raw \u5931\u8D25:`, err);
  }
}
async function deleteRaw(name) {
  if (redisEnabled) {
    try {
      await getRedis().del(KEY_PREFIX + name);
    } catch (err) {
      console.error(`[storage] Redis \u5220\u9664 ${name} \u5931\u8D25:`, err);
    }
    return;
  }
  try {
    const filePath = path.join(DATA_DIR, `${sanitize(name)}.raw`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[storage] \u5220\u9664 ${name}.raw \u5931\u8D25:`, err);
  }
}
async function mgetRaw(names) {
  const result = {};
  if (names.length === 0) {
    return result;
  }
  if (redisEnabled) {
    try {
      const values = await getRedis().mget(...names.map((n) => KEY_PREFIX + n));
      names.forEach((n, i) => {
        const v = values[i];
        result[n] = typeof v === "string" ? v : null;
      });
    } catch (err) {
      console.error("[storage] Redis mget \u5931\u8D25:", err);
      names.forEach((n) => {
        result[n] = null;
      });
    }
    return result;
  }
  for (const n of names) {
    result[n] = await readRaw(n);
  }
  return result;
}

// api/_app.ts
var MAX_UPLOAD_OPTIONS_PER_TEMPLATE = 10;
var MAX_IMAGE_DATAURL_LENGTH = 400 * 1024;
var SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
var imageKey = (templateId, optionId) => `image:${templateId}:${optionId}`;
async function readBuiltinOverrides() {
  return readJson("builtin_overrides", { hiddenIds: [], deletedIds: [] });
}
async function readTemplateOrder() {
  const data = await readJson("template_order", { order: [] });
  return Array.isArray(data.order) ? data.order : [];
}
function defaultAdmins() {
  return [
    {
      username: "zhangxiyu",
      passwordHash: "123456",
      role: "super_admin",
      permissions: { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      username: "admin",
      passwordHash: "admin123",
      role: "admin",
      permissions: { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  ];
}
async function ensureSeedAdmins() {
  let admins = await readJson("admins", []);
  if (!Array.isArray(admins) || admins.length === 0) {
    await writeJson("admins", defaultAdmins());
    return;
  }
  const normalized = admins.map((a) => {
    const isZhang = a.username.trim().toLowerCase() === "zhangxiyu";
    return {
      ...a,
      role: isZhang ? "super_admin" : a.role || "admin",
      permissions: isZhang ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, allowedTemplateIds: a.permissions?.allowedTemplateIds || [] } : a.permissions || { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false }
    };
  });
  if (!normalized.some((a) => a.username.trim().toLowerCase() === "zhangxiyu")) {
    normalized.unshift({
      username: "zhangxiyu",
      passwordHash: "123456",
      role: "super_admin",
      permissions: { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  if (JSON.stringify(normalized) !== JSON.stringify(admins)) {
    await writeJson("admins", normalized);
  }
}
async function getAdmins() {
  return readJson("admins", []);
}
var TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
var warnedNoSecret = false;
function getTokenSecret() {
  const fromEnv = process.env.ADMIN_TOKEN_SECRET;
  if (fromEnv) return fromEnv;
  if (!warnedNoSecret) {
    warnedNoSecret = true;
    console.warn("[auth] ADMIN_TOKEN_SECRET \u672A\u8BBE\u7F6E\uFF0C\u4F7F\u7528\u8FDB\u7A0B\u7EA7\u968F\u673A\u5BC6\u94A5\uFF08\u91CD\u542F\u540E\u6240\u6709\u767B\u5F55\u4EE4\u724C\u5931\u6548\uFF09");
  }
  return getTokenSecret.tmpSecret ||= crypto.randomBytes(32).toString("hex");
}
function signToken(username) {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${username}:${exp}`;
  const sig = crypto.createHmac("sha256", getTokenSecret()).update(payload).digest("hex");
  return `${sig}.${exp}.${Buffer.from(username, "utf-8").toString("base64url")}`;
}
function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [sig, expRaw, nameB64] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  let username;
  try {
    username = Buffer.from(nameB64, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  const expected = crypto.createHmac("sha256", getTokenSecret()).update(`${username}:${exp}`).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return username;
}
function extractToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return req.body && typeof req.body.token === "string" && req.body.token || null;
}
function requireAuth() {
  return (req, res, next) => {
    const token = extractToken(req);
    const username = token ? verifyToken(token) : null;
    if (!username) {
      return res.status(401).json({ error: "\u8BF7\u5148\u767B\u5F55\u540E\u518D\u64CD\u4F5C" });
    }
    req.adminUsername = username;
    next();
  };
}
function requireSuperAdmin() {
  return async (req, res, next) => {
    const username = req.adminUsername;
    const admins = await getAdmins();
    const found = admins.find((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase());
    const isSuper = username.trim().toLowerCase() === "zhangxiyu" || found?.role === "super_admin";
    if (!isSuper) {
      return res.status(403).json({ error: "\u53EA\u6709\u8D85\u7EA7\u7BA1\u7406\u5458\u53EF\u4EE5\u6267\u884C\u6B64\u64CD\u4F5C" });
    }
    next();
  };
}
function ah(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
function sanitizeAdmin(a) {
  const isSuper = a.username.trim().toLowerCase() === "zhangxiyu" || a.role === "super_admin";
  return {
    username: a.username,
    role: isSuper ? "super_admin" : a.role || "admin",
    permissions: isSuper ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, allowedTemplateIds: a.permissions?.allowedTemplateIds || [] } : {
      canEditOthers: a.permissions?.canEditOthers ?? false,
      canPublishOthers: a.permissions?.canPublishOthers ?? false,
      canDeleteOthers: a.permissions?.canDeleteOthers ?? false,
      allowedTemplateIds: a.permissions?.allowedTemplateIds || []
    },
    createdAt: a.createdAt || (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function createApp() {
  const app = express();
  await ensureSeedAdmins();
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));
  app.post("/api/admin/login", ah(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "\u8BF7\u8F93\u5165\u7528\u6237\u540D/\u90AE\u7BB1\u4E0E\u5BC6\u7801" });
    }
    const admins = await getAdmins();
    const found = admins.find(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase() && a.passwordHash === password
    );
    if (!found) {
      return res.status(401).json({ error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5" });
    }
    const sanitized = sanitizeAdmin(found);
    const token = signToken(found.username);
    return res.json({
      success: true,
      token,
      admin: sanitized,
      message: "\u767B\u5F55\u6210\u529F"
    });
  }));
  app.post("/api/admin/register", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "\u7528\u6237\u540D\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: "\u5BC6\u7801\u957F\u5EA6\u81F3\u5C11\u4E3A 4 \u4F4D" });
    }
    const admins = await getAdmins();
    const exists = admins.some((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase());
    if (exists) {
      return res.status(400).json({ error: "\u8BE5\u7BA1\u7406\u5458\u8D26\u53F7\u5DF2\u5B58\u5728\uFF0C\u8BF7\u76F4\u63A5\u767B\u5F55" });
    }
    const newAdmin = {
      username: username.trim(),
      passwordHash: password,
      role: "admin",
      permissions: { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, allowedTemplateIds: [] },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    admins.push(newAdmin);
    await writeJson("admins", admins);
    return res.json({
      success: true,
      token: signToken(newAdmin.username),
      admin: sanitizeAdmin(newAdmin),
      message: "\u7BA1\u7406\u5458\u8D26\u53F7\u6CE8\u518C\u6210\u529F\uFF01"
    });
  }));
  app.get("/api/admin/users", requireAuth(), ah(async (_req, res) => {
    const admins = await getAdmins();
    return res.json({ success: true, users: admins.map(sanitizeAdmin) });
  }));
  app.post("/api/admin/users/update-role", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { targetUsername, role, permissions } = req.body;
    if (!targetUsername) {
      return res.status(400).json({ error: "\u76EE\u6807\u7BA1\u7406\u5458\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const admins = await getAdmins();
    const targetIdx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === targetUsername.trim().toLowerCase()
    );
    if (targetIdx < 0) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u6307\u5B9A\u7BA1\u7406\u5458\u8D26\u53F7" });
    }
    const isZhangxiyu = targetUsername.trim().toLowerCase() === "zhangxiyu";
    const finalRole = isZhangxiyu ? "super_admin" : role || "admin";
    const existingPerms = admins[targetIdx].permissions || {
      canEditOthers: false,
      canPublishOthers: false,
      canDeleteOthers: false,
      allowedTemplateIds: []
    };
    const finalPermissions = finalRole === "super_admin" ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, allowedTemplateIds: existingPerms.allowedTemplateIds || [] } : finalRole === "senior_admin" ? {
      canEditOthers: permissions?.canEditOthers ?? true,
      canPublishOthers: permissions?.canPublishOthers ?? true,
      canDeleteOthers: permissions?.canDeleteOthers ?? true,
      allowedTemplateIds: permissions?.allowedTemplateIds !== void 0 ? permissions.allowedTemplateIds : existingPerms.allowedTemplateIds || []
    } : {
      canEditOthers: permissions?.canEditOthers ?? false,
      canPublishOthers: permissions?.canPublishOthers ?? false,
      canDeleteOthers: permissions?.canDeleteOthers ?? false,
      allowedTemplateIds: permissions?.allowedTemplateIds !== void 0 ? permissions.allowedTemplateIds : existingPerms.allowedTemplateIds || []
    };
    admins[targetIdx] = { ...admins[targetIdx], role: finalRole, permissions: finalPermissions };
    await writeJson("admins", admins);
    return res.json({
      success: true,
      message: `\u5DF2\u6210\u529F\u66F4\u65B0\u7BA1\u7406\u5458\u300C${targetUsername}\u300D\u7684\u6743\u9650\u914D\u7F6E\uFF01`,
      users: admins.map(sanitizeAdmin)
    });
  }));
  app.post("/api/admin/users/assign-templates", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { targetUsername, templateIds } = req.body;
    if (!targetUsername) {
      return res.status(400).json({ error: "\u76EE\u6807\u7BA1\u7406\u5458\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const admins = await getAdmins();
    const targetIdx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === targetUsername.trim().toLowerCase()
    );
    if (targetIdx < 0) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u6307\u5B9A\u7BA1\u7406\u5458\u8D26\u53F7" });
    }
    const currentPerms = admins[targetIdx].permissions || {
      canEditOthers: false,
      canPublishOthers: false,
      canDeleteOthers: false,
      allowedTemplateIds: []
    };
    admins[targetIdx].permissions = {
      ...currentPerms,
      allowedTemplateIds: Array.isArray(templateIds) ? templateIds : []
    };
    await writeJson("admins", admins);
    return res.json({
      success: true,
      message: `\u5DF2\u6210\u529F\u4E3A\u300C${targetUsername}\u300D\u5206\u914D ${Array.isArray(templateIds) ? templateIds.length : 0} \u4E2A\u6307\u5B9A\u6A21\u677F\u6743\u9650\uFF01`,
      users: admins.map(sanitizeAdmin)
    });
  }));
  app.post("/api/admin/users/create", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "\u7528\u6237\u540D\u4E0E\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const admins = await getAdmins();
    if (admins.some((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase())) {
      return res.status(400).json({ error: "\u8BE5\u7BA1\u7406\u5458\u8D26\u53F7\u5DF2\u5B58\u5728" });
    }
    const targetRole = role || "admin";
    const newAdmin = {
      username: username.trim(),
      passwordHash: password,
      role: targetRole,
      permissions: targetRole === "senior_admin" ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true } : { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    admins.push(newAdmin);
    await writeJson("admins", admins);
    return res.json({
      success: true,
      message: `\u5DF2\u6210\u529F\u521B\u5EFA\u65B0\u7BA1\u7406\u5458\u300C${username}\u300D\uFF01`,
      users: admins.map(sanitizeAdmin)
    });
  }));
  app.delete("/api/admin/users/:username", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username } = req.params;
    if (!username) {
      return res.status(400).json({ error: "\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    if (username.trim().toLowerCase() === "zhangxiyu") {
      return res.status(403).json({ error: "\u8D85\u7EA7\u7BA1\u7406\u5458 zhangxiyu \u65E0\u6CD5\u88AB\u5220\u9664" });
    }
    let admins = await getAdmins();
    const beforeLen = admins.length;
    admins = admins.filter((a) => a.username.trim().toLowerCase() !== username.trim().toLowerCase());
    if (admins.length === beforeLen) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u6307\u5B9A\u7BA1\u7406\u5458" });
    }
    await writeJson("admins", admins);
    return res.json({ success: true, message: "\u7BA1\u7406\u5458\u8D26\u53F7\u5DF2\u5220\u9664", users: admins.map(sanitizeAdmin) });
  }));
  app.get("/api/templates", ah(async (_req, res) => {
    const templates = await readJson("diy_templates", []);
    const overrides = await readBuiltinOverrides();
    const order = await readTemplateOrder();
    res.json({ success: true, templates, overrides, order });
  }));
  app.post("/api/template-order", requireAuth(), ah(async (req, res) => {
    const { order } = req.body || {};
    if (!Array.isArray(order) || order.some((id) => typeof id !== "string")) {
      return res.status(400).json({ error: "\u6392\u5E8F\u6570\u636E\u683C\u5F0F\u4E0D\u6B63\u786E" });
    }
    await writeJson("template_order", { order });
    return res.json({ success: true, order, message: "\u6A21\u677F\u6392\u5E8F\u5DF2\u4FDD\u5B58" });
  }));
  app.post("/api/templates/builtin-state", requireAuth(), ah(async (req, res) => {
    const { id, hidden, deleted } = req.body || {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "\u6A21\u677F ID \u4E0D\u80FD\u4E3A\u7A7A" });
    }
    if (!BUILTIN_TEMPLATES.some((b) => b.id === id)) {
      return res.status(400).json({ error: "\u8BE5\u6A21\u677F\u4E0D\u662F\u5185\u7F6E\u6A21\u677F\uFF0C\u8BF7\u901A\u8FC7\u6A21\u677F\u5E93\u5E38\u89C4\u6D41\u7A0B\u5220\u9664\u6216\u4E0B\u67B6\u3002" });
    }
    const overrides = await readBuiltinOverrides();
    const diyTemplates = await readJson("diy_templates", []);
    if (deleted === true) {
      const remaining = BUILTIN_TEMPLATES.filter((b) => b.id !== id && !overrides.deletedIds.includes(b.id)).length + diyTemplates.length;
      if (remaining < 1) {
        return res.status(400).json({
          error: "\u6A21\u677F\u5E93\u4EC5\u5269\u6700\u540E\u4E00\u4E2A\u6A21\u677F\uFF0C\u65E0\u6CD5\u5220\u9664\u3002\u8BF7\u5148\u521B\u5EFA\u6216\u53D1\u5E03\u5176\u4ED6\u6A21\u677F\u540E\u518D\u64CD\u4F5C\u3002"
        });
      }
      if (!overrides.deletedIds.includes(id)) {
        overrides.deletedIds.push(id);
      }
      overrides.hiddenIds = overrides.hiddenIds.filter((h) => h !== id);
    } else if (hidden !== void 0) {
      const publishedBuiltins = BUILTIN_TEMPLATES.filter(
        (b) => !overrides.hiddenIds.includes(b.id) && !overrides.deletedIds.includes(b.id) && b.isPublished !== false
      );
      const publishedDiy = diyTemplates.filter((t) => t.isPublished !== false).length;
      const remainingPublished = publishedBuiltins.filter((b) => b.id !== id).length + publishedDiy;
      if (hidden === true && remainingPublished < 1) {
        return res.status(400).json({
          error: "\u6A21\u677F\u5E93\u4E2D\u4EC5\u5269\u6700\u540E\u4E00\u4E2A\u5DF2\u53D1\u5E03\u6A21\u677F\uFF0C\u65E0\u6CD5\u4E0B\u67B6\u3002\u8BF7\u5148\u53D1\u5E03\u5176\u4ED6\u6A21\u677F\u540E\u518D\u64CD\u4F5C\u3002"
        });
      }
      if (hidden === true) {
        if (!overrides.hiddenIds.includes(id)) {
          overrides.hiddenIds.push(id);
        }
      } else {
        overrides.hiddenIds = overrides.hiddenIds.filter((h) => h !== id);
      }
    }
    await writeJson("builtin_overrides", overrides);
    return res.json({ success: true, overrides });
  }));
  app.post("/api/templates", requireAuth(), ah(async (req, res) => {
    const newTemplate = req.body;
    if (!newTemplate || !newTemplate.name) {
      return res.status(400).json({ error: "\u6A21\u677F\u6570\u636E\u4E0D\u5B8C\u6574\uFF0C\u7F3A\u5C11\u6A21\u677F\u540D\u79F0" });
    }
    const rawOptions = Array.isArray(newTemplate.imageOptions) ? newTemplate.imageOptions : [];
    const uploadCount = rawOptions.filter((o) => o && o.source === "upload").length;
    if (uploadCount > MAX_UPLOAD_OPTIONS_PER_TEMPLATE) {
      return res.status(400).json({
        error: `\u4E0A\u4F20\u578B\u56FE\u7247\u9009\u9879\u6700\u591A ${MAX_UPLOAD_OPTIONS_PER_TEMPLATE} \u5F20\uFF0C\u5F53\u524D ${uploadCount} \u5F20`
      });
    }
    const imageOptions = rawOptions.filter((o) => o && typeof o.id === "string").map((o) => {
      const clean = {
        id: o.id,
        label: typeof o.label === "string" ? o.label : "\u56FE\u7247",
        source: o.source === "url" ? "url" : "upload"
      };
      if (clean.source === "url" && typeof o.url === "string") {
        clean.url = o.url;
      }
      return clean;
    });
    const templates = await readJson("diy_templates", []);
    const templateId = newTemplate.id || `diy-template-${Date.now()}`;
    const prepared = {
      ...newTemplate,
      imageOptions,
      id: templateId,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdAt: newTemplate.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    };
    const existingIndex = templates.findIndex((t) => t.id === templateId);
    if (existingIndex >= 0) {
      templates[existingIndex] = prepared;
    } else {
      templates.unshift(prepared);
    }
    await writeJson("diy_templates", templates);
    return res.json({ success: true, template: prepared, message: "\u6A21\u677F\u5DF2\u4FDD\u5B58\u6210\u529F\uFF01" });
  }));
  app.delete("/api/templates/:id", requireAuth(), ah(async (req, res) => {
    const { id } = req.params;
    let templates = await readJson("diy_templates", []);
    const target = templates.find((t) => t.id === id);
    const beforeLen = templates.length;
    templates = templates.filter((t) => t.id !== id);
    if (templates.length === beforeLen) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u5BF9\u5E94\u6A21\u677F\u6216\u65E0\u6CD5\u5220\u9664" });
    }
    await writeJson("diy_templates", templates);
    const uploadIds = Array.isArray(target?.imageOptions) ? target.imageOptions.filter((o) => o && o.source === "upload" && typeof o.id === "string").map((o) => o.id) : [];
    for (const optionId of uploadIds) {
      if (SAFE_ID_RE.test(optionId)) {
        await deleteRaw(imageKey(id, optionId));
      }
    }
    return res.json({ success: true, message: "\u6A21\u677F\u5DF2\u6210\u529F\u5220\u9664" });
  }));
  app.get("/api/templates/:id/images", ah(async (req, res) => {
    const { id } = req.params;
    if (!SAFE_ID_RE.test(id)) {
      return res.status(400).json({ error: "\u975E\u6CD5\u6A21\u677F ID" });
    }
    const diyTemplates = await readJson("diy_templates", []);
    const tpl = diyTemplates.find((t) => t.id === id) || BUILTIN_TEMPLATES.find((t) => t.id === id);
    if (!tpl) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u5BF9\u5E94\u6A21\u677F" });
    }
    const uploadOptions = (Array.isArray(tpl.imageOptions) ? tpl.imageOptions : []).filter((o) => o && o.source === "upload" && typeof o.id === "string");
    const keys = uploadOptions.map((o) => imageKey(id, o.id));
    const rawMap = await mgetRaw(keys);
    const images = {};
    for (const optionId of uploadOptions.map((o) => o.id)) {
      const v = rawMap[imageKey(id, optionId)];
      if (typeof v === "string") {
        images[optionId] = v;
      }
    }
    return res.json({ success: true, images });
  }));
  app.post("/api/templates/:id/images", requireAuth(), ah(async (req, res) => {
    const { id } = req.params;
    if (!SAFE_ID_RE.test(id)) {
      return res.status(400).json({ error: "\u975E\u6CD5\u6A21\u677F ID" });
    }
    const templates = await readJson("diy_templates", []);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u5BF9\u5E94\u6A21\u677F\uFF08\u4EC5\u81EA\u5B9A\u4E49\u6A21\u677F\u652F\u6301\u56FE\u7247\u4E0A\u4F20\uFF09" });
    }
    const uploadIds = new Set(
      (Array.isArray(tpl.imageOptions) ? tpl.imageOptions : []).filter((o) => o && o.source === "upload" && typeof o.id === "string").map((o) => o.id)
    );
    const images = req.body && typeof req.body.images === "object" && req.body.images !== null ? req.body.images : {};
    const deleteIds = Array.isArray(req.body?.deleteIds) ? req.body.deleteIds : [];
    let saved = 0;
    const errors = [];
    for (const [optionId, dataUrl] of Object.entries(images)) {
      if (!SAFE_ID_RE.test(optionId)) {
        errors.push(`\u975E\u6CD5\u9009\u9879 ID: ${optionId}`);
        continue;
      }
      if (!uploadIds.has(optionId)) {
        errors.push(`\u9009\u9879 ${optionId} \u4E0D\u5C5E\u4E8E\u8BE5\u6A21\u677F`);
        continue;
      }
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/") || dataUrl.length > MAX_IMAGE_DATAURL_LENGTH) {
        errors.push(`\u9009\u9879 ${optionId} \u56FE\u7247\u6570\u636E\u65E0\u6548\u6216\u8D85\u8FC7 ${Math.round(MAX_IMAGE_DATAURL_LENGTH / 1024)}KB \u9650\u5236`);
        continue;
      }
      await writeRaw(imageKey(id, optionId), dataUrl);
      saved++;
    }
    let removed = 0;
    for (const optionId of deleteIds) {
      if (typeof optionId !== "string" || !SAFE_ID_RE.test(optionId)) continue;
      await deleteRaw(imageKey(id, optionId));
      removed++;
    }
    return res.json({ success: true, saved, removed, errors });
  }));
  app.post("/api/templates/assign-editors", requireAuth(), ah(async (req, res) => {
    const { templateId, allowedEditors } = req.body;
    if (!templateId) {
      return res.status(400).json({ error: "templateId \u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const templates = await readJson("diy_templates", []);
    const idx = templates.findIndex((t) => t.id === templateId);
    if (idx < 0) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u6307\u5B9A\u6A21\u677F" });
    }
    templates[idx] = {
      ...templates[idx],
      allowedEditors: Array.isArray(allowedEditors) ? allowedEditors : [],
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await writeJson("diy_templates", templates);
    return res.json({
      success: true,
      message: `\u5DF2\u66F4\u65B0\u6A21\u677F\u300C${templates[idx].name}\u300D\u7684\u6307\u5B9A\u6388\u6743\u7BA1\u7406\u5458\u5217\u8868\uFF01`,
      template: templates[idx],
      templates
    });
  }));
  app.post("/api/generate-review", ah(async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: "\u8BF7\u5148\u914D\u7F6E GEMINI_API_KEY \u73AF\u5883\u53D8\u91CF\u5373\u53EF\u5F00\u542F AI \u4E00\u952E\u751F\u6210\u6C11\u95F4\u9510\u8BC4\uFF01"
        });
      }
      const { keyword, slots } = req.body;
      const slotContext = slots && Array.isArray(slots) ? slots.map((s) => `\u3010${s.label}\u3011`).join("\u3001") : "\u3010\u592F\u3011\u3001\u3010\u9876\u7EA7\u3011\u3001\u3010\u4EBA\u4E0A\u4EBA\u3011\u3001\u3010NPC\u3011\u3001\u3010\u62C9\u5B8C\u4E86\u3011\u3001\u3010\u9510\u8BC4\u4EBA\u3011";
      const prompt = `\u4F60\u662F\u4E00\u4E2A\u4E92\u8054\u7F51\u795E\u603B\u7ED3\u5634\u66FF\u3001\u6BD2\u820C\u4F46\u7CBE\u51C6\u7684\u201C\u6C11\u95F4\u9510\u8BC4\u4EBA\u201D\u3002
\u8BF7\u9488\u5BF9\u5173\u952E\u8BCD/\u4E3B\u9898\uFF1A\u201C${keyword || "\u70ED\u8BAE\u8BDD\u9898"}\u201D\uFF0C\u4E3A\u4EE5\u4E0B\u680F\u76EE\u751F\u6210\u641E\u7B11\u3001\u63A5\u5730\u6C14\u3001\u6897\u5473\u5341\u8DB3\u7684\u7CBE\u70BC\u8BC4\u8BED\uFF1A
\u9700\u8981\u586B\u5145\u7684\u680F\u76EE\u5217\u8868\uFF1A${slotContext}

\u8981\u6C42\uFF1A
1. \u6BCF\u6761\u8BC4\u8BED 15-30 \u5B57\u4EE5\u5185\uFF0C\u5E7D\u9ED8\u5438\u775B\u3001\u76F4\u51FB\u8981\u5BB3\uFF0C\u7B26\u5408\u7F51\u6C11\u5403\u74DC\u53E3\u543B\u3002
2. \u6700\u540E\u4E00\u680F\u662F\u201C\u9510\u8BC4\u4EBA\u201D\u8D26\u53F7\u540D\u79F0\u6216\u5934\u8854\uFF08\u4F8B\u5982\uFF1A@\u4E92\u8054\u7F51\u62BD\u8C61\u827A\u672F\u5BB6\u3001@\u5403\u74DC\u7B2C\u4E00\u7EBF\u3001@\u62BD\u8C61\u5927\u5E1D\uFF09\u3002
3. \u5FC5\u987B\u8F93\u51FA\u5408\u6CD5 JSON \u683C\u5F0F\uFF0C\u4F8B\u5982\u5BF9\u5E94\u6BCF\u4E2A\u69FD\u4F4D id \u7684\u952E\u503C\u5BF9\u6620\u5C04\u3002`;
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const text = response.text || "";
      const data = JSON.parse(text);
      return res.json({ success: true, data });
    } catch (err) {
      console.error("Gemini API Error:", err);
      const message = err instanceof Error ? err.message : "AI \u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5";
      return res.status(500).json({ error: message });
    }
  }));
  app.use((err, _req, res, _next) => {
    console.error("[api] Unhandled error:", err);
    return res.status(500).json({ error: "\u670D\u52A1\u5668\u5F00\u5C0F\u5DEE\u4E86\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" });
  });
  return app;
}

// api/_handler.ts
var appPromise = createApp();
function handler(req, res) {
  return appPromise.then((app) => app(req, res));
}
export {
  handler as default
};
