// api/_app.ts
import crypto from "crypto";
import zlib from "zlib";
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
    await getRedis().set(KEY_PREFIX + name, JSON.stringify(data, null, 2));
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
    await getRedis().set(KEY_PREFIX + name, value);
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
var bgKey = (templateId) => `bg:${templateId}`;
var MAX_BG_DATAURL_LENGTH = 6 * 1024 * 1024;
async function stripTemplateBackground(tpl, overwrite) {
  if (!tpl || typeof tpl.bgImageUrl !== "string" || !tpl.bgImageUrl.startsWith("data:image/")) {
    return tpl;
  }
  const dataUrl = tpl.bgImageUrl;
  const id = String(tpl.id || "");
  if (SAFE_ID_RE.test(id) && dataUrl.length <= MAX_BG_DATAURL_LENGTH) {
    if (overwrite || await readRaw(bgKey(id)) === null) {
      await writeRaw(bgKey(id), dataUrl);
    }
  }
  return { ...tpl, bgImageUrl: "" };
}
async function readBuiltinOverrides() {
  return readJson("builtin_overrides", { hiddenIds: [], deletedIds: [] });
}
async function readTemplateOrder() {
  const data = await readJson("template_order", { order: [] });
  return Array.isArray(data.order) ? data.order : [];
}
function initialAdminPassword() {
  const fromEnv = process.env.ADMIN_INITIAL_PASSWORD;
  if (fromEnv && fromEnv.trim().length >= 6) {
    return fromEnv.trim();
  }
  const random = crypto.randomBytes(9).toString("base64url");
  console.log(`[admin] \u672A\u914D\u7F6E ADMIN_INITIAL_PASSWORD \u73AF\u5883\u53D8\u91CF\uFF0C\u672C\u6B21 admin \u521D\u59CB\u5BC6\u7801\u4E3A\uFF1A${random}`);
  return random;
}
function defaultAdmins() {
  return [
    {
      username: "zhangxiyu",
      passwordHash: hashPassword("123456"),
      role: "super_admin",
      permissions: { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      pv: 0
    },
    {
      username: "admin",
      passwordHash: hashPassword(initialAdminPassword()),
      role: "admin",
      permissions: { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, canPublish: false },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      pv: 0
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
      permissions: isZhang ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true, allowedTemplateIds: a.permissions?.allowedTemplateIds || [] } : a.permissions || { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, canPublish: false }
    };
  });
  if (!normalized.some((a) => a.username.trim().toLowerCase() === "zhangxiyu")) {
    normalized.unshift({
      username: "zhangxiyu",
      passwordHash: hashPassword("123456"),
      role: "super_admin",
      permissions: { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      pv: 0
    });
  }
  if (JSON.stringify(normalized) !== JSON.stringify(admins)) {
    await writeJson("admins", normalized);
  }
}
async function getAdmins() {
  return readJson("admins", []);
}
var SCRYPT_N = 16384;
var SCRYPT_R = 8;
var SCRYPT_P = 1;
var SCRYPT_KEYLEN = 64;
var PASSWORD_MIN = 6;
var PASSWORD_MAX = 64;
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString("hex");
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}
function verifyPassword(stored, input) {
  if (!stored || typeof stored !== "string") return { ok: false, legacy: false };
  const parts = stored.split("$");
  if (parts[0] !== "scrypt" || parts.length !== 6) {
    return { ok: stored === input, legacy: true };
  }
  const [, nRaw, rRaw, pRaw, salt, expectedHex] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return { ok: false, legacy: false };
  }
  try {
    const actual = crypto.scryptSync(input, salt, SCRYPT_KEYLEN, { N, r, p });
    const expected = Buffer.from(expectedHex, "hex");
    if (actual.length !== expected.length) return { ok: false, legacy: false };
    return { ok: crypto.timingSafeEqual(actual, expected), legacy: false };
  } catch {
    return { ok: false, legacy: false };
  }
}
function validateNewPassword(password) {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    return `\u5BC6\u7801\u957F\u5EA6\u81F3\u5C11\u4E3A ${PASSWORD_MIN} \u4F4D`;
  }
  if (password.length > PASSWORD_MAX) {
    return `\u5BC6\u7801\u957F\u5EA6\u4E0D\u80FD\u8D85\u8FC7 ${PASSWORD_MAX} \u4F4D`;
  }
  return null;
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
function signToken(username, pv) {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${username}:${exp}:${pv}`;
  const sig = crypto.createHmac("sha256", getTokenSecret()).update(payload).digest("hex");
  const nameB64 = Buffer.from(username, "utf-8").toString("base64url");
  return `${sig}.${exp}.${nameB64}.${pv}`;
}
function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 && parts.length !== 4) return null;
  const [sig, expRaw, nameB64, pvRaw] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  let username;
  try {
    username = Buffer.from(nameB64, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  const pv = pvRaw !== void 0 ? Number(pvRaw) : null;
  if (pv !== null && (!Number.isInteger(pv) || pv < 0)) return null;
  const payload = pv === null ? `${username}:${exp}` : `${username}:${exp}:${pv}`;
  const expected = crypto.createHmac("sha256", getTokenSecret()).update(payload).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return { username, pv };
}
function extractToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return req.body && typeof req.body.token === "string" && req.body.token || null;
}
function requireAuth() {
  return async (req, res, next) => {
    try {
      const token = extractToken(req);
      const claims = token ? verifyToken(token) : null;
      if (!claims) {
        console.log(
          `[auth] 401 \u62D2\u7EDD: ${req.method} ${req.path} | token: ${token ? `${String(token).slice(0, 16)}...` : "\u672A\u643A\u5E26"}`
        );
        return res.status(401).json({ error: "\u8BF7\u5148\u767B\u5F55\u540E\u518D\u64CD\u4F5C" });
      }
      const admins = await getAdmins();
      const found = admins.find(
        (a) => a.username.trim().toLowerCase() === claims.username.trim().toLowerCase()
      );
      if (!found) {
        return res.status(401).json({ error: "\u8D26\u53F7\u4E0D\u5B58\u5728\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" });
      }
      if (claims.pv !== null && claims.pv !== (found.pv ?? 0)) {
        return res.status(401).json({ error: "\u767B\u5F55\u72B6\u6001\u5DF2\u5931\u6548\uFF08\u5BC6\u7801\u5DF2\u4FEE\u6539\uFF09\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" });
      }
      req.adminUsername = found.username;
      req.admin = found;
      next();
    } catch (err) {
      next(err);
    }
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
function getTemplateAccess(user, tpl) {
  const name = user.username.trim().toLowerCase();
  const isSuper = name === "zhangxiyu" || user.role === "super_admin";
  const isSenior = user.role === "senior_admin";
  const owner = !tpl?.author || String(tpl.author).trim().toLowerCase() === name;
  const granted = (user.permissions?.allowedTemplateIds || []).includes(tpl?.id) || Array.isArray(tpl?.allowedEditors) && tpl.allowedEditors.some((u) => typeof u === "string" && u.trim().toLowerCase() === name);
  return {
    isSuper,
    // 编辑：超管/高级管理员/全局编辑他人权限/本人/被指定授权
    canEdit: isSuper || isSenior || user.permissions?.canEditOthers === true || owner || granted,
    // 上线/下架：超管/高级管理员/全局发布他人权限；本人或被指定授权的模板还需独立 canPublish 授权
    canPublish: isSuper || isSenior || user.permissions?.canPublishOthers === true || (owner || granted) && user.permissions?.canPublish === true,
    // 删除：超管/高级管理员/全局删除他人权限/本人（被指定授权不含删除，与前端一致）
    canDelete: isSuper || isSenior || user.permissions?.canDeleteOthers === true || owner
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
  app.use((req, res, next) => {
    const accept = String(req.headers["accept-encoding"] || "").toLowerCase();
    if (!accept.includes("gzip")) return next();
    const origJson = res.json.bind(res);
    res.json = ((body) => {
      const payload = Buffer.from(JSON.stringify(body), "utf-8");
      if (payload.length < 1024) {
        return origJson(body);
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Vary", "Accept-Encoding");
      zlib.gzip(payload, (err, buf) => {
        if (err) {
          res.removeHeader("Content-Encoding");
          res.end(payload);
        } else {
          res.end(buf);
        }
      });
      return res;
    });
    next();
  });
  app.post("/api/admin/login", ah(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "\u8BF7\u8F93\u5165\u7528\u6237\u540D/\u90AE\u7BB1\u4E0E\u5BC6\u7801" });
    }
    const admins = await getAdmins();
    const found = admins.find(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase()
    );
    const check = found ? verifyPassword(found.passwordHash, password) : { ok: false, legacy: false };
    if (!found || !check.ok) {
      return res.status(401).json({ error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5" });
    }
    if (check.legacy) {
      found.passwordHash = hashPassword(password);
      found.pv = 0;
      await writeJson("admins", admins);
    }
    const sanitized = sanitizeAdmin(found);
    const token = signToken(found.username, found.pv ?? 0);
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
    const invalidPwd = validateNewPassword(password);
    if (invalidPwd) {
      return res.status(400).json({ error: invalidPwd });
    }
    const admins = await getAdmins();
    const exists = admins.some((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase());
    if (exists) {
      return res.status(400).json({ error: "\u8BE5\u7BA1\u7406\u5458\u8D26\u53F7\u5DF2\u5B58\u5728\uFF0C\u8BF7\u76F4\u63A5\u767B\u5F55" });
    }
    const newAdmin = {
      username: username.trim(),
      passwordHash: hashPassword(password),
      role: "admin",
      permissions: { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, canPublish: false, allowedTemplateIds: [] },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      pv: 0
    };
    admins.push(newAdmin);
    await writeJson("admins", admins);
    return res.json({
      success: true,
      token: signToken(newAdmin.username, 0),
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
    const finalPermissions = finalRole === "super_admin" ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true, allowedTemplateIds: existingPerms.allowedTemplateIds || [] } : finalRole === "senior_admin" ? {
      canEditOthers: permissions?.canEditOthers ?? true,
      canPublishOthers: permissions?.canPublishOthers ?? true,
      canDeleteOthers: permissions?.canDeleteOthers ?? true,
      canPublish: permissions?.canPublish ?? true,
      allowedTemplateIds: permissions?.allowedTemplateIds !== void 0 ? permissions.allowedTemplateIds : existingPerms.allowedTemplateIds || []
    } : {
      canEditOthers: permissions?.canEditOthers ?? false,
      canPublishOthers: permissions?.canPublishOthers ?? false,
      canDeleteOthers: permissions?.canDeleteOthers ?? false,
      canPublish: permissions?.canPublish ?? false,
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
    const invalidPwd = validateNewPassword(password);
    if (invalidPwd) {
      return res.status(400).json({ error: invalidPwd });
    }
    const admins = await getAdmins();
    if (admins.some((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase())) {
      return res.status(400).json({ error: "\u8BE5\u7BA1\u7406\u5458\u8D26\u53F7\u5DF2\u5B58\u5728" });
    }
    const targetRole = role || "admin";
    const newAdmin = {
      username: username.trim(),
      passwordHash: hashPassword(password),
      role: targetRole,
      permissions: targetRole === "senior_admin" ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true } : { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, canPublish: false },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      pv: 0
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
  app.post("/api/admin/change-password", requireAuth(), ah(async (req, res) => {
    const username = req.adminUsername;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "\u8BF7\u8F93\u5165\u5F53\u524D\u5BC6\u7801\u4E0E\u65B0\u5BC6\u7801" });
    }
    const admins = await getAdmins();
    const idx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase()
    );
    if (idx < 0) {
      return res.status(401).json({ error: "\u8D26\u53F7\u4E0D\u5B58\u5728\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" });
    }
    const check = verifyPassword(admins[idx].passwordHash, oldPassword);
    if (!check.ok) {
      return res.status(400).json({ error: "\u5F53\u524D\u5BC6\u7801\u4E0D\u6B63\u786E" });
    }
    const invalidNew = validateNewPassword(newPassword);
    if (invalidNew) {
      return res.status(400).json({ error: invalidNew });
    }
    if (newPassword === oldPassword) {
      return res.status(400).json({ error: "\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E0E\u5F53\u524D\u5BC6\u7801\u76F8\u540C" });
    }
    admins[idx].passwordHash = hashPassword(newPassword);
    admins[idx].pv = (admins[idx].pv ?? 0) + 1;
    await writeJson("admins", admins);
    return res.json({ success: true, message: "\u5BC6\u7801\u4FEE\u6539\u6210\u529F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" });
  }));
  app.post("/api/admin/users/reset-password", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username, newPassword } = req.body;
    if (!username) {
      return res.status(400).json({ error: "\u76EE\u6807\u7BA1\u7406\u5458\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const invalidNew = validateNewPassword(newPassword);
    if (invalidNew) {
      return res.status(400).json({ error: invalidNew });
    }
    const admins = await getAdmins();
    const idx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase()
    );
    if (idx < 0) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u6307\u5B9A\u7BA1\u7406\u5458\u8D26\u53F7" });
    }
    admins[idx].passwordHash = hashPassword(newPassword);
    admins[idx].pv = (admins[idx].pv ?? 0) + 1;
    await writeJson("admins", admins);
    return res.json({ success: true, message: `\u5DF2\u91CD\u7F6E\u7BA1\u7406\u5458\u300C${admins[idx].username}\u300D\u7684\u5BC6\u7801` });
  }));
  app.post("/api/admin/users/reset-password-default", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "\u76EE\u6807\u7BA1\u7406\u5458\u7528\u6237\u540D\u4E0D\u80FD\u4E3A\u7A7A" });
    }
    const admins = await getAdmins();
    const idx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase()
    );
    if (idx < 0) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u6307\u5B9A\u7BA1\u7406\u5458\u8D26\u53F7" });
    }
    const newPwd = initialAdminPassword();
    admins[idx].passwordHash = hashPassword(newPwd);
    admins[idx].pv = (admins[idx].pv ?? 0) + 1;
    await writeJson("admins", admins);
    return res.json({
      success: true,
      message: `\u5DF2\u5C06\u7BA1\u7406\u5458\u300C${admins[idx].username}\u300D\u7684\u5BC6\u7801\u521D\u59CB\u5316\u4E3A\uFF1A${newPwd}`
    });
  }));
  app.get("/api/templates", ah(async (_req, res) => {
    const raw = await readJson("diy_templates", []);
    const templates = [];
    let migrated = false;
    for (const t of raw) {
      if (t && typeof t.bgImageUrl === "string" && t.bgImageUrl.startsWith("data:image/")) {
        templates.push(await stripTemplateBackground(t, false));
        migrated = true;
      } else {
        templates.push(t);
      }
    }
    if (migrated) {
      await writeJson("diy_templates", templates);
    }
    const overrides = await readBuiltinOverrides();
    const order = await readTemplateOrder();
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
    res.json({ success: true, templates, overrides, order });
  }));
  app.get("/api/templates/share/:id", ah(async (req, res) => {
    const { id } = req.params;
    const notFound = () => res.status(404).json({ success: false, message: "\u8BE5\u6A21\u677F\u672A\u4E0A\u7EBF\u6216\u4E0D\u5B58\u5728" });
    if (!SAFE_ID_RE.test(id)) return notFound();
    const diyTemplates = await readJson("diy_templates", []);
    let tpl = diyTemplates.find((t) => t.id === id);
    if (tpl) {
      if (tpl.isPublished === false) return notFound();
      tpl = await stripTemplateBackground(tpl, false);
    } else {
      const builtin = BUILTIN_TEMPLATES.find((t) => t.id === id);
      if (!builtin) return notFound();
      const overrides = await readBuiltinOverrides();
      if (builtin.isPublished === false || overrides.hiddenIds.includes(id) || overrides.deletedIds.includes(id)) {
        return notFound();
      }
      tpl = builtin;
    }
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
    return res.json({ success: true, template: tpl });
  }));
  app.post("/api/template-order", requireAuth(), ah(async (req, res) => {
    const { order } = req.body || {};
    if (!Array.isArray(order) || order.some((id) => typeof id !== "string")) {
      return res.status(400).json({ error: "\u6392\u5E8F\u6570\u636E\u683C\u5F0F\u4E0D\u6B63\u786E" });
    }
    await writeJson("template_order", { order });
    return res.json({ success: true, order, message: "\u6A21\u677F\u6392\u5E8F\u5DF2\u4FDD\u5B58" });
  }));
  app.post("/api/templates/builtin-state", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
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
    const existingIndex = templates.findIndex((t) => t.id === templateId);
    const existing = existingIndex >= 0 ? templates[existingIndex] : null;
    const me = req.admin;
    const prepared = {
      ...newTemplate,
      imageOptions,
      id: templateId,
      author: existing ? existing.author : me.username,
      allowedEditors: existing ? existing.allowedEditors : Array.isArray(newTemplate.allowedEditors) ? newTemplate.allowedEditors : [],
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdAt: newTemplate.createdAt || existing?.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    };
    const access = getTemplateAccess(me, prepared);
    if (!access.canEdit) {
      return res.status(403).json({ error: "\u65E0\u6743\u9650\u7F16\u8F91\u8BE5\u6A21\u677F\uFF08\u4EC5\u672C\u4EBA\u3001\u88AB\u6307\u5B9A\u6388\u6743\u6216\u5DF2\u5F00\u901A\u5168\u5C40\u7F16\u8F91\u6743\u9650\u7684\u7BA1\u7406\u5458\u53EF\u7F16\u8F91\uFF09" });
    }
    const payloadPublish = typeof newTemplate.isPublished === "boolean" ? newTemplate.isPublished : existing ? existing.isPublished !== false : false;
    const publishChanged = existing ? payloadPublish !== (existing.isPublished !== false) : payloadPublish === true;
    if (publishChanged && !access.canPublish) {
      return res.status(403).json({ error: "\u65E0\u4E0A\u7EBF\u6743\u9650\uFF1A\u4E0A\u7EBF/\u4E0B\u67B6\u6A21\u677F\u9700\u8D85\u7BA1\u5728\u6743\u9650\u914D\u7F6E\u4E2D\u5FC3\u6388\u4E88\u300C\u4E0A\u7EBF\u6A21\u677F\u300D\u6743\u9650" });
    }
    const cleaned = await stripTemplateBackground(prepared, true);
    if (prepared.bgType !== "image" && SAFE_ID_RE.test(templateId)) {
      await deleteRaw(bgKey(templateId));
    }
    if (existingIndex >= 0) {
      templates[existingIndex] = cleaned;
    } else {
      templates.unshift(cleaned);
    }
    await writeJson("diy_templates", templates);
    return res.json({ success: true, template: cleaned, message: "\u6A21\u677F\u5DF2\u4FDD\u5B58\u6210\u529F\uFF01" });
  }));
  app.delete("/api/templates/:id", requireAuth(), ah(async (req, res) => {
    const { id } = req.params;
    let templates = await readJson("diy_templates", []);
    const target = templates.find((t) => t.id === id);
    const me = req.admin;
    if (target && !getTemplateAccess(me, target).canDelete) {
      return res.status(403).json({ error: "\u65E0\u6743\u9650\u5220\u9664\u8BE5\u6A21\u677F\uFF08\u4EC5\u672C\u4EBA\u3001\u8D85\u7BA1\u6216\u5DF2\u5F00\u901A\u5168\u5C40\u5220\u9664\u6743\u9650\u7684\u7BA1\u7406\u5458\u53EF\u5220\u9664\uFF09" });
    }
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
    if (SAFE_ID_RE.test(id)) {
      await deleteRaw(bgKey(id));
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
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=300");
    return res.json({ success: true, images });
  }));
  app.get("/api/templates/:id/bg", ah(async (req, res) => {
    const { id } = req.params;
    if (!SAFE_ID_RE.test(id)) {
      return res.status(400).json({ error: "\u975E\u6CD5\u6A21\u677F ID" });
    }
    const diyTemplates = await readJson("diy_templates", []);
    const tpl = diyTemplates.find((t) => t.id === id) || BUILTIN_TEMPLATES.find((t) => t.id === id);
    if (!tpl) {
      return res.status(404).json({ error: "\u672A\u627E\u5230\u5BF9\u5E94\u6A21\u677F" });
    }
    const bg = await readRaw(bgKey(id));
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=300");
    return res.json({ success: true, bg });
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
    const me = req.admin;
    if (!getTemplateAccess(me, tpl).canEdit) {
      return res.status(403).json({ error: "\u65E0\u6743\u9650\u7F16\u8F91\u8BE5\u6A21\u677F\u7684\u56FE\u7247\u9009\u9879" });
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
  app.post("/api/templates/assign-editors", requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
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
