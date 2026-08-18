import { Template, AdminUser } from '../types';
import { BUILTIN_TEMPLATES } from '../data/templates';

const LOCAL_STORAGE_TEMPLATES_KEY = 'diy_templates_cache_v1';
const LOCAL_STORAGE_ADMIN_KEY = 'admin_session_cache_v1';
const LOCAL_STORAGE_BUILTIN_OVERRIDES_KEY = 'builtin_overrides_cache_v1';
const LOCAL_STORAGE_ORDER_KEY = 'template_order_cache_v1';

export interface BuiltinOverrides {
  hiddenIds: string[];
  deletedIds: string[];
}

// Helper: load builtin overrides cache
function getLocalBuiltinOverrides(): BuiltinOverrides {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BUILTIN_OVERRIDES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.hiddenIds) && Array.isArray(parsed.deletedIds)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read local builtin overrides:', e);
  }
  return { hiddenIds: [], deletedIds: [] };
}

// Helper: save builtin overrides cache
function saveLocalBuiltinOverrides(overrides: BuiltinOverrides) {
  try {
    localStorage.setItem(LOCAL_STORAGE_BUILTIN_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.error('Failed to save local builtin overrides:', e);
  }
}

// Apply visibility overrides to builtin templates:
// deleted -> removed entirely; hidden -> unpublished (stays in admin library as draft)
function applyBuiltinOverrides(builtins: Template[], overrides: BuiltinOverrides): Template[] {
  const deleted = new Set(overrides.deletedIds || []);
  const hidden = new Set(overrides.hiddenIds || []);
  return builtins
    .filter((t) => !deleted.has(t.id))
    .map((t) => (hidden.has(t.id) ? { ...t, isPublished: false } : t));
}

// Helper: load template order cache
function getLocalOrder(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to read local template order:', e);
  }
  return [];
}

// Helper: save template order cache
function saveLocalOrder(order: string[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_ORDER_KEY, JSON.stringify(order));
  } catch (e) {
    console.error('Failed to save local template order:', e);
  }
}

// Sort templates by the admin-defined order; new templates not in the order are appended at the end
function sortByOrder(templates: Template[], order: string[]): Template[] {
  if (!order.length) return templates;
  const byId = new Map(templates.map((t) => [t.id, t]));
  const sorted: Template[] = [];
  for (const id of order) {
    const t = byId.get(id);
    if (t) sorted.push(t);
  }
  const seen = new Set(sorted.map((t) => t.id));
  for (const t of templates) {
    if (!seen.has(t.id)) sorted.push(t);
  }
  return sorted;
}

// Helper: load local templates cache
function getLocalDiyTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TEMPLATES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read local templates:', e);
  }
  return [];
}

// Helper: save local templates cache
function saveLocalDiyTemplates(templates: Template[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_TEMPLATES_KEY, JSON.stringify(templates));
  } catch (e) {
    console.error('Failed to save local templates:', e);
  }
}

