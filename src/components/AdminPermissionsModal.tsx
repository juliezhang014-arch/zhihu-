import React, { useState, useEffect } from 'react';
import {
  Shield,
  Crown,
  UserCheck,
  User,
  X,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Search,
  Key,
  ShieldCheck,
  Sparkles,
  Lock,
  Unlock,
  SlidersHorizontal,
  ChevronRight,
  Layers,
  ArrowLeft,
  KeyRound,
  Loader2,
  RotateCcw,
  Rocket,
} from 'lucide-react';
import { AdminUser, AdminRole, Template } from '../types';
import {
  getAdminUsers,
  updateAdminRoleAndPermissions,
  createAdminUser,
  deleteAdminUser,
  assignTemplatesToAdmin,
  resetAdminPassword,
  resetAdminPasswordToDefault,
} from '../services/api';

interface AdminPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AdminUser;
  templates?: Template[];
  onAdminUpdated?: (updatedList: AdminUser[]) => void;
  onRefreshTemplates?: () => void;
}

export const AdminPermissionsModal: React.FC<AdminPermissionsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  templates = [],
  onAdminUpdated,
  onRefreshTemplates,
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AdminRole>('all');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New admin form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('admin');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Sub-view: Template Assignment for a specific Admin
  const [editingTargetAdmin, setEditingTargetAdmin] = useState<AdminUser | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('all');
  const [isSavingTemplates, setIsSavingTemplates] = useState(false);

  // 重置密码行内表单状态（超管重置他人密码，忘记密码兜底）
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // 初始化密码行内确认状态（超管一键恢复默认密码 admin123，登录前忘记密码兜底）
  const [initTarget, setInitTarget] = useState<string | null>(null);
  const [initError, setInitError] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);

  const isSuperAdmin =
    currentUser.username.trim().toLowerCase() === 'zhangxiyu' ||
    currentUser.role === 'super_admin';

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => {
      setStatusMsg(null);
    }, 3500);
  };

  // 超管重置目标管理员密码：成功后目标账号全部会话失效（后端 pv+1）
  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetError('');
    if (resetPwd.length < 6 || resetPwd.length > 64) {
      setResetError('密码长度需在 6~64 位之间');
      return;
    }
    setIsResetting(true);
    try {
      await resetAdminPassword(resetTarget, resetPwd);
      showToast('success', `已重置管理员「${resetTarget}」的密码`);
      setResetTarget(null);
      setResetPwd('');
    } catch (err: any) {
      setResetError(err.message || '重置失败，请重试');
    } finally {
      setIsResetting(false);
    }
  };

  // 超管一键初始化目标管理员密码为默认值 admin123：成功后目标账号全部会话失效（后端 pv+1）
  const handleInitDefaultPassword = async () => {
    if (!initTarget) return;
    setInitError('');
    setIsInitializing(true);
    try {
      await resetAdminPasswordToDefault(initTarget);
      showToast('success', `已将管理员「${initTarget}」的密码初始化为默认值 admin123`);
      setInitTarget(null);
    } catch (err: any) {
      setInitError(err.message || '初始化失败，请重试');
    } finally {
      setIsInitializing(false);
    }
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const list = await getAdminUsers();
      setUsers(list);
      if (onAdminUpdated) onAdminUpdated(list);
    } catch (err: any) {
      showToast('error', '加载管理员列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle role switch or permission toggle
  const handleRoleChange = async (targetUsername: string, targetRole: AdminRole) => {
    try {
      const existingUser = users.find((u) => u.username.toLowerCase() === targetUsername.toLowerCase());
      const perms =
        targetRole === 'super_admin' || targetRole === 'senior_admin'
          ? {
              canEditOthers: true,
              canPublishOthers: true,
              canDeleteOthers: true,
              canPublish: true,
              allowedTemplateIds: existingUser?.permissions?.allowedTemplateIds || [],
            }
          : {
              canEditOthers: false,
              canPublishOthers: false,
              canDeleteOthers: false,
              canPublish: false,
              allowedTemplateIds: existingUser?.permissions?.allowedTemplateIds || [],
            };

      const updated = await updateAdminRoleAndPermissions(targetUsername, targetRole, perms);
      setUsers(updated);
      if (onAdminUpdated) onAdminUpdated(updated);
      showToast('success', `已将「${targetUsername}」权限更新为 ${getRoleDisplayName(targetRole)}！`);
    } catch (err: any) {
      showToast('error', err.message || '更新权限失败');
    }
  };

  const handlePermissionToggle = async (
    targetUser: AdminUser,
    permKey: 'canEditOthers' | 'canPublishOthers' | 'canDeleteOthers' | 'canPublish'
  ) => {
    if (targetUser.username.trim().toLowerCase() === 'zhangxiyu') {
      showToast('error', '超管 zhangxiyu 拥有所有权限，无需单独调整');
      return;
    }

    const currentPerms = targetUser.permissions || {};
    const newPerms = {
      ...currentPerms,
      [permKey]: !currentPerms[permKey],
    };

    // Auto determine role based on canEditOthers
    let newRole: AdminRole = targetUser.role || 'admin';
    if (newPerms.canEditOthers && newRole === 'admin') {
      newRole = 'senior_admin';
    } else if (!newPerms.canEditOthers && newRole === 'senior_admin') {
      newRole = 'admin';
    }

    try {
      const updated = await updateAdminRoleAndPermissions(targetUser.username, newRole, newPerms);
      setUsers(updated);
      if (onAdminUpdated) onAdminUpdated(updated);
      showToast('success', `已更新「${targetUser.username}」的细分权限`);
    } catch (err: any) {
      showToast('error', err.message || '更新权限失败');
    }
  };

  const handleOpenTemplateAssignment = (targetUser: AdminUser) => {
    setEditingTargetAdmin(targetUser);
    const existing = targetUser.permissions?.allowedTemplateIds || [];
    setSelectedTemplateIds(existing);
    setTemplateSearchQuery('');
    setTemplateCategoryFilter('all');
  };

  const handleToggleTemplate = (templateId: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId) ? prev.filter((id) => id !== templateId) : [...prev, templateId]
    );
  };

  const handleSaveTemplateAssignment = async () => {
    if (!editingTargetAdmin) return;
    setIsSavingTemplates(true);
    try {
      const updatedList = await assignTemplatesToAdmin(
        editingTargetAdmin.username,
        selectedTemplateIds
      );
      setUsers(updatedList);
      if (onAdminUpdated) onAdminUpdated(updatedList);
      if (onRefreshTemplates) onRefreshTemplates();
      showToast(
        'success',
        `已成功为「${editingTargetAdmin.username}」指定开放 ${selectedTemplateIds.length} 个模板的编辑权限！`
      );
      setEditingTargetAdmin(null);
    } catch (err: any) {
      showToast('error', err.message || '保存模板分配失败');
    } finally {
      setIsSavingTemplates(false);
    }
  };

  const handleCreateNewAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      showToast('error', '请输入管理员用户名');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      showToast('error', '密码长度至少为 4 位');
      return;
    }

    setIsSubmittingNew(true);
    try {
      const updated = await createAdminUser(newUsername.trim(), newPassword, newRole);
      setUsers(updated);
      if (onAdminUpdated) onAdminUpdated(updated);
      showToast('success', `成功创建管理员「${newUsername}」！`);
      setNewUsername('');
      setNewPassword('');
      setNewRole('admin');
      setShowAddForm(false);
    } catch (err: any) {
      showToast('error', err.message || '创建管理员失败');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username.trim().toLowerCase() === 'zhangxiyu') {
      showToast('error', '无法删除超级管理员账号');
      return;
    }
    if (username.trim().toLowerCase() === currentUser.username.trim().toLowerCase()) {
      showToast('error', '无法在当前登录会话中删除自己的账号');
      return;
    }

    if (!confirm(`确定要注销管理员账号「${username}」吗？`)) return;

    try {
      const updated = await deleteAdminUser(username);
      setUsers(updated);
      if (onAdminUpdated) onAdminUpdated(updated);
      showToast('success', `已删除管理员「${username}」`);
    } catch (err: any) {
      showToast('error', err.message || '删除失败');
    }
  };

  const getRoleDisplayName = (role?: AdminRole) => {
    switch (role) {
      case 'super_admin':
        return '超级管理员';
      case 'senior_admin':
        return '高级管理员';
      case 'admin':
      default:
        return '普通管理员';
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.username.toLowerCase().includes(searchQuery.toLowerCase().trim());
    if (!matchesSearch) return false;
    if (roleFilter === 'all') return true;
    const userRole = u.username.trim().toLowerCase() === 'zhangxiyu' ? 'super_admin' : (u.role || 'admin');
    return userRole === roleFilter;
  });

  const allCategories = ['all', ...Array.from(new Set(templates.map((t) => t.category || '热门模版')))];

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(templateSearchQuery.toLowerCase().trim()) ||
      (t.author && t.author.toLowerCase().includes(templateSearchQuery.toLowerCase().trim()));
    if (!matchesSearch) return false;
    if (templateCategoryFilter !== 'all' && t.category !== templateCategoryFilter) return false;
    return true;
  });

  if (!isOpen || !isSuperAdmin) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-pink-100 max-w-4xl w-full max-h-[90vh] flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-5 bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
              {editingTargetAdmin ? (
                <Key className="w-5 h-5 text-amber-200" />
              ) : (
                <Crown className="w-5 h-5 text-amber-200 animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">
                  {editingTargetAdmin
                    ? `为「${editingTargetAdmin.username}」指定开放模板权限`
                    : '管理员权限配置中心'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/30 text-amber-100 border border-amber-300/40">
                  超管专属权限
                </span>
              </div>
              <p className="text-xs text-pink-100 mt-0.5">
                {editingTargetAdmin
                  ? '选中的模板将直接开放给该管理员进行二次编辑与发布更新'
                  : `当前登录超管: ${currentUser.username} · 管理员角色分配、全局权限与单模板指定授权`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editingTargetAdmin && (
              <button
                type="button"
                onClick={() => setEditingTargetAdmin(null)}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>返回列表</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Floating Toast inside modal */}
        {statusMsg && (
          <div className="absolute top-20 right-6 z-50 animate-in fade-in slide-in-from-top-2">
            <div
              className={`px-4 py-2 rounded-xl shadow-lg border flex items-center gap-2 text-xs font-semibold ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          </div>
        )}

        {/* --- VIEW 1: Assign Specific Templates Sub-view --- */}
        {editingTargetAdmin ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
            {/* Action Bar */}
            <div className="p-4 px-6 bg-white border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="按模板名称或作者筛选..."
                    value={templateSearchQuery}
                    onChange={(e) => setTemplateSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-rose-400 focus:bg-white"
                  />
                </div>

                <select
                  value={templateCategoryFilter}
                  onChange={(e) => setTemplateCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-rose-400"
                >
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? '全部分类' : cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedTemplateIds(templates.map((t) => t.id))}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  全选所有模板
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTemplateIds([])}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  清空
                </button>
              </div>
            </div>

            {/* Template Cards Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredTemplates.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">未找到匹配的模板</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredTemplates.map((tpl) => {
                    const isSelected = selectedTemplateIds.includes(tpl.id);
                    const isOwner = tpl.author?.trim().toLowerCase() === editingTargetAdmin.username.trim().toLowerCase();

                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleToggleTemplate(tpl.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-300 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-amber-200 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Thumbnail / Aspect Preview */}
                          <div className="w-12 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 relative flex items-center justify-center">
                            {tpl.bgImageUrl ? (
                              <img
                                src={tpl.bgImageUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center text-[10px] text-rose-500 font-bold">
                                DIY
                              </div>
                            )}
                            {tpl.isPublished && (
                              <span className="absolute bottom-0 inset-x-0 bg-emerald-600/90 text-white text-[8px] text-center font-bold py-0.5">
                                已发布
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs text-slate-800 truncate" title={tpl.name}>
                                {tpl.name}
                              </span>
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                                  isSelected
                                    ? 'bg-amber-500 border-amber-500 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-600">
                                {tpl.category || '热门模版'}
                              </span>
                              <span className="text-[10px] text-slate-400">{tpl.slots?.length || 0} 个槽位</span>
                            </div>

                            <div className="mt-1.5 text-[10px] text-slate-400 truncate">
                              作者: <span className="font-medium text-slate-600">{tpl.author || '系统'}</span>
                              {isOwner && (
                                <span className="ml-1 text-pink-600 font-bold">(该管理员本人)</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center justify-between text-[10px] text-amber-800 font-semibold">
                            <span className="flex items-center gap-1">
                              <Key className="w-3 h-3 text-amber-600" /> 已对该管理员开放
                            </span>
                            <span className="text-amber-600">可直接编辑</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sub-view Footer */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-600">
                已为「<span className="font-bold text-slate-800">{editingTargetAdmin.username}</span>」勾选{' '}
                <span className="font-bold text-amber-600 text-sm">{selectedTemplateIds.length}</span> 个指定模板
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingTargetAdmin(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={isSavingTemplates}
                  onClick={handleSaveTemplateAssignment}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-bold rounded-xl shadow-xs shadow-rose-200 cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingTemplates ? (
                    <span>正在保存中...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>保存指定模板开放权限</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* --- VIEW 2: General Admin List & Role Manager --- */
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Permission Rules Notice */}
            <div className="bg-amber-50/80 rounded-2xl border border-amber-200 p-4 text-xs text-amber-900 flex items-start gap-3 shadow-2xs">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-slate-800">📋 管理员权限分级说明与运作机制：</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-slate-600 mt-2">
                  <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100">
                    <div className="font-bold text-amber-700 flex items-center gap-1 mb-1">
                      <Crown className="w-3.5 h-3.5" /> 1. 超级管理员 (超管: zhangxiyu)
                    </div>
                    <span>拥有全局最高权限，可编辑、发布、下架、删除任意模板，并可在此处为其他管理员授权与分配权限。</span>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100">
                    <div className="font-bold text-indigo-700 flex items-center gap-1 mb-1">
                      <Shield className="w-3.5 h-3.5" /> 2. 高级管理员 (Senior Admin)
                    </div>
                    <span>由超管单独开通权限。除了管理自身模板外，<strong>也能编辑、发布与下架他人创建的模板</strong>。</span>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100">
                    <div className="font-bold text-emerald-700 flex items-center gap-1 mb-1">
                      <User className="w-3.5 h-3.5" /> 3. 普通管理员 + 指定模板开放
                    </div>
                    <span>
                      默认仅限本人模板（保存为草稿，不能上线前台）。<strong>超管可点击「指定开放模板」放开指定模板的修改权限，并单独授予「上线模板」权限让其发布到前台</strong>。
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="搜索管理员账号..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-400 focus:bg-white transition-colors"
                  />
                </div>

                {/* Role filter buttons */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setRoleFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      roleFilter === 'all' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    全部 ({users.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('senior_admin')}
                    className={`px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      roleFilter === 'senior_admin' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    高级管理员
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('admin')}
                    className={`px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      roleFilter === 'admin' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    普通管理员
                  </button>
                </div>
              </div>

              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-xs font-semibold rounded-xl shadow-xs shadow-rose-200 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showAddForm ? '收起创建面板' : '直接添加新管理员'}</span>
                </button>
              )}
            </div>

            {/* Quick Create Admin Form */}
            {showAddForm && (
              <form
                onSubmit={handleCreateNewAdmin}
                className="p-4 bg-pink-50/60 rounded-2xl border border-pink-200 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                    <span>添加管理员账号并直接设定权限</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    取消
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">用户名/账号</label>
                    <input
                      type="text"
                      required
                      placeholder="输入用户名"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-pink-200 rounded-xl text-xs focus:outline-none focus:border-rose-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">初始密码</label>
                    <input
                      type="password"
                      required
                      placeholder="至少 4 位"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-pink-200 rounded-xl text-xs focus:outline-none focus:border-rose-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">赋予初始角色</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as AdminRole)}
                      className="w-full px-3 py-2 bg-white border border-pink-200 rounded-xl text-xs focus:outline-none focus:border-rose-400 cursor-pointer"
                    >
                      <option value="admin">普通管理员 (仅限自身模板)</option>
                      <option value="senior_admin">高级管理员 (可编辑他人模板)</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingNew}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingNew ? '正在创建...' : '确认创建并保存'}
                  </button>
                </div>
              </form>
            )}

            {/* Admin User Cards / List */}
            <div className="space-y-3">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/60 text-slate-400 text-xs">
                  未找到匹配的管理员账号
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isZhangxiyu = u.username.trim().toLowerCase() === 'zhangxiyu';
                  const userRole = isZhangxiyu ? 'super_admin' : (u.role || 'admin');
                  const canEditOthers = isZhangxiyu || userRole === 'senior_admin' || u.permissions?.canEditOthers === true;
                  const canPublishOthers = isZhangxiyu || userRole === 'senior_admin' || u.permissions?.canPublishOthers === true;
                  const canDeleteOthers = isZhangxiyu || userRole === 'senior_admin' || u.permissions?.canDeleteOthers === true;
                  const allowedTemplateCount = u.permissions?.allowedTemplateIds?.length || 0;

                  return (
                    <React.Fragment key={u.username}>
                    <div
                      className={`bg-white rounded-2xl border transition-all p-4.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                        isZhangxiyu
                          ? 'border-amber-300 bg-gradient-to-r from-amber-50/40 via-white to-pink-50/30 shadow-xs'
                          : userRole === 'senior_admin'
                          ? 'border-indigo-200 hover:border-indigo-300 shadow-2xs'
                          : 'border-slate-200 hover:border-pink-200 shadow-2xs'
                      }`}
                    >
                      {/* User Info Col */}
                      <div className="flex items-center gap-3.5 min-w-[200px]">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm ${
                            isZhangxiyu
                              ? 'bg-gradient-to-br from-amber-400 to-rose-500 ring-2 ring-amber-200'
                              : userRole === 'senior_admin'
                              ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                              : 'bg-gradient-to-br from-slate-400 to-slate-600'
                          }`}
                        >
                          {isZhangxiyu ? (
                            <Crown className="w-5 h-5" />
                          ) : userRole === 'senior_admin' ? (
                            <ShieldCheck className="w-5 h-5" />
                          ) : (
                            <User className="w-5 h-5" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">{u.username}</span>
                            {isZhangxiyu ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md border border-amber-300 flex items-center gap-0.5">
                                <Crown className="w-3 h-3 text-amber-600" /> 超级管理员 (超管)
                              </span>
                            ) : userRole === 'senior_admin' ? (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md border border-indigo-200 flex items-center gap-0.5">
                                <Shield className="w-3 h-3 text-indigo-600" /> 高级管理员 (全局)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-md border border-slate-200">
                                普通管理员
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span>
                              {isZhangxiyu
                                ? '系统最高决策账号'
                                : canEditOthers
                                ? '权限范围: 可编辑发布所有模板'
                                : `权限范围: 本人模板 ${allowedTemplateCount > 0 ? `+ 指定开放 ${allowedTemplateCount} 个模板` : ''}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Permissions Detail Switch & Badges */}
                      <div className="flex-1 flex flex-wrap items-center gap-2.5 lg:justify-center">
                        {/* Specific Template Grant Button for non-super admin */}
                        {!isZhangxiyu && (
                          <button
                            type="button"
                            onClick={() => handleOpenTemplateAssignment(u)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                              allowedTemplateCount > 0
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border-amber-300'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                            title="指定开放特定模板给该管理员编辑"
                          >
                            <Key className="w-3.5 h-3.5 text-amber-600" />
                            <span>指定开放模板</span>
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                allowedTemplateCount > 0
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {allowedTemplateCount}
                            </span>
                          </button>
                        )}

                        <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/80 text-xs">
                          {userRole !== 'senior_admin' && (
                            <button
                              type="button"
                              disabled={isZhangxiyu}
                              onClick={() => handlePermissionToggle(u, 'canPublish')}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
                                isZhangxiyu
                                  ? 'opacity-80 cursor-default bg-amber-100 text-amber-900 font-semibold'
                                  : u.permissions?.canPublish === true
                                  ? 'bg-sky-500 text-white font-bold shadow-2xs cursor-pointer'
                                  : 'text-slate-500 hover:text-slate-800 cursor-pointer'
                              }`}
                              title="开通后该管理员可将自己名下模板上线到前台（发布/下架）"
                            >
                              <Rocket className="w-3 h-3" />
                              <span>上线模板</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isZhangxiyu}
                            onClick={() => handlePermissionToggle(u, 'canEditOthers')}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
                              isZhangxiyu
                                ? 'opacity-80 cursor-default bg-amber-100 text-amber-900 font-semibold'
                                : canEditOthers
                                ? 'bg-rose-500 text-white font-bold shadow-2xs cursor-pointer'
                                : 'text-slate-500 hover:text-slate-800 cursor-pointer'
                            }`}
                            title="开通后可编辑任意其他管理员创建的模板"
                          >
                            {canEditOthers ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            <span>编辑他人模板</span>
                          </button>

                          <button
                            type="button"
                            disabled={isZhangxiyu}
                            onClick={() => handlePermissionToggle(u, 'canPublishOthers')}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
                              isZhangxiyu
                                ? 'opacity-80 cursor-default bg-amber-100 text-amber-900 font-semibold'
                                : canPublishOthers
                                ? 'bg-emerald-600 text-white font-bold shadow-2xs cursor-pointer'
                                : 'text-slate-500 hover:text-slate-800 cursor-pointer'
                            }`}
                            title="开通后可发布或下架任意其他管理员的模板"
                          >
                            {canPublishOthers ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            <span>发布/下架</span>
                          </button>

                          <button
                            type="button"
                            disabled={isZhangxiyu}
                            onClick={() => handlePermissionToggle(u, 'canDeleteOthers')}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
                              isZhangxiyu
                                ? 'opacity-80 cursor-default bg-amber-100 text-amber-900 font-semibold'
                                : canDeleteOthers
                                ? 'bg-purple-600 text-white font-bold shadow-2xs cursor-pointer'
                                : 'text-slate-500 hover:text-slate-800 cursor-pointer'
                            }`}
                            title="开通后可删除任意其他管理员的模板"
                          >
                            {canDeleteOthers ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            <span>删除</span>
                          </button>
                        </div>
                      </div>

                      {/* Role Quick Selector & Delete */}
                      <div className="flex items-center gap-2 shrink-0 justify-end">
                        {!isZhangxiyu ? (
                          <>
                            {userRole === 'admin' ? (
                              <button
                                type="button"
                                onClick={() => handleRoleChange(u.username, 'senior_admin')}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                                title="一键升级为高级管理员，获得全局编辑他人模板权限"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="hidden sm:inline">开通高级管理员</span>
                                <span className="sm:hidden">开通高级</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRoleChange(u.username, 'admin')}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                                title="降级为普通管理员，仅能修改自身模板或指定模板"
                              >
                                <User className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">恢复普通管理员</span>
                                <span className="sm:hidden">恢复普通</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setInitTarget(u.username);
                                setInitError('');
                                setResetTarget(null);
                                setResetPwd('');
                              }}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                              title="初始化密码（重置为默认值 admin123）"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setResetTarget(u.username);
                                setResetPwd('');
                                setResetError('');
                                setInitTarget(null);
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                              title="重置该管理员密码"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.username)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="注销此管理员账号"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                            👑 超管特权锁定
                          </span>
                        )}
                      </div>
                    </div>

                    {resetTarget === u.username && (
                      <div className="bg-white rounded-2xl border border-blue-300 p-4 shadow-2xs">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-2.5">
                          <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                          <span>重置「{resetTarget}」的登录密码</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            该管理员将被强制退出，需用新密码重新登录
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                          <input
                            type="password"
                            value={resetPwd}
                            onChange={(e) => {
                              setResetPwd(e.target.value);
                              setResetError('');
                            }}
                            placeholder="新密码（6~64 位）"
                            className="flex-1 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                            autoFocus
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setResetTarget(null);
                                setResetPwd('');
                                setResetError('');
                              }}
                              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              disabled={isResetting}
                              onClick={handleResetPassword}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {isResetting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <KeyRound className="w-3.5 h-3.5" />
                              )}
                              <span>{isResetting ? '重置中...' : '确认重置'}</span>
                            </button>
                          </div>
                        </div>
                        {resetError && (
                          <div className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{resetError}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {initTarget === u.username && (
                      <div className="bg-white rounded-2xl border border-amber-300 p-4 shadow-2xs">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1.5">
                          <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                          <span>初始化「{initTarget}」的登录密码</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-2.5">
                          该管理员可凭默认密码{' '}
                          <code className="px-1 py-0.5 bg-amber-50 border border-amber-200 rounded text-[10px] font-bold text-amber-800">
                            admin123
                          </code>{' '}
                          重新登录，其所有登录会话将立即失效。请提醒对方登录后尽快修改密码。
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setInitTarget(null)}
                            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            disabled={isInitializing}
                            onClick={handleInitDefaultPassword}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {isInitializing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            <span>{isInitializing ? '初始化中...' : '确认初始化'}</span>
                          </button>
                        </div>
                        {initError && (
                          <div className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{initError}</span>
                          </div>
                        )}
                      </div>
                    )}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Footer info */}
        {!editingTargetAdmin && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span>
              提示：支持全局角色授权，也支持点击「指定开放模板」按需为某管理员单独开通特定模板权限。
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl cursor-pointer transition-colors"
            >
              完成并返回
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

