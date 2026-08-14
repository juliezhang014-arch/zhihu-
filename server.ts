import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const DATA_DIR = path.join(process.cwd(), 'data_storage');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const TEMPLATES_FILE = path.join(DATA_DIR, 'diy_templates.json');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');

// Helper to read JSON
function readJsonFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return defaultValue;
}

// Helper to write JSON
function writeJsonFile<T>(filePath: string, data: T) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
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

// Seed default admins if not exist
let initialAdmins = readJsonFile<StoredAdmin[]>(ADMINS_FILE, []);
if (!Array.isArray(initialAdmins) || initialAdmins.length === 0) {
  initialAdmins = [
    {
      username: 'zhangxiyu',
      passwordHash: '123456',
      role: 'super_admin',
      permissions: {
        canEditOthers: true,
        canPublishOthers: true,
        canDeleteOthers: true,
      },
      createdAt: new Date().toISOString(),
    },
    {
      username: 'admin',
      passwordHash: 'admin123',
      role: 'admin',
      permissions: {
        canEditOthers: false,
        canPublishOthers: false,
        canDeleteOthers: false,
      },
      createdAt: new Date().toISOString(),
    },
  ];
} else {
  // Ensure zhangxiyu exists and is super_admin
  const hasZhang = initialAdmins.some((a) => a.username.trim().toLowerCase() === 'zhangxiyu');
  if (!hasZhang) {
    initialAdmins.unshift({
      username: 'zhangxiyu',
      passwordHash: '123456',
      role: 'super_admin',
      permissions: {
        canEditOthers: true,
        canPublishOthers: true,
        canDeleteOthers: true,
      },
      createdAt: new Date().toISOString(),
    });
  } else {
    // Make sure zhangxiyu is always super_admin
    initialAdmins = initialAdmins.map((a) => {
      if (a.username.trim().toLowerCase() === 'zhangxiyu') {
        return {
          ...a,
          role: 'super_admin',
          permissions: {
            canEditOthers: true,
            canPublishOthers: true,
            canDeleteOthers: true,
          },
        };
      }
      return {
        ...a,
        role: a.role || 'admin',
        permissions: a.permissions || {
          canEditOthers: false,
          canPublishOthers: false,
          canDeleteOthers: false,
        },
      };
    });
  }
}
writeJsonFile(ADMINS_FILE, initialAdmins);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 background images
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // --- Auth API ---
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名/邮箱与密码' });
    }

    const admins = readJsonFile<StoredAdmin[]>(ADMINS_FILE, []);
    const found = admins.find(
      (a) => a.username.trim().toLowerCase() === username.trim().toLowerCase() && a.passwordHash === password
    );

    if (!found) {
      return res.status(401).json({ error: '用户名或密码错误，请重试' });
    }

    const isZhangxiyu = found.username.trim().toLowerCase() === 'zhangxiyu';
    const finalRole = isZhangxiyu ? 'super_admin' : (found.role || 'admin');
    const finalPermissions = finalRole === 'super_admin'
      ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, allowedTemplateIds: found.permissions?.allowedTemplateIds || [] }
      : finalRole === 'senior_admin'
      ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, allowedTemplateIds: found.permissions?.allowedTemplateIds || [] }
      : {
          canEditOthers: found.permissions?.canEditOthers ?? false,
          canPublishOthers: found.permissions?.canPublishOthers ?? false,
          canDeleteOthers: found.permissions?.canDeleteOthers ?? false,
          allowedTemplateIds: found.permissions?.allowedTemplateIds || [],
        };

    const token = `admin_token_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    return res.json({
      success: true,
      token,
      admin: {
        username: found.username,
        role: finalRole,
        permissions: finalPermissions,
        createdAt: found.createdAt,
      },
      message: '登录成功'
    });
  });

  app.post('/api/admin/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: '密码长度至少为 4 位' });
    }

    const admins = readJsonFile<StoredAdmin[]>(ADMINS_FILE, []);
    const exists = admins.some((a) => a.username.trim().toLowerCase() === username.trim().toLowerCase());

    if (exists) {
      return res.status(400).json({ error: '该管理员账号已存在，请直接登录' });
    }

    const isSuper = username.trim().toLowerCase() === 'zhangxiyu';
    const newAdmin: StoredAdmin = {
      username: username.trim(),
      passwordHash: password,
      role: isSuper ? 'super_admin' : 'admin',
      permissions: isSuper
        ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, allowedTemplateIds: [] }
        : { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false, allowedTemplateIds: [] },
      createdAt: new Date().toISOString()
    };
    admins.push(newAdmin);
    writeJsonFile(ADMINS_FILE, admins);

    const token = `admin_token_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    return res.json({
      success: true,
      token,
      admin: {
        username: newAdmin.username,
        role: newAdmin.role,
        permissions: newAdmin.permissions,
        createdAt: newAdmin.createdAt,
      },
      message: '管理员账号注册成功并已自动登录！'
    });
  });

  // --- Admin Permission Management API ---
  app.get('/api/admin/users', (_req, res) => {
    const admins = readJsonFile<StoredAdmin[]>(ADMINS_FILE, []);
    const sanitized = admins.map((a) => {
      const isSuper = a.username.trim().toLowerCase() === 'zhangxiyu' || a.role === 'super_admin';
      const role = isSuper ? 'super_admin' : (a.role || 'admin');
      const permissions = isSuper
        ? { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true, allowedTemplateIds: a.permissions?.allowedTemplateIds || [] }
        : {
            canEditOthers: a.permissions?.canEditOthers ?? false,
            canPublishOthers: a.permissions?.canPublishOthers ?? false,
            canDeleteOthers: a.permissions?.canDeleteOthers ?? false,
            allowedTemplateIds: a.permissions?.allowedTemplateIds || [],
          };

      return {
        username: a.username,
        role,
        permissions,
        createdAt: a.createdAt || new Date().toISOString(),
      };
    });
    return res.json({ success: true, users: sanitized });
  });

  app.post('/api/admin/users/update-role', (req, res) => {
    const { targetUsername, role, permissions } = req.body;
    if (!targetUsername) {
      return res.status(400).json({ error: '目标管理员用户名不能为空' });
    }

    const admins = readJsonFile<StoredAdmin[]>(ADMINS_FILE, []);
    const targetIdx = admins.findIndex(
      (a) => a.username.trim().toLowerCase() === targetUsername.trim().toLowerCase()
    );

    if (targetIdx < 0) {
      return res.status(404).json({ error: '未找到指定管理员账号' });
    }

    // zhangxiyu cannot be demoted from super_admin
    const isZhangxiyu = targetUsername.trim().toLowerCase() === 'zhangxiyu';
    const finalRole = isZhangxiyu ? 'super_admin' : (role || 'admin');
    const existingPerms = admins[targetIdx].permissions || {
      canEditOthers: false,
      canPublishOthers: false,
      canDeleteOthers: false,
      allowedTemplateIds: [],
    };

    const finalPermissions = finalRole === 'super_admin'
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

    admins[targetIdx] = {
      ...admins[targetIdx],
      role: finalRole,
      permissions: finalPermissions,
    };

    writeJsonFile(ADMINS_FILE, admins);

    const sanitized = admins.map((a) => ({
      username: a.username,
      role: a.username.trim().toLowerCase() === 'zhangxiyu' ? 'super_admin' : a.role,
      permissions: a.permissions,
      createdAt: a.createdAt,
    }));

    return res.json({
      success: true,
      message: `已成功更新管理员「${targetUsername}」的权限配置！`,
      users: sanitized,
    });
  });

  // Assign specific template IDs directly to an admin
  app.post('/api/admin/users/assign-templates', (req, res) => {
    const { targetUsername, templateIds } = req.body;
    if (!targetUsername) {
      return res.status(400).json({ error: '目标管理员用户名不能为空' });
    }

    const admins = readJsonFile<StoredAdmin[]>(ADMINS_FILE, []);
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

    writeJsonFile(ADMINS_FILE, admins);

    const sanitized = admins.map((a) => ({
      username: a.username,
      role: a.username.trim().toLowerCase() === 'zhangxiyu' ? 'super_admin' : a.role,
      permissions: a.permissions,
      createdAt: a.createdAt,
    }));

    return res.json({
      success: true,
      message: `已成功为「${targetUsername}」分配 ${Array.isArray(templateIds) ? templateIds.length : 0} 个指定模板权限！`,
      users: sanitized,
    });
  });

  app.post('/api/admin/users/create', (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名与密码不能为空' });
    }

    const admins = readJsonFile<StoredAdmin[]>(ADMINS_FILE, []);
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
    writeJsonFile(ADMINS_FILE, admins);

    const sanitized = admins.map((a) => ({
      username: a.username,
      role: a.role,
      permissions: a.permissions,
      createdAt: a.createdAt,
    }));

    return res.json({
      success: true,
      message: `已成功创建新管理员「${username}」！`,
      users: sanitized,
    });
  });

  app.delete('/api/admin/users/:username', (req, res) => {
    const { username } = req.params;
    if (!username) {
      return res.status(400).json({ error: '用户名不能为空' });
    }
    if (username.trim().toLowerCase() === 'zhangxiyu') {
      return res.status(403).json({ error: '超级管理员 zhangxiyu 无法被删除' });
    }

    let admins = readJsonFile<StoredAdmin[]>(ADMINS_FILE, []);
    const beforeLen = admins.length;
    admins = admins.filter((a) => a.username.trim().toLowerCase() !== username.trim().toLowerCase());

    if (admins.length === beforeLen) {
      return res.status(404).json({ error: '未找到指定管理员' });
    }

    writeJsonFile(ADMINS_FILE, admins);
    const sanitized = admins.map((a) => ({
      username: a.username,
      role: a.role,
      permissions: a.permissions,
      createdAt: a.createdAt,
    }));

    return res.json({ success: true, message: '管理员账号已删除', users: sanitized });
  });

  // --- Templates API ---
  app.get('/api/templates', (_req, res) => {
    const templates = readJsonFile<any[]>(TEMPLATES_FILE, []);
    res.json({ success: true, templates });
  });

  app.post('/api/templates', (req, res) => {
    const newTemplate = req.body;
    if (!newTemplate || !newTemplate.name) {
      return res.status(400).json({ error: '模板数据不完整，缺少模板名称' });
    }

    const templates = readJsonFile<any[]>(TEMPLATES_FILE, []);
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

    writeJsonFile(TEMPLATES_FILE, templates);
    return res.json({ success: true, template: prepared, message: '模板已保存成功！' });
  });

  app.delete('/api/templates/:id', (req, res) => {
    const { id } = req.params;
    let templates = readJsonFile<any[]>(TEMPLATES_FILE, []);
    const beforeLen = templates.length;
    templates = templates.filter((t) => t.id !== id);

    if (templates.length === beforeLen) {
      return res.status(404).json({ error: '未找到对应模板或无法删除' });
    }

    writeJsonFile(TEMPLATES_FILE, templates);
    return res.json({ success: true, message: '模板已成功删除' });
  });

  // Super Admin: Assign specific admin editors to a specific template
  app.post('/api/templates/assign-editors', (req, res) => {
    const { templateId, allowedEditors } = req.body;
    if (!templateId) {
      return res.status(400).json({ error: 'templateId 不能为空' });
    }

    const templates = readJsonFile<any[]>(TEMPLATES_FILE, []);
    const idx = templates.findIndex((t) => t.id === templateId);
    if (idx < 0) {
      return res.status(404).json({ error: '未找到指定模板' });
    }

    templates[idx] = {
      ...templates[idx],
      allowedEditors: Array.isArray(allowedEditors) ? allowedEditors : [],
      updatedAt: new Date().toISOString(),
    };

    writeJsonFile(TEMPLATES_FILE, templates);
    return res.json({
      success: true,
      message: `已更新模板「${templates[idx].name}」的指定授权管理员列表！`,
      template: templates[idx],
      templates,
    });
  });

  // --- Gemini Reviewer Generation API ---
  app.post('/api/generate-review', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: '请先配置 GEMINI_API_KEY 环境变量即可开启 AI 一键生成民间锐评！'
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

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '';
      const data = JSON.parse(text);
      return res.json({ success: true, data });
    } catch (err: unknown) {
      console.error('Gemini API Error:', err);
      const message = err instanceof Error ? err.message : 'AI 生成失败，请稍后重试';
      return res.status(500).json({ error: message });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