// Get all templates (built-in + server/local DIY templates)
// fresh=true 附加时间戳绕过边缘缓存（管理端保存后立即刷新用）
export async function getAllTemplates(fresh = false): Promise<Template[]> {
  try {
    const res = await fetch(`/api/templates${fresh ? `?ts=${Date.now()}` : ''}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.templates)) {
        const overrides: BuiltinOverrides = data.overrides || { hiddenIds: [], deletedIds: [] };
        const order: string[] = Array.isArray(data.order) ? data.order : [];
        saveLocalDiyTemplates(data.templates);
        saveLocalBuiltinOverrides(overrides);
        saveLocalOrder(order);
        return sortByOrder(
          [...applyBuiltinOverrides(BUILTIN_TEMPLATES, overrides), ...data.templates],
          order
        );
      }
    }
  } catch (err) {
    console.warn('Could not fetch templates from backend, using local storage cache:', err);
  }

  // Fallback to local storage
  const localDiy = getLocalDiyTemplates();
  return sortByOrder(
    [...applyBuiltinOverrides(BUILTIN_TEMPLATES, getLocalBuiltinOverrides()), ...localDiy],
    getLocalOrder()
  );
}

// Save admin-defined template display order
export async function saveTemplateOrder(order: string[]): Promise<boolean> {
  // Apply to local cache immediately (optimistic update)
  const prev = getLocalOrder();
  saveLocalOrder(order);

  try {
    const res = await fetch('/api/template-order', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ order }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      saveLocalOrder(prev);
      throw new Error(data.error || '保存排序失败，请稍后重试');
    }

    const data = await res.json();
    if (data.success) {
      saveLocalOrder(data.order || order);
    }
  } catch (err) {
    if (err instanceof TypeError) {
      // Network failure - keep optimistic local cache (backend unreachable)
      console.warn('Backend unreachable, kept local cache only:', err);
    } else {
      throw err;
    }
  }

  return true;
}

// Update a builtin template's visibility state (hide/unpublish or delete)
export async function setBuiltinTemplateState(
  templateId: string,
  state: { hidden?: boolean; deleted?: boolean }
): Promise<boolean> {
  // Apply to local cache immediately (optimistic update)
  const prev = getLocalBuiltinOverrides();
  const next: BuiltinOverrides = {
    hiddenIds: [...prev.hiddenIds],
    deletedIds: [...prev.deletedIds],
  };
  if (state.deleted === true) {
    if (!next.deletedIds.includes(templateId)) next.deletedIds.push(templateId);
    next.hiddenIds = next.hiddenIds.filter((id) => id !== templateId);
  } else if (state.hidden === true) {
    if (!next.hiddenIds.includes(templateId)) next.hiddenIds.push(templateId);
  } else if (state.hidden === false) {
    next.hiddenIds = next.hiddenIds.filter((id) => id !== templateId);
  }
  saveLocalBuiltinOverrides(next);

  try {
    const res = await fetch('/api/templates/builtin-state', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ id: templateId, ...state }),
    });

    if (!res.ok) {
      // Server refused (e.g. library would become empty) - roll back local cache
      const data = await res.json().catch(() => ({}));
      saveLocalBuiltinOverrides(prev);
      throw new Error(data.error || '操作失败，请稍后重试');
    }

    const data = await res.json();
    if (data.success) {
      saveLocalBuiltinOverrides(data.overrides || next);
    }
  } catch (err) {
    if (err instanceof TypeError) {
      // Network failure - keep optimistic local cache (backend unreachable)
      console.warn('Backend unreachable, kept local cache only:', err);
    } else {
      throw err;
    }
  }

  return true;
}

// Save or Update a DIY template
export async function saveDiyTemplate(template: Template): Promise<Template> {
  // Update local cache immediately
  const localList = getLocalDiyTemplates();
  const existingIdx = localList.findIndex((t) => t.id === template.id);
  if (existingIdx >= 0) {
    localList[existingIdx] = template;
  } else {
    localList.unshift(template);
  }
  saveLocalDiyTemplates(localList);

  try {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(template),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.template) {
        return data.template;
      }
    }

    // 服务器明确拒绝（401/400/500 等）：必须抛错让管理员看到，绝不能假装保存成功
    if (res.status === 401) {
      throw new Error('登录态已失效：请退出登录后重新登录，再保存');
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '保存模板失败，请稍后重试');
  } catch (err) {
    if (err instanceof TypeError) {
      // 网络不可达：保留本地缓存兜底（后端恢复后需重新保存同步）
      console.warn('Backend unreachable, saved to local cache only:', err);
      return template;
    }
    throw err;
  }
}

// 拉取模板全部 upload 型图片选项的 dataUrl（禁止写 localStorage —— 图片数据体积红线）
// fresh=true 绕过边缘缓存（管理端刚保存图片后回显用）
export async function fetchTemplateImages(templateId: string, fresh = false): Promise<Record<string, string>> {
  try {
    const res = await fetch(
      `/api/templates/${encodeURIComponent(templateId)}/images${fresh ? `?ts=${Date.now()}` : ''}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.images && typeof data.images === 'object') {
        return data.images as Record<string, string>;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch template images:', err);
  }
  return {};
}

// 拉取模板背景图 dataUrl（模板 JSON 已剥离背景，渲染时按需拉取；不写 localStorage）
export async function fetchTemplateBackground(templateId: string, fresh = false): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/templates/${encodeURIComponent(templateId)}/bg${fresh ? `?ts=${Date.now()}` : ''}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.success && typeof data.bg === 'string' && data.bg.length > 0) {
        return data.bg;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch template background:', err);
  }
  return null;
}

// 上传/删除模板图片选项 dataUrl（按累计 ≤1.5MB 分块，deleteIds 随最后一个 chunk 提交）
export async function saveTemplateImages(
  templateId: string,
  images: Record<string, string>,
  deleteIds: string[] = []
): Promise<void> {
  const CHUNK_BYTES = 1.5 * 1024 * 1024;

  const entries = Object.entries(images);
  const chunks: Record<string, string>[] = [];
  let current: Record<string, string> = {};
  let size = 0;
  for (const [optionId, dataUrl] of entries) {
    if (size + dataUrl.length > CHUNK_BYTES && Object.keys(current).length > 0) {
      chunks.push(current);
      current = {};
      size = 0;
    }
    current[optionId] = dataUrl;
    size += dataUrl.length;
  }
  if (Object.keys(current).length > 0) {
    chunks.push(current);
  }
  if (chunks.length === 0) {
    chunks.push({}); // 仅有 deleteIds 的请求也要发一次
  }

  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const body = { images: chunks[i], deleteIds: isLast ? deleteIds : [] };
    const res = await fetch(`/api/templates/${encodeURIComponent(templateId)}/images`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || '图片上传失败，请重试');
    }
  }
}

