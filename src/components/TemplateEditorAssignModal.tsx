import React, { useState, useEffect } from 'react';
import {
  Key,
  Crown,
  User,
  ShieldCheck,
  Check,
  X,
  Search,
  Users,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Template, AdminUser } from '../types';
import { getAdminUsers, assignEditorsToTemplate } from '../services/api';

interface TemplateEditorAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template | null;
  currentUser: AdminUser;
  onTemplateUpdated: (updatedTemplate: Template) => void;
}

export const TemplateEditorAssignModal: React.FC<TemplateEditorAssignModalProps> = ({
  isOpen,
  onClose,
  template,
  currentUser,
  onTemplateUpdated,
}) => {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (isOpen && template) {
      // Initialize with existing allowed editors
      const initialSelected = (template.allowedEditors || []).map((u) => u.trim());
      setSelectedUsernames(initialSelected);

      // Load all admin users
      setIsLoading(true);
      getAdminUsers()
        .then((users) => {
          setAdminUsers(users);
        })
        .catch((err) => {
          console.error(err);
          showToast('error', '加载管理员列表失败');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, template]);

  const isSuperAdmin =
    currentUser.username.trim().toLowerCase() === 'zhangxiyu' ||
    currentUser.role === 'super_admin';

  if (!isOpen || !template || !isSuperAdmin) return null;

  // Filter non-super admins (super admins always have access)
  const selectableAdmins = adminUsers.filter(
    (u) =>
      u.username.trim().toLowerCase() !== 'zhangxiyu' &&
      u.username.trim().toLowerCase() !== template.author?.trim().toLowerCase()
  );

  const filteredAdmins = selectableAdmins.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleToggleAdmin = (username: string) => {
    const trimmed = username.trim();
    setSelectedUsernames((prev) =>
      prev.includes(trimmed) ? prev.filter((u) => u !== trimmed) : [...prev, trimmed]
    );
  };

  const handleSelectAll = () => {
    setSelectedUsernames(selectableAdmins.map((u) => u.username.trim()));
  };

  const handleClearAll = () => {
    setSelectedUsernames([]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await assignEditorsToTemplate(template.id, selectedUsernames);
      onTemplateUpdated(res.template);
      showToast('success', `已成功为「${template.name}」授权 ${selectedUsernames.length} 位管理员！`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      showToast('error', err.message || '保存授权失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-amber-200/80 max-w-xl w-full max-h-[85vh] flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
              <Key className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">指定模板开放权限</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/30 text-amber-100 border border-amber-300/40">
                  超管授权
                </span>
              </div>
              <p className="text-xs text-pink-100 mt-0.5 line-clamp-1">
                目标模板: <span className="font-semibold text-white">「{template.name}」</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Floating Toast */}
        {toast && (
          <div className="absolute top-16 right-6 z-50 animate-in fade-in slide-in-from-top-2">
            <div
              className={`px-3.5 py-1.5 rounded-xl shadow-lg border flex items-center gap-2 text-xs font-semibold ${
                toast.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {toast.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{toast.text}</span>
            </div>
          </div>
        )}

        {/* Info Banner */}
        <div className="px-6 py-3 bg-amber-50/70 border-b border-amber-100 flex items-start gap-2.5 text-xs text-amber-900">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span>
              被勾选的普通管理员将获得此模板的<strong>直接二次编辑与发布权限</strong>
              ，无需克隆为新副本，便于针对特定模板协同维护。
            </span>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="搜索管理员用户名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              全选
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-500 font-medium rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              清空
            </button>
          </div>
        </div>

        {/* Admin List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">正在加载管理员列表...</div>
          ) : selectableAdmins.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500">
              暂无可授权的其他管理员账号（除超管及原作者外）
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">未找到匹配的管理员</div>
          ) : (
            filteredAdmins.map((u) => {
              const isSelected = selectedUsernames.includes(u.username.trim());
              const isSenior = u.role === 'senior_admin';

              return (
                <div
                  key={u.username}
                  onClick={() => handleToggleAdmin(u.username)}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50/60 border-amber-300 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${
                        isSenior
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                          : 'bg-gradient-to-br from-slate-400 to-slate-600'
                      }`}
                    >
                      {isSenior ? (
                        <ShieldCheck className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-xs">{u.username}</span>
                        {isSenior ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            高级管理员 (默认已有全局权限)
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                            普通管理员
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {isSelected ? '✓ 已指定允许编辑此模板' : '未授权（仅可克隆）'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            已勾选 <span className="font-bold text-amber-600">{selectedUsernames.length}</span> 位管理员
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-bold rounded-xl shadow-xs shadow-rose-200 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving ? (
                <span>正在保存...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>确认保存授权</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
