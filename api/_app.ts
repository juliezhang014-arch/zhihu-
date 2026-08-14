import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import { BUILTIN_TEMPLATES } from './_templates';
import { readJson, writeJson } from './_storage';

// 共享的 Express 应用：所有 /api/* 路由。
// - 本地开发：server.ts 挂载 Vite 中间件后监听 3000 端口
// - 生产（Vercel）：api/index.ts 将其作为 Serverless 函数导出

interface BuiltinOverrides {
  hiddenIds: string[];
  deletedIds: string[];
}

interface StoredAdmin {
  username: string;
  passwordHash: string;
  role: 'super_admin' | 'senior_admin' | 'admin';
  permissions: {
    canEditOthers: boolean;
    canPublishOthers: boolean;
    canDeleteOthers: boolean;
    allowedTemplateIds?: string[];
  };
  createdAt: string;
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

function defaultAdmins(): StoredAdmin[] {
  return [
    {
      username: 'zhangxiyu',
      passwordHash: '123456',
      role: 'super_admin',
      permissions: { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true },
      createdAt: new Date().toISOString(),
    },
    {
      username: 'admin',
      passwordHash: 'admin123',
      role: 'admin',
      permissions: { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false },
      createdAt: new Date().toISOString(),
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
        ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, allowedTemplateIds: a.permissions?.allowedTemplateIds || [] }
        : (a.permissions || { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false }),
    };
  });
  if (!normalized.some((a) => a.username.trim().toLowerCase() === 'zhangxiyu')) {
    normalized.unshift({
      username: 'zhangxiyu',
      passwordHash: '123456',
      role: 'super_admin',
      permissions: { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true },
      createdAt: new Date().toISOString(),
    });
  }
  if (JSON.stringify(normalized) !== JSON.stringify(admins)) {
    await writeJson('admins', normalized);
  }
}

