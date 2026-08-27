import crypto from 'crypto';
import zlib from 'zlib';
import express, { NextFunction, Request, Response } from 'express';
import { BUILTIN_TEMPLATES } from './_templates';
import { deleteRaw, mgetRaw, readJson, readRaw, writeJson, writeRaw } from './_storage';

// 共享的 Express 应用：所有 /api/* 路由。
// - 本地开发：server.ts 挂载 Vite 中间件后监听 3000 端口
// - 生产（Vercel）：api/index.ts 将其作为 Serverless 函数导出

interface BuiltinOverrides {
  hiddenIds: string[];
  deletedIds: string[];
}

// --- 图片选项存储常量 ---
// upload 型图片选项的 dataUrl 存独立 key（image:<templateId>:<optionId>），
// 绝不内嵌模板 JSON（GET /api/templates 体积红线）。
const MAX_UPLOAD_OPTIONS_PER_TEMPLATE = 10;
const MAX_IMAGE_DATAURL_LENGTH = 400 * 1024; // 单张压缩后 ≤400KB（Upstash 单值 ≤1MB 留余量）
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const imageKey = (templateId: string, optionId: string) => `image:${templateId}:${optionId}`;

// --- 背景图存储常量 ---
// 模板背景的 dataUrl 同样绝不内嵌模板 JSON（历史上 2 个模板各带 ~2.3MB，把
// GET /api/templates 撑到 4.75MB，新用户首屏要等 30~60 秒）。存独立 key bg:<templateId>。
const bgKey = (templateId: string) => `bg:${templateId}`;
const MAX_BG_DATAURL_LENGTH = 6 * 1024 * 1024; // 背景 dataUrl 上限（线上现有 ~2.3MB，留余量）

// 背景图剥离：模板 JSON 只存 bgImageUrl 占位（''），dataUrl 移入独立 key。
// - GET 列表（overwrite=false）：顺带完成存量迁移，key 已存在则不重复写入
// - POST 保存（overwrite=true）：以入参为准直接覆盖（管理员换了新背景）
async function stripTemplateBackground(tpl: any, overwrite: boolean): Promise<any> {
  if (!tpl || typeof tpl.bgImageUrl !== 'string' || !tpl.bgImageUrl.startsWith('data:image/')) {
    return tpl;
  }
  const dataUrl = tpl.bgImageUrl;
  const id = String(tpl.id || '');
  if (SAFE_ID_RE.test(id) && dataUrl.length <= MAX_BG_DATAURL_LENGTH) {
    if (overwrite || (await readRaw(bgKey(id))) === null) {
      await writeRaw(bgKey(id), dataUrl);
    }
  }
  return { ...tpl, bgImageUrl: '' };
}

interface StoredAdmin {
  username: string;
  passwordHash: string;
  role: 'super_admin' | 'senior_admin' | 'admin';
  permissions: {
    canEditOthers: boolean;
    canPublishOthers: boolean;
    canDeleteOthers: boolean;
    // 上线模板：发布/下架自己名下或被指定授权的模板（上线到前台为独立权限，默认 false）
    canPublish?: boolean;
    allowedTemplateIds?: string[];
  };
  createdAt: string;
  // 密码版本号：改密/被重置时 +1，携带旧 pv 的令牌立即失效（旧账号无此字段按 0 处理）
  pv?: number;
}

// --- 数据读写（经存储层抽象） ---

async function readBuiltinOverrides(): Promise<BuiltinOverrides> {
  return readJson<BuiltinOverrides>('builtin_overrides', { hiddenIds: [], deletedIds: [] });
}

async function readTemplateOrder(): Promise<string[]> {
  const data = await readJson<{ order?: string[] }>('template_order', { order: [] });
  return Array.isArray(data.order) ? data.order : [];
}

// --- 管理员种子数据 ---

// admin 账号初始密码：优先环境变量 ADMIN_INITIAL_PASSWORD 注入（长度 ≥6）；
// 未配置则随机生成并在服务端日志打印兜底，避免源码里出现固定明文默认密码。
function initialAdminPassword(): string {
  const fromEnv = process.env.ADMIN_INITIAL_PASSWORD;
  if (fromEnv && fromEnv.trim().length >= 6) {
    return fromEnv.trim();
  }
  const random = crypto.randomBytes(9).toString('base64url');
  console.log(`[admin] 未配置 ADMIN_INITIAL_PASSWORD 环境变量，本次 admin 初始密码为：${random}`);
  return random;
}

function defaultAdmins(): StoredAdmin[] {
  return [
    {
      username: 'zhangxiyu',
      passwordHash: hashPassword('123456'),
      role: 'super_admin',
      permissions: { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true },
      createdAt: new Date().toISOString(),
      pv: 0,
    },
    {
      username: 'admin',
      passwordHash: hashPassword(initialAdminPassword()),
      role: 'admin',
      permissions: { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, canPublish: false },
      createdAt: new Date().toISOString(),
      pv: 0,
    },
  ];
}

