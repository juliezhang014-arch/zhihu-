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
export async function getAllTemplates(): Promise<Template[]> {
  try {
    const res = await fetch('/api/templates');
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.template) {
        return data.template;
      }
    }
  } catch (err) {
    console.warn('Backend save failed, saved to local cache only:', err);
  }

  return template;
}

// Delete a DIY template
export async function deleteDiyTemplate(templateId: string): Promise<boolean> {
  // Remove from local cache
  const localList = getLocalDiyTemplates().filter((t) => t.id !== templateId);
  saveLocalDiyTemplates(localList);

  try {
    const res = await fetch(`/api/templates/${templateId}`, {
      method: 'DELETE',
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

// Admin Login
export async function loginAdmin(username: string, password: string): Promise<AdminUser> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    // Offline local fallback check for zhangxiyu or admin
    const cleanUser = username.trim().toLowerCase();
    if (cleanUser === 'zhangxiyu' && (password === '123456' || password === 'zhangxiyu123')) {
      const fallbackSession: AdminUser = {
        username: 'zhangxiyu',
        role: 'super_admin',
        permissions: {
          canEditOthers: true,
          canPublishOthers: true,
          canDeleteOthers: true,
        },
        token: `offline_token_${Date.now()}`,
      };
      saveAdminSession(fallbackSession);
      return fallbackSession;
    }

    if (cleanUser === 'admin' && password === 'admin123') {
      const fallbackSession: AdminUser = {
        username: 'admin',
        role: 'admin',
        permissions: {
          canEditOthers: false,
          canPublishOthers: false,
          canDeleteOthers: false,
        },
        token: `offline_token_${Date.now()}`,
      };
      saveAdminSession(fallbackSession);
      return fallbackSession;
    }
    throw err;
  }
}

// Admin Register
export async function registerAdmin(username: string, password: string): Promise<AdminUser> {
  try {
    const res = await fetch('/api/admin/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch('/api/admin/users');
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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

