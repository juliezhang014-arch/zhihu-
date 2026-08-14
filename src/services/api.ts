import { Template, AdminUser } from '../types';
import { BUILTIN_TEMPLATES } from '../data/templates';

const LOCAL_STORAGE_TEMPLATES_KEY = 'diy_templates_cache_v1';
const LOCAL_STORAGE_ADMIN_KEY = 'admin_session_cache_v1';

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
        saveLocalDiyTemplates(data.templates);
        return [...BUILTIN_TEMPLATES, ...data.templates];
      }
    }
  } catch (err) {
    console.warn('Could not fetch templates from backend, using local storage cache:', err);
  }

  // Fallback to local storage
  const localDiy = getLocalDiyTemplates();
  return [...BUILTIN_TEMPLATES, ...localDiy];
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