// 首次启动时写入默认管理员；已有数据时保证 zhangxiyu 始终是超管
async function ensureSeedAdmins(): Promise<void> {
  let admins = await readJson<StoredAdmin[]>('admins', []);
  if (!Array.isArray(admins) || admins.length === 0) {
    await writeJson('admins', defaultAdmins());
    return;
  }

  const normalized = admins.map((a) => {
    const isZhang = a.username.trim().toLowerCase() === 'zhangxiyu';
    return {
      ...a,
      role: isZhang ? 'super_admin' : (a.role || 'admin'),
      permissions: isZhang
        ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true, allowedTemplateIds: a.permissions?.allowedTemplateIds || [] }
        : (a.permissions || { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, canPublish: false }),
    };
  });
  if (!normalized.some((a) => a.username.trim().toLowerCase() === 'zhangxiyu')) {
    normalized.unshift({
      username: 'zhangxiyu',
      passwordHash: hashPassword('123456'),
      role: 'super_admin',
      permissions: { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true },
      createdAt: new Date().toISOString(),
      pv: 0,
    });
  }
  if (JSON.stringify(normalized) !== JSON.stringify(admins)) {
    await writeJson('admins', normalized);
  }
}

async function getAdmins(): Promise<StoredAdmin[]> {
  return readJson<StoredAdmin[]>('admins', []);
}

// --- 密码哈希（Node 内置 scrypt，零新增依赖） ---
// 参数固定：N=16384, r=8, p=1, keylen=64, salt=16 字节（单次 ~50ms，Serverless 冷启动可接受）
// 存储格式：scrypt$N$r$p$<saltHex>$<hashHex>，参数内嵌以便未来调参不破坏兼容。
// 历史明文密码不做主动迁移：账号下次登录成功时惰性重哈希回写（见登录端点）。

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 64;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
    .toString('hex');
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}

function verifyPassword(stored: string, input: string): { ok: boolean; legacy: boolean } {
  if (!stored || typeof stored !== 'string') return { ok: false, legacy: false };
  const parts = stored.split('$');
  if (parts[0] !== 'scrypt' || parts.length !== 6) {
    // 历史遗留明文密码：直接比对；匹配时由调用方惰性重哈希
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
    const expected = Buffer.from(expectedHex, 'hex');
    if (actual.length !== expected.length) return { ok: false, legacy: false };
    return { ok: crypto.timingSafeEqual(actual, expected), legacy: false };
  } catch {
    return { ok: false, legacy: false };
  }
}

function validateNewPassword(password: string): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    return `密码长度至少为 ${PASSWORD_MIN} 位`;
  }
  if (password.length > PASSWORD_MAX) {
    return `密码长度不能超过 ${PASSWORD_MAX} 位`;
  }
  return null;
}

// --- 管理员登录令牌（HMAC 签名，服务端无状态） ---

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
let warnedNoSecret = false;

function getTokenSecret(): string {
  const fromEnv = process.env.ADMIN_TOKEN_SECRET;
  if (fromEnv) return fromEnv;
  if (!warnedNoSecret) {
    warnedNoSecret = true;
    console.warn('[auth] ADMIN_TOKEN_SECRET 未设置，使用进程级随机密钥（重启后所有登录令牌失效）');
  }
  return (getTokenSecret as any).tmpSecret ||= crypto.randomBytes(32).toString('hex');
}

interface TokenClaims {
  username: string;
  // null = 旧版 3 段令牌（无密码版本号），宽限至自然过期（最多 7 天）后自动淘汰
  pv: number | null;
}