// Delete a DIY template
export async function deleteDiyTemplate(templateId: string): Promise<boolean> {
  // Remove from local cache
  const localList = getLocalDiyTemplates().filter((t) => t.id !== templateId);
  saveLocalDiyTemplates(localList);

  try {
    const res = await fetch(`/api/templates/${templateId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return !!data.success;
    }
  } catch (err) {
    console.warn('Backend delete failed, updated local cache only:', err);
  }

  return true;
}

// Admin Auth: Get current session
export function getSavedAdminSession(): AdminUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ADMIN_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read admin session:', e);
  }
  return null;
}

// Admin Auth: Save session
export function saveAdminSession(admin: AdminUser | null) {
  try {
    if (admin) {
      localStorage.setItem(LOCAL_STORAGE_ADMIN_KEY, JSON.stringify(admin));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_ADMIN_KEY);
    }
  } catch (e) {
    console.error('Failed to update admin session:', e);
  }
}

// Admin Auth: attach the saved session token to mutating API requests
function authHeaders(): Record<string, string> {
  const session = getSavedAdminSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }
  return headers;
}

// Admin Login
export async function loginAdmin(username: string, password: string): Promise<AdminUser> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || '登录失败，请检查账号与密码');
    }

    const session: AdminUser = {
      username: data.admin.username,
      role: data.admin.role,
      permissions: data.admin.permissions,
      createdAt: data.admin.createdAt,
      token: data.token,
    };
    saveAdminSession(session);
    return session;
  } catch (err: any) {
    if (err instanceof TypeError) {
      throw new Error('无法连接服务器，请检查网络后重试');
    }
    throw err;
  }
}

// Admin Register
export async function registerAdmin(username: string, password: string): Promise<AdminUser> {
  if (!getSavedAdminSession()?.token) {
    throw new Error('注册新管理员需先以超级管理员身份登录');
  }
  try {
    const res = await fetch('/api/admin/register', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || '注册失败，请更换用户名重试');
    }

    const session: AdminUser = {
      username: data.admin.username,
      role: data.admin.role,
      permissions: data.admin.permissions,
      createdAt: data.admin.createdAt,
      token: data.token,
    };
    saveAdminSession(session);
    return session;
  } catch (err: any) {
    console.error('Register error:', err);
    throw err;
  }
}

// Get all administrators list (for Super Admin)
export async function getAdminUsers(): Promise<AdminUser[]> {
  try {
    const res = await fetch('/api/admin/users', { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        return data.users;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch admin users:', err);
  }

  // Fallback defaults
  return [
    {
      username: 'zhangxiyu',
      role: 'super_admin',
      permissions: { canEditOthers: true, canPublishOthers: true, canDeleteOthers: true },
    },
    {
      username: 'admin',
      role: 'admin',
      permissions: { canEditOthers: false, canPublishOthers: false, canDeleteOthers: false },
    },
  ];
}

// Update admin role and permissions (Super Admin operation)
export async function updateAdminRoleAndPermissions(
  targetUsername: string,
  role: 'super_admin' | 'senior_admin' | 'admin',
  permissions?: { canEditOthers?: boolean; canPublishOthers?: boolean; canDeleteOthers?: boolean }
): Promise<AdminUser[]> {
  const res = await fetch('/api/admin/users/update-role', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ targetUsername, role, permissions }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '更新权限失败，请重试');
  }

  return data.users;
}

// Create new admin account directly
export async function createAdminUser(
  username: string,
  password: string,
  role: 'super_admin' | 'senior_admin' | 'admin' = 'admin'
): Promise<AdminUser[]> {
  const res = await fetch('/api/admin/users/create', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ username, password, role }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '创建管理员失败，请重试');
  }

  return data.users;
}

// Delete admin account
export async function deleteAdminUser(username: string): Promise<AdminUser[]> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '删除管理员失败');
  }

  return data.users;
}

// Assign specific template IDs to an admin
export async function assignTemplatesToAdmin(
  targetUsername: string,
  templateIds: string[]
): Promise<AdminUser[]> {
  const res = await fetch('/api/admin/users/assign-templates', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ targetUsername, templateIds }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '分配模板权限失败，请重试');
  }

  return data.users;
}

// Assign allowed admin editors to a specific template
export async function assignEditorsToTemplate(
  templateId: string,
  allowedEditors: string[]
): Promise<{ template: Template; templates: Template[] }> {
  const res = await fetch('/api/templates/assign-editors', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ templateId, allowedEditors }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || '设置模板专属管理员失败');
  }

  return {
    template: data.template,
    templates: data.templates,
  };
}