async function getAdmins(): Promise<StoredAdmin[]> {
  return readJson<StoredAdmin[]>('admins', []);
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

function signToken(username: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${username}:${exp}`;
  const sig = crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('hex');
  return `${sig}.${exp}.${Buffer.from(username, 'utf-8').toString('base64url')}`;
}

function verifyToken(token: string): string | null {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [sig, expRaw, nameB64] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  let username: string;
  try {
    username = Buffer.from(nameB64, 'base64url').toString('utf-8');
  } catch {
    return null;
  }
  const expected = crypto
    .createHmac('sha256', getTokenSecret())
    .update(`${username}:${exp}`)
    .digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return username;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return (req.body && typeof req.body.token === 'string' && req.body.token) || null;
}

type AuthHandler = (req: Request, res: Response, next: NextFunction) => void;

function requireAuth(): AuthHandler {
  return (req, res, next) => {
    const token = extractToken(req);
    const username = token ? verifyToken(token) : null;
    if (!username) {
      return res.status(401).json({ error: '请先登录后再操作' });
    }
    (req as any).adminUsername = username;
    next();
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

  // --- Auth API ---

  app.post('/api/admin/login', ah(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名/邮箱与密码' });
    }

    const admins = await getAdmins();
    const found = admins.find(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase() && a.passwordHash === password
    );

    if (!found) {
      return res.status(401).json({ error: '用户名或密码错误，请重试' });
    }

    const sanitized = sanitizeAdmin(found);
    const token = signToken(found.username);
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
    if (password.length < 4) {
      return res.status(400).json({ error: '密码长度至少为 4 位' });
    }

    const admins = await getAdmins();
    const exists = admins.some((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase());
    if (exists) {
      return res.status(400).json({ error: '该管理员账号已存在，请直接登录' });
    }

    const newAdmin: StoredAdmin = {
      username: username.trim(),
      passwordHash: password,
      role: 'admin',
      permissions: { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, allowedTemplateIds: [] },
      createdAt: new Date().toISOString(),
    };
    admins.push(newAdmin);
    await writeJson('admins', admins);

    return res.json({
      success: true,
      token: signToken(newAdmin.username),
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
        ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, allowedTemplateIds: existingPerms.allowedTemplateIds || [] }
        : finalRole === 'senior_admin'
          ? {
              canEditOthers: permissions?.canEditOthers ?? true,
              canPublishOthers: permissions?.canPublishOthers ?? true,
              canDeleteOthers: permissions?.canDeleteOthers ?? true,
              allowedTemplateIds: permissions?.allowedTemplateIds !== undefined ? permissions.allowedTemplateIds : (existingPerms.allowedTemplateIds || []),
            }
          : {
              canEditOthers: permissions?.canEditOthers ?? false,
              canPublishOthers: permissions?.canPublishOthers ?? false,
              canDeleteOthers: permissions?.canDeleteOthers ?? false,
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

    const admins = await getAdmins();
    if (admins.some((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase())) {
      return res.status(400).json({ error: '该管理员账号已存在' });
    }

    const targetRole = role || 'admin';
    const newAdmin: StoredAdmin = {
      username: username.trim(),
      passwordHash: password,
      role: targetRole,
      permissions: targetRole === 'senior_admin'
        ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true }
        : { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false },
      createdAt: new Date().toISOString(),
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

  // --- Templates API ---

  app.get('/api/templates', ah(async (_req, res) => {
    const templates = await readJson<any[]>('diy_templates', []);
    const overrides = await readBuiltinOverrides();
    const order = await readTemplateOrder();
    res.json({ success: true, templates, overrides, order });
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
  app.post('/api/templates/builtin-state', requireAuth(), ah(async (req, res) => {
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

    const templates = await readJson<any[]>('diy_templates', []);
    const templateId = newTemplate.id || `diy-template-${Date.now()}`;
    const prepared = {
      ...newTemplate,
      id: templateId,
      updatedAt: new Date().toISOString(),
      createdAt: newTemplate.createdAt || new Date().toISOString(),
    };

    const existingIndex = templates.findIndex((t) => t.id === templateId);
    if (existingIndex >= 0) {
      templates[existingIndex] = prepared;
    } else {
      templates.unshift(prepared);
    }

    await writeJson('diy_templates', templates);
    return res.json({ success: true, template: prepared, message: '模板已保存成功！' });
  }));

  app.delete('/api/templates/:id', requireAuth(), ah(async (req, res) => {
    const { id } = req.params;
    let templates = await readJson<any[]>('diy_templates', []);
    const beforeLen = templates.length;
    templates = templates.filter((t) => t.id !== id);
    if (templates.length === beforeLen) {
      return res.status(404).json({ error: '未找到对应模板或无法删除' });
    }
    await writeJson('diy_templates', templates);
    return res.json({ success: true, message: '模板已成功删除' });
  }));

  // Super Admin: Assign specific admin editors to a specific template
  app.post('/api/templates/assign-editors', requireAuth(), ah(async (req, res) => {
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

  // --- Gemini Reviewer Generation API ---
  app.post('/api/generate-review', ah(async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: '请先配置 GEMINI_API_KEY 环境变量即可开启 AI 一键生成民间锐评！',
        });
      }

      const { keyword, slots } = req.body;
      const slotContext = slots && Array.isArray(slots)
        ? slots.map((s: { label: string; placeholder?: string }) => `【${s.label}】`).join('、')
        : '【夯】、【顶级】、【人上人】、【NPC】、【拉完了】、【锐评人】';

      const prompt = `你是一个互联网神总结嘴替、毒舌但精准的“民间锐评人”。
请针对关键词/主题：“${keyword || '热议话题'}”，为以下栏目生成搞笑、接地气、梗味十足的精炼评语：
需要填充的栏目列表：${slotContext}

要求：
1. 每条评语 15-30 字以内，幽默吸睛、直击要害，符合网民吃瓜口吻。
2. 最后一栏是“锐评人”账号名称或头衔（例如：@互联网抽象艺术家、@吃瓜第一线、@抽象大帝）。
3. 必须输出合法 JSON 格式，例如对应每个槽位 id 的键值对映射。`;

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });

      const text = response.text || '';
      const data = JSON.parse(text);
      return res.json({ success: true, data });
    } catch (err: unknown) {
      console.error('Gemini API Error:', err);
      const message = err instanceof Error ? err.message : 'AI 生成失败，请稍后重试';
      return res.status(500).json({ error: message });
    }
  }));

  // 兜底错误处理
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] Unhandled error:', err);
    return res.status(500).json({ error: '服务器开小差了，请稍后重试' });
  });

  return app;
}