function signToken(username: string, pv: number): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${username}:${exp}:${pv}`;
  const sig = crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('hex');
  const nameB64 = Buffer.from(username, 'utf-8').toString('base64url');
  return `${sig}.${exp}.${nameB64}.${pv}`;
}

function verifyToken(token: string): TokenClaims | null {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 && parts.length !== 4) return null;
  const [sig, expRaw, nameB64, pvRaw] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  let username: string;
  try {
    username = Buffer.from(nameB64, 'base64url').toString('utf-8');
  } catch {
    return null;
  }
  const pv = pvRaw !== undefined ? Number(pvRaw) : null;
  if (pv !== null && (!Number.isInteger(pv) || pv < 0)) return null;
  const payload = pv === null ? `${username}:${exp}` : `${username}:${exp}:${pv}`;
  const expected = crypto
    .createHmac('sha256', getTokenSecret())
    .update(payload)
    .digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return { username, pv };
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return (req.body && typeof req.body.token === 'string' && req.body.token) || null;
}

type AuthHandler = (req: Request, res: Response, next: NextFunction) => void;

function requireAuth(): AuthHandler {
  return async (req, res, next) => {
    try {
      const token = extractToken(req);
      const claims = token ? verifyToken(token) : null;
      if (!claims) {
        // 诊断日志：登录态失效时输出请求信息，便于排查令牌问题
        console.log(
          `[auth] 401 拒绝: ${req.method} ${req.path} | token: ${token ? `${String(token).slice(0, 16)}...` : '未携带'}`
        );
        return res.status(401).json({ error: '请先登录后再操作' });
      }
      // 令牌携带密码版本号：改密/被重置后旧会话立即失效。
      // 旧版 3 段令牌 pv=null（改密校验跳过），宽限至自然过期。
      const admins = await getAdmins();
      const found = admins.find(
        (a) => a.username.trim().toLowerCase() === claims.username.trim().toLowerCase()
      );
      if (!found) {
        return res.status(401).json({ error: '账号不存在，请重新登录' });
      }
      if (claims.pv !== null && claims.pv !== (found.pv ?? 0)) {
        return res.status(401).json({ error: '登录状态已失效（密码已修改），请重新登录' });
      }
      (req as any).adminUsername = found.username;
      (req as any).admin = found;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireSuperAdmin(): AuthHandler {
  return async (req, res, next) => {
    const username = (req as any).adminUsername as string;
    const admins = await getAdmins();
    const found = admins.find((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase());
    const isSuper = username.trim().toLowerCase() === 'zhangxiyu' || found?.role === 'super_admin';
    if (!isSuper) {
      return res.status(403).json({ error: '只有超级管理员可以执行此操作' });
    }
    next();
  };
}

// 模板写操作权限判定：与前端 AdminPanel 的 hasXxxPermission 同构（后端强制校验，
// 防止绕过前端直接调 API）。tpl.author 为空视为公共模板（如系统导入），按 owner 处理。
function getTemplateAccess(user: StoredAdmin, tpl: any) {
  const name = user.username.trim().toLowerCase();
  const isSuper = name === 'zhangxiyu' || user.role === 'super_admin';
  const isSenior = user.role === 'senior_admin';
  const owner = !tpl?.author || String(tpl.author).trim().toLowerCase() === name;
  const granted =
    (user.permissions?.allowedTemplateIds || []).includes(tpl?.id) ||
    (Array.isArray(tpl?.allowedEditors) &&
      tpl.allowedEditors.some((u: unknown) => typeof u === 'string' && u.trim().toLowerCase() === name));

  return {
    isSuper,
    // 编辑：超管/高级管理员/全局编辑他人权限/本人/被指定授权
    canEdit: isSuper || isSenior || user.permissions?.canEditOthers === true || owner || granted,
    // 上线/下架：超管/高级管理员/全局发布他人权限；本人或被指定授权的模板还需独立 canPublish 授权
    canPublish:
      isSuper || isSenior || user.permissions?.canPublishOthers === true || ((owner || granted) && user.permissions?.canPublish === true),
    // 删除：超管/高级管理员/全局删除他人权限/本人（被指定授权不含删除，与前端一致）
    canDelete: isSuper || isSenior || user.permissions?.canDeleteOthers === true || owner,
  };
}

// Express 4 不会自动捕获 async 错误，统一包一层
function ah(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 输出给客户端的管理员对象（脱敏，不含密码）
function sanitizeAdmin(a: StoredAdmin) {
  const isSuper = a.username.trim().toLowerCase() === 'zhangxiyu' || a.role === 'super_admin';
  return {
    username: a.username,
    role: isSuper ? 'super_admin' : (a.role || 'admin'),
    permissions: isSuper
      ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, allowedTemplateIds: a.permissions?.allowedTemplateIds || [] }
      : {
          canEditOthers: a.permissions?.canEditOthers ?? false,
          canPublishOthers: a.permissions?.canPublishOthers ?? false,
          canDeleteOthers: a.permissions?.canDeleteOthers ?? false,
          allowedTemplateIds: a.permissions?.allowedTemplateIds || [],
        },
    createdAt: a.createdAt || new Date().toISOString(),
  };
}

export async function createApp(): Promise<express.Express> {
  const app = express();

  await ensureSeedAdmins();

  // 大体积请求（base64 背景图）
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // gzip 压缩 JSON 响应（Vercel 不自动压缩函数响应；内置 zlib，零外部依赖）
  app.use((req, res, next) => {
    const accept = String(req.headers['accept-encoding'] || '').toLowerCase();
    if (!accept.includes('gzip')) return next();
    const origJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const payload = Buffer.from(JSON.stringify(body), 'utf-8');
      if (payload.length < 1024) {
        return origJson(body); // 小响应不值得压缩
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      zlib.gzip(payload, (err, buf) => {
        if (err) {
          res.removeHeader('Content-Encoding');
          res.end(payload);
        } else {
          res.end(buf);
        }
      });
      return res;
    }) as typeof res.json;
    next();
  });

  // --- Auth API ---

  app.post('/api/admin/login', ah(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名/邮箱与密码' });
    }

    const admins = await getAdmins();
    const found = admins.find(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase()
    );

    // 统一走 verifyPassword：哈希账号直接校验；历史明文账号匹配成功后惰性重哈希回写
    const check = found ? verifyPassword(found.passwordHash, password) : { ok: false, legacy: false };
    if (!found || !check.ok) {
      return res.status(401).json({ error: '用户名或密码错误，请重试' });
    }
    if (check.legacy) {
      found.passwordHash = hashPassword(password);
      found.pv = 0;
      await writeJson('admins', admins);
    }

    const sanitized = sanitizeAdmin(found);
    const token = signToken(found.username, found.pv ?? 0);
    return res.json({
      success: true,
      token,
      admin: sanitized,
      message: '登录成功',
    });
  }));

  app.post('/api/admin/register', requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    const invalidPwd = validateNewPassword(password);
    if (invalidPwd) {
      return res.status(400).json({ error: invalidPwd });
    }

    const admins = await getAdmins();
    const exists = admins.some((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase());
    if (exists) {
      return res.status(400).json({ error: '该管理员账号已存在，请直接登录' });
    }

    const newAdmin: StoredAdmin = {
      username: username.trim(),
      passwordHash: hashPassword(password),
      role: 'admin',
      permissions: { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, canPublish: false, allowedTemplateIds: [] },
      createdAt: new Date().toISOString(),
      pv: 0,
    };
    admins.push(newAdmin);
    await writeJson('admins', admins);

    return res.json({
      success: true,
      token: signToken(newAdmin.username, 0),
      admin: sanitizeAdmin(newAdmin),
      message: '管理员账号注册成功！',
    });
  }));

  // --- Admin Permission Management API ---

  app.get('/api/admin/users', requireAuth(), ah(async (_req, res) => {
    const admins = await getAdmins();
    return res.json({ success: true, users: admins.map(sanitizeAdmin) });
  }));

  app.post('/api/admin/users/update-role', requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { targetUsername, role, permissions } = req.body;
    if (!targetUsername) {
      return res.status(400).json({ error: '目标管理员用户名不能为空' });
    }

    const admins = await getAdmins();
    const targetIdx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === targetUsername.trim().toLowerCase()
    );
    if (targetIdx < 0) {
      return res.status(404).json({ error: '未找到指定管理员账号' });
    }

    const isZhangxiyu = targetUsername.trim().toLowerCase() === 'zhangxiyu';
    const finalRole = isZhangxiyu ? 'super_admin' : (role || 'admin');
    const existingPerms = admins[targetIdx].permissions || {
      canEditOthers: false,
      canPublishOthers: false,
      canDeleteOthers: false,
      allowedTemplateIds: [],
    };

    const finalPermissions =
      finalRole === 'super_admin'
        ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true, allowedTemplateIds: existingPerms.allowedTemplateIds || [] }
        : finalRole === 'senior_admin'
          ? {
              canEditOthers: permissions?.canEditOthers ?? true,
              canPublishOthers: permissions?.canPublishOthers ?? true,
              canDeleteOthers: permissions?.canDeleteOthers ?? true,
              canPublish: permissions?.canPublish ?? true,
              allowedTemplateIds: permissions?.allowedTemplateIds !== undefined ? permissions.allowedTemplateIds : (existingPerms.allowedTemplateIds || []),
            }
          : {
              canEditOthers: permissions?.canEditOthers ?? false,
              canPublishOthers: permissions?.canPublishOthers ?? false,
              canDeleteOthers: permissions?.canDeleteOthers ?? false,
              canPublish: permissions?.canPublish ?? false,
              allowedTemplateIds: permissions?.allowedTemplateIds !== undefined ? permissions.allowedTemplateIds : (existingPerms.allowedTemplateIds || []),
            };

    admins[targetIdx] = { ...admins[targetIdx], role: finalRole, permissions: finalPermissions };
    await writeJson('admins', admins);

    return res.json({
      success: true,
      message: `已成功更新管理员「${targetUsername}」的权限配置！`,
      users: admins.map(sanitizeAdmin),
    });
  }));

  app.post('/api/admin/users/assign-templates', requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { targetUsername, templateIds } = req.body;
    if (!targetUsername) {
      return res.status(400).json({ error: '目标管理员用户名不能为空' });
    }

    const admins = await getAdmins();
    const targetIdx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === targetUsername.trim().toLowerCase()
    );
    if (targetIdx < 0) {
      return res.status(404).json({ error: '未找到指定管理员账号' });
    }

    const currentPerms = admins[targetIdx].permissions || {
      canEditOthers: false,
      canPublishOthers: false,
      canDeleteOthers: false,
      allowedTemplateIds: [],
    };
    admins[targetIdx].permissions = {
      ...currentPerms,
      allowedTemplateIds: Array.isArray(templateIds) ? templateIds : [],
    };
    await writeJson('admins', admins);

    return res.json({
      success: true,
      message: `已成功为「${targetUsername}」分配 ${Array.isArray(templateIds) ? templateIds.length : 0} 个指定模板权限！`,
      users: admins.map(sanitizeAdmin),
    });
  }));

  app.post('/api/admin/users/create', requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名与密码不能为空' });
    }
    const invalidPwd = validateNewPassword(password);
    if (invalidPwd) {
      return res.status(400).json({ error: invalidPwd });
    }

    const admins = await getAdmins();
    if (admins.some((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase())) {
      return res.status(400).json({ error: '该管理员账号已存在' });
    }

    const targetRole = role || 'admin';
    const newAdmin: StoredAdmin = {
      username: username.trim(),
      passwordHash: hashPassword(password),
      role: targetRole,
      permissions: targetRole === 'senior_admin'
        ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, canPublish: true }
        : { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, canPublish: false },
      createdAt: new Date().toISOString(),
      pv: 0,
    };
    admins.push(newAdmin);
    await writeJson('admins', admins);

    return res.json({
      success: true,
      message: `已成功创建新管理员「${username}」！`,
      users: admins.map(sanitizeAdmin),
    });
  }));

  app.delete('/api/admin/users/:username', requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username } = req.params;
    if (!username) {
      return res.status(400).json({ error: '用户名不能为空' });
    }
    if (username.trim().toLowerCase() === 'zhangxiyu') {
      return res.status(403).json({ error: '超级管理员 zhangxiyu 无法被删除' });
    }

    let admins = await getAdmins();
    const beforeLen = admins.length;
    admins = admins.filter((a) => a.username.trim().toLowerCase() !== username.trim().toLowerCase());
    if (admins.length === beforeLen) {
      return res.status(404).json({ error: '未找到指定管理员' });
    }
    await writeJson('admins', admins);

    return res.json({ success: true, message: '管理员账号已删除', users: admins.map(sanitizeAdmin) });
  }));

  // 本人修改密码：验证旧密码（兼容历史明文账号）→ 新密码哈希存储 → pv+1
  // pv+1 使本人所有已签发令牌（含当前会话）立即失效，客户端引导重新登录
  app.post('/api/admin/change-password', requireAuth(), ah(async (req, res) => {
    const username = (req as any).adminUsername as string;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请输入当前密码与新密码' });
    }

    const admins = await getAdmins();
    const idx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase()
    );
    if (idx < 0) {
      return res.status(401).json({ error: '账号不存在，请重新登录' });
    }

    const check = verifyPassword(admins[idx].passwordHash, oldPassword);
    if (!check.ok) {
      return res.status(400).json({ error: '当前密码不正确' });
    }
    const invalidNew = validateNewPassword(newPassword);
    if (invalidNew) {
      return res.status(400).json({ error: invalidNew });
    }
    if (newPassword === oldPassword) {
      return res.status(400).json({ error: '新密码不能与当前密码相同' });
    }

    admins[idx].passwordHash = hashPassword(newPassword);
    admins[idx].pv = (admins[idx].pv ?? 0) + 1;
    await writeJson('admins', admins);

    return res.json({ success: true, message: '密码修改成功，请重新登录' });
  }));

  // 超管重置他人密码（忘记密码兜底）：pv+1 踢掉目标账号的全部会话
  app.post('/api/admin/users/reset-password', requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username, newPassword } = req.body;
    if (!username) {
      return res.status(400).json({ error: '目标管理员用户名不能为空' });
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
      return res.status(404).json({ error: '未找到指定管理员账号' });
    }

    admins[idx].passwordHash = hashPassword(newPassword);
    admins[idx].pv = (admins[idx].pv ?? 0) + 1;
    await writeJson('admins', admins);

    return res.json({ success: true, message: `已重置管理员「${admins[idx].username}」的密码` });
  }));

  // 超管一键初始化他人密码为默认值（登录前忘记密码兜底）：pv+1 踢掉目标账号的全部会话
  app.post('/api/admin/users/reset-password-default', requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: '目标管理员用户名不能为空' });
    }

    const admins = await getAdmins();
    const idx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase()
    );
    if (idx < 0) {
      return res.status(404).json({ error: '未找到指定管理员账号' });
    }

    const newPwd = initialAdminPassword();
    admins[idx].passwordHash = hashPassword(newPwd);
    admins[idx].pv = (admins[idx].pv ?? 0) + 1;
    await writeJson('admins', admins);

    return res.json({
      success: true,
      message: `已将管理员「${admins[idx].username}」的密码初始化为：${newPwd}`,
    });
  }));

  // --- Templates API ---

  app.get('/api/templates', ah(async (_req, res) => {
    const raw = await readJson<any[]>('diy_templates', []);
    // 存量迁移：历史上保存的模板背景 dataUrl 内嵌在 JSON 里（单张 ~2.3MB），
    // 读取时剥离进独立 key，并把净化后的列表写回存储 —— 之后列表读写都只有几 KB
    const templates: any[] = [];
    let migrated = false;
    for (const t of raw) {
      if (t && typeof t.bgImageUrl === 'string' && t.bgImageUrl.startsWith('data:image/')) {
        templates.push(await stripTemplateBackground(t, false));
        migrated = true;
      } else {
        templates.push(t);
      }
    }
    if (migrated) {
      await writeJson('diy_templates', templates);
    }
    const overrides = await readBuiltinOverrides();
    const order = await readTemplateOrder();
    // 边缘短缓存：一分钟内重复访问/刷新直接命中 CDN 边缘节点（浏览器不缓存）
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    res.json({ success: true, templates, overrides, order });
  }));

  // 单模板分享页数据源（公开）：仅已发布模板可访问。
  // DIY 按 isPublished 过滤；内置按 builtin_overrides（hidden/deleted）过滤。
  // 与列表端点同一套边缘缓存：下架/删除后最多 60s 内分享页失效（与前台下拉一致）。
  app.get('/api/templates/share/:id', ah(async (req, res) => {
    const { id } = req.params;
    const notFound = () =>
      res.status(404).json({ success: false, message: '该模板未上线或不存在' });
    if (!SAFE_ID_RE.test(id)) return notFound();

    const diyTemplates = await readJson<any[]>('diy_templates', []);
    let tpl = diyTemplates.find((t) => t.id === id);
    if (tpl) {
      if (tpl.isPublished === false) return notFound();
      // 存量迁移兜底：历史内嵌背景 dataUrl 不随单模板响应下发（与列表端点同策略）
      tpl = await stripTemplateBackground(tpl, false);
    } else {
      const builtin = BUILTIN_TEMPLATES.find((t) => t.id === id);
      if (!builtin) return notFound();
      const overrides = await readBuiltinOverrides();
      if (
        builtin.isPublished === false ||
        overrides.hiddenIds.includes(id) ||
        overrides.deletedIds.includes(id)
      ) {
        return notFound();
      }
      tpl = builtin;
    }

    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    return res.json({ success: true, template: tpl });
  }));

  app.post('/api/template-order', requireAuth(), ah(async (req, res) => {
    const { order } = req.body || {};
    if (!Array.isArray(order) || order.some((id: unknown) => typeof id !== 'string')) {
      return res.status(400).json({ error: '排序数据格式不正确' });
    }
    await writeJson('template_order', { order });
    return res.json({ success: true, order, message: '模板排序已保存' });
  }));

  // Builtin template visibility state (hide/unpublish or delete)
  // Guard: the template library must never become empty
  // 内置模板上下架/删除为站方基础内容操作：仅超管（上线权限收紧）
  app.post('/api/templates/builtin-state', requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { id, hidden, deleted } = req.body || {};
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: '模板 ID 不能为空' });
    }

    // Only real builtin templates can be overridden; DIY copies must go through /api/templates/:id
    if (!BUILTIN_TEMPLATES.some((b) => b.id === id)) {
      return res.status(400).json({ error: '该模板不是内置模板，请通过模板库常规流程删除或下架。' });
    }

    const overrides = await readBuiltinOverrides();
    const diyTemplates = await readJson<any[]>('diy_templates', []);

    if (deleted === true) {
      // Deleting removes the template entirely from the library
      const remaining =
        BUILTIN_TEMPLATES.filter((b) => b.id !== id && !overrides.deletedIds.includes(b.id)).length +
        diyTemplates.length;
      if (remaining < 1) {
        return res.status(400).json({
          error: '模板库仅剩最后一个模板，无法删除。请先创建或发布其他模板后再操作。',
        });
      }
      if (!overrides.deletedIds.includes(id)) {
        overrides.deletedIds.push(id);
      }
      overrides.hiddenIds = overrides.hiddenIds.filter((h) => h !== id);
    } else if (hidden !== undefined) {
      // Hiding only removes it from the frontend; it stays in the admin library as draft
      const publishedBuiltins = BUILTIN_TEMPLATES.filter(
        (b) =>
          !overrides.hiddenIds.includes(b.id) &&
          !overrides.deletedIds.includes(b.id) &&
          b.isPublished !== false
      );
      const publishedDiy = diyTemplates.filter((t) => t.isPublished !== false).length;
      const remainingPublished = publishedBuiltins.filter((b) => b.id !== id).length + publishedDiy;
      if (hidden === true && remainingPublished < 1) {
        return res.status(400).json({
          error: '模板库中仅剩最后一个已发布模板，无法下架。请先发布其他模板后再操作。',
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

    await writeJson('builtin_overrides', overrides);
    return res.json({ success: true, overrides });
  }));

  app.post('/api/templates', requireAuth(), ah(async (req, res) => {
    const newTemplate = req.body;
    if (!newTemplate || !newTemplate.name) {
      return res.status(400).json({ error: '模板数据不完整，缺少模板名称' });
    }

    // 防御性净化：upload 型图片选项只保留元数据，url/dataUrl 字段一律剔除
    // （dataUrl 必须走独立存储 key，绝不内嵌模板 JSON）
    const rawOptions = Array.isArray(newTemplate.imageOptions) ? newTemplate.imageOptions : [];
    const uploadCount = rawOptions.filter((o: any) => o && o.source === 'upload').length;
    if (uploadCount > MAX_UPLOAD_OPTIONS_PER_TEMPLATE) {
      return res.status(400).json({
        error: `上传型图片选项最多 ${MAX_UPLOAD_OPTIONS_PER_TEMPLATE} 张，当前 ${uploadCount} 张`,
      });
    }
    const imageOptions = rawOptions
      .filter((o: any) => o && typeof o.id === 'string')
      .map((o: any) => {
        const clean: any = {
          id: o.id,
          label: typeof o.label === 'string' ? o.label : '图片',
          source: o.source === 'url' ? 'url' : 'upload',
        };
        if (clean.source === 'url' && typeof o.url === 'string') {
          clean.url = o.url;
        }
        return clean;
      });

    const templates = await readJson<any[]>('diy_templates', []);
    const templateId = newTemplate.id || `diy-template-${Date.now()}`;
    const existingIndex = templates.findIndex((t) => t.id === templateId);
    const existing = existingIndex >= 0 ? templates[existingIndex] : null;

    // 归属与指定授权硬化：author 与 allowedEditors 以服务端存储为准，忽略请求体
    // （防止伪造作者身份、或私自改写授权编辑器列表绕过权限判定）
    const me = (req as any).admin as StoredAdmin;
    const prepared = {
      ...newTemplate,
      imageOptions,
      id: templateId,
      author: existing ? existing.author : me.username,
      allowedEditors: existing
        ? existing.allowedEditors
        : (Array.isArray(newTemplate.allowedEditors) ? newTemplate.allowedEditors : []),
      updatedAt: new Date().toISOString(),
      createdAt: newTemplate.createdAt || existing?.createdAt || new Date().toISOString(),
    };

    // 后端强制权限校验（编辑 + 上线），与前端 hasXxxPermission 同构
    const access = getTemplateAccess(me, prepared);
    if (!access.canEdit) {
      return res.status(403).json({ error: '无权限编辑该模板（仅本人、被指定授权或已开通全局编辑权限的管理员可编辑）' });
    }
    // 仅当请求体显式携带 isPublished 且与存储状态不一致（或新模板直接要求上线）时才视为上下线操作
    const payloadPublish = typeof newTemplate.isPublished === 'boolean'
      ? newTemplate.isPublished
      : (existing ? existing.isPublished !== false : false);
    const publishChanged = existing
      ? payloadPublish !== (existing.isPublished !== false)
      : payloadPublish === true;
    if (publishChanged && !access.canPublish) {
      return res.status(403).json({ error: '无上线权限：上线/下架模板需超管在权限配置中心授予「上线模板」权限' });
    }

    // 背景 dataUrl 剥离进独立 key（bg:<templateId>），模板 JSON 只存占位
    const cleaned = await stripTemplateBackground(prepared, true);
    // 切回纯色/渐变底时清理孤儿背景 key（幂等）
    if (prepared.bgType !== 'image' && SAFE_ID_RE.test(templateId)) {
      await deleteRaw(bgKey(templateId));
    }

    if (existingIndex >= 0) {
      templates[existingIndex] = cleaned;
    } else {
      templates.unshift(cleaned);
    }

    await writeJson('diy_templates', templates);
    return res.json({ success: true, template: cleaned, message: '模板已保存成功！' });
  }));

  app.delete('/api/templates/:id', requireAuth(), ah(async (req, res) => {
    const { id } = req.params;
    let templates = await readJson<any[]>('diy_templates', []);
    const target = templates.find((t) => t.id === id);

    // 删除他人模板需全局删除权限（被指定授权仅开放编辑，与前端 hasDeletePermission 一致）
    const me = (req as any).admin as StoredAdmin;
    if (target && !getTemplateAccess(me, target).canDelete) {
      return res.status(403).json({ error: '无权限删除该模板（仅本人、超管或已开通全局删除权限的管理员可删除）' });
    }

    const beforeLen = templates.length;
    templates = templates.filter((t) => t.id !== id);
    if (templates.length === beforeLen) {
      return res.status(404).json({ error: '未找到对应模板或无法删除' });
    }
    await writeJson('diy_templates', templates);

    // 级联清理该模板的图片存储 key（无残留孤儿数据）
    const uploadIds = Array.isArray(target?.imageOptions)
      ? target!.imageOptions.filter((o: any) => o && o.source === 'upload' && typeof o.id === 'string').map((o: any) => o.id)
      : [];
    for (const optionId of uploadIds) {
      if (SAFE_ID_RE.test(optionId)) {
        await deleteRaw(imageKey(id, optionId));
      }
    }
    // 级联清理背景图 key
    if (SAFE_ID_RE.test(id)) {
      await deleteRaw(bgKey(id));
    }

    return res.json({ success: true, message: '模板已成功删除' });
  }));

  // 读取模板全部 upload 型图片选项的 dataUrl（公开：用户端渲染需要）
  app.get('/api/templates/:id/images', ah(async (req, res) => {
    const { id } = req.params;
    if (!SAFE_ID_RE.test(id)) {
      return res.status(400).json({ error: '非法模板 ID' });
    }

    const diyTemplates = await readJson<any[]>('diy_templates', []);
    const tpl = diyTemplates.find((t) => t.id === id) || BUILTIN_TEMPLATES.find((t) => t.id === id);
    if (!tpl) {
      return res.status(404).json({ error: '未找到对应模板' });
    }

    const uploadOptions = (Array.isArray(tpl.imageOptions) ? tpl.imageOptions : [])
      .filter((o: any) => o && o.source === 'upload' && typeof o.id === 'string');
    const keys = uploadOptions.map((o: any) => imageKey(id, o.id));
    const rawMap = await mgetRaw(keys);

    const images: Record<string, string> = {};
    for (const optionId of uploadOptions.map((o: any) => o.id)) {
      const v = rawMap[imageKey(id, optionId)];
      if (typeof v === 'string') {
        images[optionId] = v;
      }
    }
    // 图片数据体量大：浏览器 60 秒内本地缓存、边缘 5 分钟 + 过期兜底（后台重验）
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');
    return res.json({ success: true, images });
  }));

  // 读取模板背景图 dataUrl（公开：列表 JSON 已剥离，渲染时按需拉取）
  app.get('/api/templates/:id/bg', ah(async (req, res) => {
    const { id } = req.params;
    if (!SAFE_ID_RE.test(id)) {
      return res.status(400).json({ error: '非法模板 ID' });
    }

    const diyTemplates = await readJson<any[]>('diy_templates', []);
    const tpl = diyTemplates.find((t) => t.id === id) || BUILTIN_TEMPLATES.find((t) => t.id === id);
    if (!tpl) {
      return res.status(404).json({ error: '未找到对应模板' });
    }

    const bg = await readRaw(bgKey(id));
    // 背景图体量大（~1.7MB）：浏览器 60 秒内本地缓存、边缘 5 分钟 + 过期兜底（后台重验）
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');
    return res.json({ success: true, bg });
  }));

  // 上传/删除模板的图片选项 dataUrl（独立 key，不在模板 JSON 内）
  app.post('/api/templates/:id/images', requireAuth(), ah(async (req, res) => {
    const { id } = req.params;
    if (!SAFE_ID_RE.test(id)) {
      return res.status(400).json({ error: '非法模板 ID' });
    }

    const templates = await readJson<any[]>('diy_templates', []);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) {
      return res.status(404).json({ error: '未找到对应模板（仅自定义模板支持图片上传）' });
    }

    // 图片选项属于模板内容：与模板编辑同权限（后端强制校验）
    const me = (req as any).admin as StoredAdmin;
    if (!getTemplateAccess(me, tpl).canEdit) {
      return res.status(403).json({ error: '无权限编辑该模板的图片选项' });
    }

    // 防孤儿 key：只允许写入当前模板 upload 型选项的 dataUrl。
    // 注意 deleteIds 不做此限制 —— 管理员删除选项后正是要靠它清理已不在模板里的 key。
    const uploadIds = new Set(
      (Array.isArray(tpl.imageOptions) ? tpl.imageOptions : [])
        .filter((o: any) => o && o.source === 'upload' && typeof o.id === 'string')
        .map((o: any) => o.id)
    );

    const images =
      req.body && typeof req.body.images === 'object' && req.body.images !== null ? req.body.images : {};
    const deleteIds = Array.isArray(req.body?.deleteIds) ? req.body.deleteIds : [];

    let saved = 0;
    const errors: string[] = [];
    for (const [optionId, dataUrl] of Object.entries(images as Record<string, unknown>)) {
      if (!SAFE_ID_RE.test(optionId)) {
        errors.push(`非法选项 ID: ${optionId}`);
        continue;
      }
      if (!uploadIds.has(optionId)) {
        errors.push(`选项 ${optionId} 不属于该模板`);
        continue;
      }
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/') || dataUrl.length > MAX_IMAGE_DATAURL_LENGTH) {
        errors.push(`选项 ${optionId} 图片数据无效或超过 ${Math.round(MAX_IMAGE_DATAURL_LENGTH / 1024)}KB 限制`);
        continue;
      }
      await writeRaw(imageKey(id, optionId), dataUrl);
      saved++;
    }

    let removed = 0;
    for (const optionId of deleteIds) {
      if (typeof optionId !== 'string' || !SAFE_ID_RE.test(optionId)) continue;
      await deleteRaw(imageKey(id, optionId));
      removed++;
    }

    return res.json({ success: true, saved, removed, errors });
  }));

  // Super Admin: Assign specific admin editors to a specific template
  app.post('/api/templates/assign-editors', requireAuth(), requireSuperAdmin(), ah(async (req, res) => {
    const { templateId, allowedEditors } = req.body;
    if (!templateId) {
      return res.status(400).json({ error: 'templateId 不能为空' });
    }

    const templates = await readJson<any[]>('diy_templates', []);
    const idx = templates.findIndex((t) => t.id === templateId);
    if (idx < 0) {
      return res.status(404).json({ error: '未找到指定模板' });
    }

    templates[idx] = {
      ...templates[idx],
      allowedEditors: Array.isArray(allowedEditors) ? allowedEditors : [],
      updatedAt: new Date().toISOString(),
    };
    await writeJson('diy_templates', templates);

    return res.json({
      success: true,
      message: `已更新模板「${templates[idx].name}」的指定授权管理员列表！`,
      template: templates[idx],
      templates,
    });
  }));

  // 兜底错误处理
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] Unhandled error:', err);
    return res.status(500).json({ error: '服务器开小差了，请稍后重试' });
  });

  return app;
}
