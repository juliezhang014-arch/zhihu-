import React, { useState, useRef, useEffect } from 'react';
import {
  Template,
  TextSlot,
  AdminUser,
} from '../types';
import {
  ImagePlus,
  Plus,
  Trash2,
  Save,
  Check,
  ArrowLeft,
  LogOut,
  Layout,
  Move,
  GripHorizontal,
  Sparkles,
  Eye,
  Copy,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  Maximize2,
  Send,
  EyeOff,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  RotateCcw,
  Filter,
  Loader2,
  ExternalLink,
  Crown,
  ShieldCheck,
  Shield,
  User,
  Lock,
  Unlock,
  Key,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  GripVertical,
  X,
} from 'lucide-react';
import { Reorder, useDragControls } from 'motion/react';
import {
  saveDiyTemplate,
  deleteDiyTemplate,
  setBuiltinTemplateState,
  saveTemplateOrder,
} from '../services/api';
import { AdminPermissionsModal } from './AdminPermissionsModal';
import { TemplateEditorAssignModal } from './TemplateEditorAssignModal';

interface OperationModalState {
  isOpen: boolean;
  mode: 'publish' | 'unpublish' | 'save' | 'delete';
  status: 'in_progress' | 'success' | 'error';
  title: string;
  progress: number;
  currentStep: string;
  templateName: string;
  templateCategory?: string;
  errorMessage?: string;
  targetTemplate?: Template;
  descriptionText?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface AdminPanelProps {
  admin: AdminUser;
  templates: Template[];
  onBackToApp: () => void;
  onLogout: () => void;
  onRefreshTemplates: () => Promise<void>;
  onSelectAndUseTemplate: (template: Template) => void;
}

const PRESET_TAG_COLORS = [
  { name: '玫瑰粉', bg: '#f43f5e', text: '#ffffff' },
  { name: '珊瑚粉', bg: '#fb7185', text: '#ffffff' },
  { name: '橙红', bg: '#f97316', text: '#ffffff' },
  { name: '活力黄', bg: '#eab308', text: '#ffffff' },
  { name: '薄荷绿', bg: '#10b981', text: '#ffffff' },
  { name: '海蓝', bg: '#0284c7', text: '#ffffff' },
  { name: '经典蓝', bg: '#2563eb', text: '#ffffff' },
  { name: '梦幻紫', bg: '#8b5cf6', text: '#ffffff' },
  { name: '暗黑', bg: '#1e293b', text: '#ffffff' },
];

const PRESET_TEXT_COLORS = [
  { name: '经典深黑', hex: '#1e293b' },
  { name: '纯净雪白', hex: '#ffffff' },
  { name: '高光绯红', hex: '#dc2626' },
  { name: '玫瑰亮粉', hex: '#f43f5e' },
  { name: '醒目暖金', hex: '#d97706' },
  { name: '明黄高光', hex: '#fdd937' },
  { name: '松石翠绿', hex: '#059669' },
  { name: '宝蓝深海', hex: '#1d4ed8' },
  { name: '天空淡蓝', hex: '#0284c7' },
  { name: '神秘典雅紫', hex: '#7c3aed' },
  { name: '暖心珊瑚橙', hex: '#f97316' },
  { name: '低调石板灰', hex: '#64748b' },
];

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface DragState {
  type: 'move' | 'resize';
  handle?: ResizeHandle;
  slotId: string;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialW: number;
  initialH: number;
}

// Sortable row for the template ordering view (drag handle + up/down arrows)
interface SortableRowProps {
  tpl: Template;
  index: number;
  count: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const SortableRow: React.FC<SortableRowProps> = ({ tpl, index, count, onMoveUp, onMoveDown }) => {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={tpl.id}
      dragListener={false}
      dragControls={controls}
      className="bg-white rounded-xl border border-pink-100 shadow-xs hover:border-pink-200 transition-colors"
    >
      <div className="flex items-center gap-3 p-3">
        {/* Drag handle */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            controls.start(e);
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 cursor-grab active:cursor-grabbing shrink-0"
          title="按住拖拽调整顺序"
        >
          <GripVertical className="w-5 h-5" />
        </button>

        {/* Order number */}
        <span className="w-7 text-center text-xs font-bold text-slate-400 shrink-0">#{index + 1}</span>

        {/* Thumbnail */}
        <div className="w-12 h-16 rounded-lg bg-pink-50 border border-pink-100 overflow-hidden shrink-0 flex items-center justify-center">
          {tpl.bgImageUrl ? (
            <img
              src={tpl.bgImageUrl}
              alt={tpl.name}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <Layout className="w-5 h-5 text-pink-300" />
          )}
        </div>

        {/* Name & status */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{tpl.name}</p>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white border border-pink-100 text-slate-600">
              {tpl.category}
            </span>
            {tpl.isPublished !== false ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white">
                已发布
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">
                草稿
              </span>
            )}
          </div>
        </div>

        {/* Up / Down arrows */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="上移一位"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === count - 1}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="下移一位"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Reorder.Item>
  );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  admin,
  templates,
  onBackToApp,
  onLogout,
  onRefreshTemplates,
  onSelectAndUseTemplate,
}) => {
  // Tabs: 'workshop' (DIY Studio) | 'list' (Template Manager) - Default to 'list' (已发布模板库)
  const [activeTab, setActiveTab] = useState<'workshop' | 'list'>('list');

  // Filter category in Template Library list
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Current admin session user & permissions modal
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser>(admin);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [assigningTemplate, setAssigningTemplate] = useState<Template | null>(null);

  // Template ordering mode (super admin only)
  const [isSortMode, setIsSortMode] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  useEffect(() => {
    setCurrentAdmin(admin);
  }, [admin]);

  // Role and permission evaluation
  const isSuperAdmin =
    currentAdmin.username.trim().toLowerCase() === 'zhangxiyu' ||
    currentAdmin.role === 'super_admin';

  const canEditOthers =
    isSuperAdmin ||
    currentAdmin.role === 'senior_admin' ||
    currentAdmin.permissions?.canEditOthers === true;

  const canPublishOthers =
    isSuperAdmin ||
    currentAdmin.role === 'senior_admin' ||
    currentAdmin.permissions?.canPublishOthers === true;

  const canDeleteOthers =
    isSuperAdmin ||
    currentAdmin.role === 'senior_admin' ||
    currentAdmin.permissions?.canDeleteOthers === true;

  const isTemplateOwner = (tpl: Template) => {
    if (!tpl.author) return true;
    return tpl.author.trim().toLowerCase() === currentAdmin.username.trim().toLowerCase();
  };

  const isExplicitlyGranted = (tpl: Template) => {
    if (
      currentAdmin.permissions?.allowedTemplateIds &&
      currentAdmin.permissions.allowedTemplateIds.includes(tpl.id)
    ) {
      return true;
    }
    if (
      tpl.allowedEditors &&
      tpl.allowedEditors.some(
        (u) => u.trim().toLowerCase() === currentAdmin.username.trim().toLowerCase()
      )
    ) {
      return true;
    }
    return false;
  };

  const hasEditPermission = (tpl: Template) =>
    isSuperAdmin || canEditOthers || isTemplateOwner(tpl) || isExplicitlyGranted(tpl);
  const hasPublishPermission = (tpl: Template) =>
    isSuperAdmin || canPublishOthers || isTemplateOwner(tpl) || isExplicitlyGranted(tpl);
  const hasDeletePermission = (tpl: Template) =>
    isSuperAdmin || canDeleteOthers || isTemplateOwner(tpl);

  // DIY clones may inherit isBuiltin from the source template - only templates that are
  // builtin AND not DIY copies count as true builtin templates
  const isTrueBuiltin = (tpl: Template) => !!tpl.isBuiltin && !tpl.isCustomDiy;

  // Currently editing template in Workshop
  const [editingTemplate, setEditingTemplate] = useState<Template>(() => {
    return {
      id: `diy-${Date.now()}`,
      name: '我的全新 DIY 模板',
      category: '热门模版',
      description: '',
      aspectRatio: 0.75,
      width: 1125,
      height: 1500,
      bgType: 'image',
      bgImageUrl: 'https://picx.zhimg.com/v2-01d4b4d0a7a64017638b4f6936e243b0.png',
      defaultFontId: 'zcool-kuaile',
      defaultColor: '#1e293b',
      isCustomDiy: true,
      isPublished: false,
      author: admin.username,
      slots: [
        {
          id: 'slot-1',
          label: '主标题',
          placeholder: '例如：输入核心文案...',
          value: '',
          x: 25.0,
          y: 38.0,
          width: 55.0,
          height: 8.0,
          align: 'left',
          fontSize: 28,
          color: '#1e293b',
          tagBgColor: '#f43f5e',
          tagTextColor: '#ffffff',
          locked: true,
        },
        {
          id: 'slot-2',
          label: '内容说明',
          placeholder: '例如：输入详细描述...',
          value: '',
          x: 25.0,
          y: 50.0,
          width: 55.0,
          height: 8.0,
          align: 'left',
          fontSize: 26,
          color: '#1e293b',
          tagBgColor: '#f97316',
          tagTextColor: '#ffffff',
          locked: true,
        },
      ],
    };
  });

  // Selected slot in Workshop canvas
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>('slot-1');

  // Unified drag / resize state on DIY Canvas
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Status feedback message
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Dedicated Visual Progress & Result Modal State
  const [operationModal, setOperationModal] = useState<OperationModalState>({
    isOpen: false,
    mode: 'publish',
    status: 'in_progress',
    title: '',
    progress: 0,
    currentStep: '',
    templateName: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => {
      setStatusMsg(null);
    }, 3500);
  };

  // Upload local background image
  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const img = new Image();
        img.onload = () => {
          setEditingTemplate((prev) => ({
            ...prev,
            bgImageUrl: result,
            width: img.width,
            height: img.height,
            aspectRatio: img.width / img.height,
          }));
          showToast('success', `底图上传成功！尺寸：${img.width}x${img.height}px`);
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Add new Text Slot
  const handleAddSlot = (presetLabel?: string, presetColor?: string) => {
    const count = editingTemplate.slots.length + 1;
    const newId = `slot-${Date.now()}`;
    const newSlot: TextSlot = {
      id: newId,
      label: presetLabel || `文字框 #${count}`,
      placeholder: `请输入${presetLabel || `第 ${count} 项`}内容...`,
      value: '',
      x: 20,
      y: Math.min(80, 25 + (count - 1) * 12),
      width: 60,
      height: 7.5,
      align: 'left',
      fontSize: 26,
      color: '#1e293b',
      tagBgColor: presetColor || '#f43f5e',
      tagTextColor: '#ffffff',
      locked: false,
    };

    setEditingTemplate((prev) => ({
      ...prev,
      slots: [...prev.slots, newSlot],
    }));
    setSelectedSlotId(newId);
    showToast('success', `已添加文字框「${newSlot.label}」`);
  };

  // Duplicate current slot
  const handleDuplicateSlot = (slotId: string) => {
    const target = editingTemplate.slots.find((s) => s.id === slotId);
    if (!target) return;

    const newId = `slot-${Date.now()}`;
    const clone: TextSlot = {
      ...target,
      id: newId,
      label: `${target.label} 副本`,
      y: Math.min(88, target.y + 8),
    };

    setEditingTemplate((prev) => ({
      ...prev,
      slots: [...prev.slots, clone],
    }));
    setSelectedSlotId(newId);
    showToast('success', `已复制文字框「${clone.label}」`);
  };

  // Delete slot
  const handleDeleteSlot = (slotId: string) => {
    if (editingTemplate.slots.length <= 1) {
      showToast('error', '模板至少需要保留 1 个文字框');
      return;
    }
    const newSlots = editingTemplate.slots.filter((s) => s.id !== slotId);
    setEditingTemplate((prev) => ({
      ...prev,
      slots: newSlots,
    }));
    if (selectedSlotId === slotId) {
      setSelectedSlotId(newSlots[0]?.id || null);
    }
  };

  // Update specific slot field
  const handleUpdateSlotField = (slotId: string, updates: Partial<TextSlot>) => {
    setEditingTemplate((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.id === slotId ? { ...s, ...updates } : s)),
    }));
  };

  // Save DIY Template to Library (Draft, requires confirmation in library to publish)
  const handleSaveTemplate = async () => {
    if (!editingTemplate.name.trim()) {
      showToast('error', '请填写模板名称');
      return;
    }
    if (!editingTemplate.bgImageUrl) {
      showToast('error', '请上传模板底图');
      return;
    }
    if (editingTemplate.slots.length === 0) {
      showToast('error', '模板至少需要添加一个文字框');
      return;
    }

    setIsSaving(true);
    setOperationModal({
      isOpen: true,
      mode: 'save',
      status: 'in_progress',
      title: '正在保存模板数据...',
      progress: 20,
      currentStep: `正在打包底图及 ${editingTemplate.slots.length} 个文字框排版坐标...`,
      templateName: editingTemplate.name,
      templateCategory: editingTemplate.category,
    });

    try {
      await sleep(280);
      setOperationModal((prev) => ({
        ...prev,
        progress: 55,
        currentStep: '正在写入模板库与云端存储...',
      }));

      const finalDescription = editingTemplate.description?.trim()
        ? editingTemplate.description.trim()
        : '管理员新建的 DIY 模板';

      const payload: Template = {
        ...editingTemplate,
        description: finalDescription,
        isCustomDiy: true,
        isPublished: editingTemplate.isPublished ?? false,
        author: admin.username,
        updatedAt: new Date().toISOString(),
        slots: editingTemplate.slots.map((s) => ({ ...s, locked: true })),
      };

      const saved = await saveDiyTemplate(payload);

      setOperationModal((prev) => ({
        ...prev,
        progress: 85,
        currentStep: '正在更新模板库列表与缓存...',
      }));

      await onRefreshTemplates();
      await sleep(250);

      setOperationModal((prev) => ({
        ...prev,
        progress: 100,
        status: 'success',
        title: '💾 模板已成功保存至草稿库！',
        currentStep: '保存流程全部完成',
        targetTemplate: saved,
        descriptionText: `模板「${saved.name}」已成功保存！当前处于草稿状态，如需向前台所有用户开放选用，可在模板库中点击「确认发布模板」。`,
      }));
      showToast('success', `💾 模板「${saved.name}」已保存至模板库！`);
    } catch (err: any) {
      setOperationModal((prev) => ({
        ...prev,
        status: 'error',
        title: '保存模板失败',
        currentStep: '保存流程异常终止',
        errorMessage: err.message || '网络或数据同步异常，请稍后重试',
      }));
      showToast('error', err.message || '保存模板失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm publish template to frontend
  const handleConfirmPublishTemplate = async (tpl: Template) => {
    if (!hasPublishPermission(tpl)) {
      showToast(
        'error',
        '权限受限：您当前为普通管理员，仅可发布自己创建的模板。如需发布他人模板，请联系超级管理员 zhangxiyu 开通高级权限。'
      );
      return;
    }

    setIsSaving(true);
    setOperationModal({
      isOpen: true,
      mode: 'publish',
      status: 'in_progress',
      title: '正在发布模板至前台...',
      progress: 20,
      currentStep: `正在校验模板「${tpl.name}」排版规格与文字框配置...`,
      templateName: tpl.name,
      templateCategory: tpl.category,
      targetTemplate: tpl,
    });

    try {
      await sleep(280);
      setOperationModal((prev) => ({
        ...prev,
        progress: 55,
        currentStep: '正在同步数据至云端存储与全局索引库...',
      }));

      const updatedTpl: Template = {
        ...tpl,
        isPublished: true,
        updatedAt: new Date().toISOString(),
      };
      if (isTrueBuiltin(tpl)) {
        // Builtin template: republishing just removes the hidden override
        await setBuiltinTemplateState(tpl.id, { hidden: false });
      } else {
        await saveDiyTemplate(updatedTpl);
      }

      setOperationModal((prev) => ({
        ...prev,
        progress: 85,
        currentStep: '正在激活前台全员可见状态并刷新模板库...',
      }));

      await onRefreshTemplates();
      await sleep(260);

      setOperationModal((prev) => ({
        ...prev,
        progress: 100,
        status: 'success',
        title: '🎉 模板发布成功！',
        currentStep: '发布流程全部完成',
        targetTemplate: updatedTpl,
        descriptionText: `模板「${tpl.name}」已正式发布至前台！所有用户均可实时查看并使用该模板生成专属喜报/海报。`,
      }));
      showToast('success', `🎉 模板「${tpl.name}」已成功发布到前台！`);
    } catch (err: any) {
      setOperationModal((prev) => ({
        ...prev,
        status: 'error',
        title: '发布模板失败',
        currentStep: '发布流程异常终止',
        errorMessage: err.message || '网络或数据同步异常，请稍后重试',
      }));
      showToast('error', err.message || '发布模板失败');
    } finally {
      setIsSaving(false);
    }
  };

  // Unpublish DIY template (set back to draft)
  const handleUnpublishTemplate = async (tpl: Template) => {
    if (!hasPublishPermission(tpl)) {
      showToast('error', '权限受限：您当前为普通管理员，仅可下架自己创建的模板。');
      return;
    }

    // Guard: the frontend must never lose its last published template
    if (tpl.isPublished !== false) {
      const publishedCount = templates.filter((t) => t.isPublished !== false).length;
      if (publishedCount <= 1) {
        showToast(
          'error',
          '模板库中仅剩最后一个已发布模板，无法下架。请先创建或发布其他模板后再操作。'
        );
        return;
      }
    }

    setOperationModal({
      isOpen: true,
      mode: 'unpublish',
      status: 'in_progress',
      title: '正在撤回模板为草稿...',
      progress: 25,
      currentStep: `正在从前台下架模板「${tpl.name}」...`,
      templateName: tpl.name,
      templateCategory: tpl.category,
      targetTemplate: tpl,
    });

    try {
      await sleep(250);
      setOperationModal((prev) => ({
        ...prev,
        progress: 65,
        currentStep: '正在同步下架状态至云端数据库与本地缓存...',
      }));

      const updatedTpl: Template = {
        ...tpl,
        isPublished: false,
        updatedAt: new Date().toISOString(),
      };
      if (isTrueBuiltin(tpl)) {
        // Builtin template: hiding keeps it in the admin library as a draft
        await setBuiltinTemplateState(tpl.id, { hidden: true });
      } else {
        await saveDiyTemplate(updatedTpl);
      }
      await onRefreshTemplates();

      await sleep(220);
      setOperationModal((prev) => ({
        ...prev,
        progress: 100,
        status: 'success',
        title: '✅ 模板已成功撤回为草稿',
        currentStep: '撤回流程全部完成',
        targetTemplate: updatedTpl,
        descriptionText: `模板「${tpl.name}」已从前台下架，前台用户将无法再选用。您可以随时在后台进行二次编辑或重新发布。`,
      }));
      showToast('success', `已将「${tpl.name}」撤回为草稿（已从前台下架）`);
    } catch (err: any) {
      setOperationModal((prev) => ({
        ...prev,
        status: 'error',
        title: '撤回模板失败',
        currentStep: '撤回流程异常终止',
        errorMessage: err.message || '网络或数据同步异常，请稍后重试',
      }));
      showToast('error', err.message || '操作失败');
    }
  };

  // Delete DIY template from library
  const handleDeleteTemplateFromLibrary = async (templateId: string) => {
    const target = templates.find((t) => t.id === templateId);
    const name = target?.name || '选定模板';

    if (target && !hasDeletePermission(target)) {
      showToast('error', '权限受限：您当前为普通管理员，仅可删除自己创建的模板。');
      return;
    }

    // Guard: the template library must never become empty
    if (templates.length <= 1) {
      showToast(
        'error',
        '模板库仅剩最后一个模板，无法删除。请先创建或发布其他模板后再操作。'
      );
      return;
    }

    if (!confirm(`确定要删除模板「${name}」吗？删除后前台用户将无法再选择。`)) return;

    setOperationModal({
      isOpen: true,
      mode: 'delete',
      status: 'in_progress',
      title: '正在删除模板...',
      progress: 30,
      currentStep: `正在清理模板「${name}」云端数据及排版配置...`,
      templateName: name,
    });

    try {
      await sleep(240);
      setOperationModal((prev) => ({
        ...prev,
        progress: 75,
        currentStep: '正在同步移除本地缓存并刷新模板列表...',
      }));

      if (target && isTrueBuiltin(target)) {
        await setBuiltinTemplateState(templateId, { deleted: true });
      } else {
        await deleteDiyTemplate(templateId);
      }
      await onRefreshTemplates();
      await sleep(200);

      setOperationModal((prev) => ({
        ...prev,
        progress: 100,
        status: 'success',
        title: '🗑️ 模板已成功删除',
        currentStep: '删除流程全部完成',
        descriptionText: `模板「${name}」已从模板库中彻底移除。`,
      }));
      showToast('success', '模板已成功删除');
    } catch (err: any) {
      setOperationModal((prev) => ({
        ...prev,
        status: 'error',
        title: '删除模板失败',
        currentStep: '删除流程异常终止',
        errorMessage: err.message || '删除模板失败',
      }));
      showToast('error', err.message || '删除模板失败');
    }
  };

  // Enter sort mode: initialize draft order from current display order
  const handleEnterSortMode = () => {
    setDraftOrder(templates.map((t) => t.id));
    setIsSortMode(true);
  };

  // Move a template up/down one position in the draft order
  const handleMoveTemplate = (index: number, direction: -1 | 1) => {
    setDraftOrder((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // Persist the new template order
  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      await saveTemplateOrder(draftOrder);
      await onRefreshTemplates();
      setIsSortMode(false);
      showToast('success', '✅ 模板排序已保存，前台与模板库将按新顺序展示！');
    } catch (err: any) {
      showToast('error', err.message || '保存排序失败，请重试');
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Load a template into workshop for re-editing
  const handleLoadTemplateIntoWorkshop = (tpl: Template) => {
    const canDirectEdit = hasEditPermission(tpl);

    if (!canDirectEdit) {
      // Clone as user's own template
      setEditingTemplate({
        ...JSON.parse(JSON.stringify(tpl)),
        id: `diy-${Date.now()}`,
        name: `${tpl.name} (我的副本)`,
        isBuiltin: false,
        isCustomDiy: true,
        isPublished: false,
        author: currentAdmin.username,
      });
      setSelectedSlotId(tpl.slots[0]?.id || null);
      setActiveTab('workshop');
      showToast(
        'success',
        `已将「${tpl.name}」作为新副本载入工坊（您创建的副本可自由修改与发布）`
      );
      return;
    }

    setEditingTemplate({
      ...JSON.parse(JSON.stringify(tpl)),
      id: tpl.isBuiltin ? `diy-${Date.now()}` : tpl.id,
      name: tpl.isBuiltin ? `${tpl.name} (自定义版)` : tpl.name,
      isBuiltin: false,
      isCustomDiy: true,
      isPublished: tpl.isPublished ?? false,
      author: tpl.author || currentAdmin.username,
    });
    setSelectedSlotId(tpl.slots[0]?.id || null);
    setActiveTab('workshop');
    showToast('success', `已将「${tpl.name}」载入 DIY 工坊！可进行自由排版与保存`);
  };

  // Canvas Mouse Move drag & resize handler
  const handleMouseDownSlot = (e: React.MouseEvent, slot: TextSlot) => {
    e.stopPropagation();
    setSelectedSlotId(slot.id);
    setDragState({
      type: 'move',
      slotId: slot.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: slot.x,
      initialY: slot.y,
      initialW: slot.width,
      initialH: slot.height,
    });
  };

  // Canvas Mouse Down on Resize Handles
  const handleMouseDownHandle = (
    e: React.MouseEvent,
    slot: TextSlot,
    handle: ResizeHandle
  ) => {
    e.stopPropagation();
    setSelectedSlotId(slot.id);
    setDragState({
      type: 'resize',
      handle,
      slotId: slot.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: slot.x,
      initialY: slot.y,
      initialW: slot.width,
      initialH: slot.height,
    });
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (!dragState || !canvasContainerRef.current) return;

    const rect = canvasContainerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;

    const deltaXPercent = (deltaX / rect.width) * 100;
    const deltaYPercent = (deltaY / rect.height) * 100;

    if (dragState.type === 'move') {
      const newX = Math.max(0, Math.min(100 - dragState.initialW, dragState.initialX + deltaXPercent));
      const newY = Math.max(0, Math.min(100 - dragState.initialH, dragState.initialY + deltaYPercent));

      handleUpdateSlotField(dragState.slotId, {
        x: Number(newX.toFixed(2)),
        y: Number(newY.toFixed(2)),
      });
    } else if (dragState.type === 'resize' && dragState.handle) {
      // Unconstrained free resizing (not locked to ratio)
      const h = dragState.handle;
      const { initialX, initialY, initialW, initialH } = dragState;

      let newX = initialX;
      let newY = initialY;
      let newW = initialW;
      let newH = initialH;

      // Handle Right / East side
      if (h === 'e' || h === 'se' || h === 'ne') {
        newW = Math.max(4, Math.min(100 - initialX, initialW + deltaXPercent));
      }

      // Handle Bottom / South side
      if (h === 's' || h === 'se' || h === 'sw') {
        newH = Math.max(2, Math.min(100 - initialY, initialH + deltaYPercent));
      }

      // Handle Left / West side
      if (h === 'w' || h === 'nw' || h === 'sw') {
        const maxDelta = initialW - 4;
        const boundedDeltaX = Math.min(maxDelta, deltaXPercent);
        newX = Math.max(0, initialX + boundedDeltaX);
        newW = initialW - (newX - initialX);
      }

      // Handle Top / North side
      if (h === 'n' || h === 'nw' || h === 'ne') {
        const maxDelta = initialH - 2;
        const boundedDeltaY = Math.min(maxDelta, deltaYPercent);
        newY = Math.max(0, initialY + boundedDeltaY);
        newH = initialH - (newY - initialY);
      }

      handleUpdateSlotField(dragState.slotId, {
        x: Number(newX.toFixed(2)),
        y: Number(newY.toFixed(2)),
        width: Number(newW.toFixed(2)),
        height: Number(newH.toFixed(2)),
      });
    }
  };

  const handleMouseUpCanvas = () => {
    setDragState(null);
  };

  const selectedSlot = editingTemplate.slots.find((s) => s.id === selectedSlotId);

  return (
    <div className="min-h-screen bg-pink-50/40 text-slate-800 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white/90 backdrop-blur-md border-b border-pink-100 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToApp}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 text-xs font-semibold rounded-xl border border-pink-200 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>返回前台</span>
            </button>
            <div className="h-5 w-px bg-pink-200" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-sm shadow-pink-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-800 leading-tight">DIY 模板管理后台</h1>
                <p className="text-[11px] text-pink-600/80">自由缩放排版与全员共享模板制作</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs & User */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-pink-100/60 p-1 rounded-xl border border-pink-200/60">
              <button
                onClick={() => setActiveTab('workshop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'workshop'
                    ? 'bg-white text-rose-600 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layout className="w-3.5 h-3.5" />
                <span>DIY 制作工坊</span>
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'list'
                    ? 'bg-white text-rose-600 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>已发布模板库 ({templates.length})</span>
              </button>
            </div>

            {/* Admin Badge & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-pink-200">
              {isSuperAdmin ? (
                <button
                  type="button"
                  onClick={() => setIsPermissionsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-pink-500/10 hover:from-amber-500/25 hover:via-rose-500/20 hover:to-pink-500/20 rounded-xl border border-amber-300 text-xs transition-all cursor-pointer shadow-2xs group"
                  title="点击管理所有管理员账号及模板编辑权限"
                >
                  <Crown className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform shrink-0" />
                  <div className="flex items-center gap-1">
                    <span className="text-amber-800 font-bold hidden sm:inline">超管:</span>
                    <span className="font-bold text-rose-600">{currentAdmin.username}</span>
                  </div>
                  <span className="px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[10px] font-bold rounded-md shadow-2xs">
                    权限管理
                  </span>
                </button>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-pink-50 rounded-xl border border-pink-200 text-xs text-slate-600"
                  title={
                    currentAdmin.role === 'senior_admin'
                      ? '高级管理员：拥有编辑他人模板权限'
                      : '普通管理员：仅可编辑自己创建的模板'
                  }
                >
                  {currentAdmin.role === 'senior_admin' ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                  <span className="text-slate-500 hidden sm:inline">
                    {currentAdmin.role === 'senior_admin' ? '高级管理员: ' : '管理员: '}
                  </span>
                  <span className="font-semibold text-rose-600">{currentAdmin.username}</span>
                </div>
              )}

              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-pink-50 rounded-lg transition-colors cursor-pointer"
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Status Notification */}
      {statusMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-lg border flex items-center gap-2.5 text-sm font-medium ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-100'
                : 'bg-rose-50 border-rose-200 text-rose-800 shadow-rose-100'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        </div>
      )}

      {/* Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'workshop' ? (
          /* ========================================================================= */
          /* DIY 模板制作工坊 (Workshop Mode)                                         */
          /* ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Col: Visual Drag & Free Scale Canvas (Sticky on desktop so admin preview follows scroll) */}
            <div className="lg:col-span-7 flex flex-col items-center lg:sticky lg:top-20 self-start">
              <div className="w-full bg-white rounded-2xl border border-pink-100 p-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-pink-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <h3 className="text-sm font-bold text-slate-800">可视化自由缩放排版画布</h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>拖动四角/边框自由修改大小（非等比拉伸）</span>
                  </div>
                </div>

                {/* Interactive Canvas Board */}
                <div className="flex justify-center w-full overflow-hidden rounded-xl bg-pink-50/50 p-2.5 border border-pink-100/60">
                  <div
                    ref={canvasContainerRef}
                    onMouseMove={handleMouseMoveCanvas}
                    onMouseUp={handleMouseUpCanvas}
                    onMouseLeave={handleMouseUpCanvas}
                    className="relative select-none shadow-md rounded-xl overflow-hidden bg-white border border-pink-200"
                    style={{
                      width: '100%',
                      maxWidth: '460px',
                      aspectRatio: `${editingTemplate.aspectRatio}`,
                    }}
                  >
                    {/* Background Image */}
                    {editingTemplate.bgImageUrl ? (
                      <img
                        src={editingTemplate.bgImageUrl}
                        alt="Template Background"
                        className="w-full h-full object-cover pointer-events-none"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-pink-300 gap-2 p-6 text-center">
                        <ImagePlus className="w-12 h-12 text-pink-300" />
                        <p className="text-sm font-medium text-slate-500">请在右侧上传背景底图</p>
                      </div>
                    )}

                    {/* Draggable & Resizable Text Slots Overlay */}
                    {editingTemplate.slots.map((slot) => {
                      const isSelected = slot.id === selectedSlotId;
                      const isDraggingThis = dragState?.slotId === slot.id;

                      return (
                        <div
                          key={slot.id}
                          onMouseDown={(e) => handleMouseDownSlot(e, slot)}
                          className={`absolute transition-all rounded-lg border-2 flex items-center justify-between group cursor-move select-none ${
                            isSelected
                              ? 'border-rose-500 bg-rose-500/15 ring-2 ring-rose-400/40 z-30 shadow-md'
                              : 'border-dashed border-rose-300/80 hover:border-rose-400 hover:bg-rose-400/10 z-20'
                          } ${isDraggingThis ? 'ring-3 ring-rose-500/70' : ''}`}
                          style={{
                            left: `${slot.x}%`,
                            top: `${slot.y}%`,
                            width: `${slot.width}%`,
                            height: `${slot.height}%`,
                          }}
                          title={`点击选中或拖拽移动: ${slot.label}`}
                        >
                          {/* Label Pill on top-left of box */}
                          <div
                            className="absolute -top-3 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-xs pointer-events-none transition-opacity"
                            style={{
                              backgroundColor: slot.tagBgColor || (isSelected ? '#e11d48' : '#334155'),
                              color: slot.tagTextColor || '#ffffff',
                            }}
                          >
                            <GripHorizontal className="w-2.5 h-2.5" />
                            <span>{slot.label}</span>
                          </div>

                          {/* Dummy preview content inside box */}
                          <div
                            className="w-full h-full px-2 py-0.5 flex items-center overflow-hidden pointer-events-none"
                            style={{
                              justifyContent:
                                slot.align === 'center'
                                  ? 'center'
                                  : slot.align === 'right'
                                  ? 'flex-end'
                                  : 'flex-start',
                            }}
                          >
                            <span
                              className="truncate text-xs"
                              style={{
                                color: slot.color || editingTemplate.defaultColor || '#1e293b',
                                fontSize: '12px',
                                fontWeight: slot.fontWeight === 'bold' ? 700 : 500,
                                textAlign: slot.align || 'left',
                              }}
                            >
                              {slot.placeholder || slot.label}
                            </span>
                          </div>

                          {/* Quick delete button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSlot(slot.id);
                            }}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs cursor-pointer"
                            title="删除此框"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>

                          {/* 8 Free Scaling Resize Handles (Visible when selected) */}
                          {isSelected && (
                            <>
                              {/* Top Left (NW) */}
                              <div
                                onMouseDown={(e) => handleMouseDownHandle(e, slot, 'nw')}
                                className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-rose-500 rounded-full shadow-xs cursor-nwse-resize hover:scale-125 transition-transform z-40"
                                title="自由拉伸"
                              />
                              {/* Top (N) */}
                              <div
                                onMouseDown={(e) => handleMouseDownHandle(e, slot, 'n')}
                                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-rose-500 rounded-full shadow-xs cursor-ns-resize hover:scale-125 transition-transform z-40"
                                title="调整高度"
                              />
                              {/* Top Right (NE) */}
                              <div
                                onMouseDown={(e) => handleMouseDownHandle(e, slot, 'ne')}
                                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-rose-500 rounded-full shadow-xs cursor-nesw-resize hover:scale-125 transition-transform z-40"
                                title="自由拉伸"
                              />
                              {/* Right (E) */}
                              <div
                                onMouseDown={(e) => handleMouseDownHandle(e, slot, 'e')}
                                className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-rose-500 rounded-full shadow-xs cursor-ew-resize hover:scale-125 transition-transform z-40"
                                title="调整宽度"
                              />
                              {/* Bottom Right (SE) */}
                              <div
                                onMouseDown={(e) => handleMouseDownHandle(e, slot, 'se')}
                                className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-rose-500 rounded-full shadow-xs cursor-nwse-resize hover:scale-125 transition-transform z-40"
                                title="自由拉伸"
                              />
                              {/* Bottom (S) */}
                              <div
                                onMouseDown={(e) => handleMouseDownHandle(e, slot, 's')}
                                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-rose-500 rounded-full shadow-xs cursor-ns-resize hover:scale-125 transition-transform z-40"
                                title="调整高度"
                              />
                              {/* Bottom Left (SW) */}
                              <div
                                onMouseDown={(e) => handleMouseDownHandle(e, slot, 'sw')}
                                className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-rose-500 rounded-full shadow-xs cursor-nesw-resize hover:scale-125 transition-transform z-40"
                                title="自由拉伸"
                              />
                              {/* Left (W) */}
                              <div
                                onMouseDown={(e) => handleMouseDownHandle(e, slot, 'w')}
                                className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-rose-500 rounded-full shadow-xs cursor-ew-resize hover:scale-125 transition-transform z-40"
                                title="调整宽度"
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Canvas Controls info */}
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-pink-100">
                  <div className="flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-rose-500" />
                    <span>按住框框可随意移动，拉动圆点即可自由缩放长宽（支持随时修改）</span>
                  </div>
                  <span className="font-semibold text-rose-600">共 {editingTemplate.slots.length} 个文字框</span>
                </div>
              </div>
            </div>

            {/* Right Col: DIY Configuration Panel */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* Step 1: Base Info & Image Upload */}
              <div className="bg-white rounded-2xl border border-pink-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <h3 className="text-sm font-bold text-slate-800">上传底图与基本信息</h3>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 transition-colors cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>更换背景底图</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleBgImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      模板名称 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={(e) =>
                        setEditingTemplate((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="例如：2025 自定义个性模板"
                      className="w-full px-3 py-2 bg-pink-50/30 border border-pink-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-rose-400 focus:bg-white transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        模板分类
                      </label>
                      <input
                        type="text"
                        value={editingTemplate.category}
                        onChange={(e) =>
                          setEditingTemplate((prev) => ({ ...prev, category: e.target.value }))
                        }
                        placeholder="热门模版 / 荣誉证书 / 评语"
                        className="w-full px-3 py-2 bg-pink-50/30 border border-pink-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-rose-400 focus:bg-white transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        底图分辨率
                      </label>
                      <div className="px-3 py-2 bg-pink-50/50 border border-pink-200/60 rounded-xl text-xs text-slate-500 font-mono">
                        {editingTemplate.width} × {editingTemplate.height} px
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      模板描述 <span className="text-slate-400 font-normal">(选填，留空则默认显示“管理员新建的 DIY 模板”)</span>
                    </label>
                    <textarea
                      value={editingTemplate.description || ''}
                      onChange={(e) =>
                        setEditingTemplate((prev) => ({ ...prev, description: e.target.value }))
                      }
                      rows={2}
                      placeholder="管理员新建的 DIY 模板"
                      className="w-full px-3 py-2 bg-pink-50/30 border border-pink-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-rose-400 focus:bg-white transition-colors resize-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                        <Palette className="w-3.5 h-3.5 text-rose-500" />
                        <span>模板全局默认文字颜色 (未单独设置的文字框默认继承此颜色)</span>
                      </label>
                      <input
                        type="color"
                        value={editingTemplate.defaultColor || '#1e293b'}
                        onChange={(e) =>
                          setEditingTemplate((prev) => ({ ...prev, defaultColor: e.target.value }))
                        }
                        className="w-4 h-4 p-0 border-0 rounded cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {PRESET_TEXT_COLORS.map((preset) => {
                        const isSelected =
                          (editingTemplate.defaultColor || '#1e293b').toLowerCase() ===
                          preset.hex.toLowerCase();
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() =>
                              setEditingTemplate((prev) => ({ ...prev, defaultColor: preset.hex }))
                            }
                            className={`w-5 h-5 rounded-md transition-transform cursor-pointer flex items-center justify-center border ${
                              preset.hex === '#ffffff' ? 'border-slate-300' : 'border-transparent'
                            } ${
                              isSelected
                                ? 'ring-2 ring-rose-500 scale-110 shadow-xs'
                                : 'opacity-85 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: preset.hex }}
                            title={preset.name}
                          >
                            {isSelected && (
                              <Check
                                className={`w-2.5 h-2.5 ${
                                  preset.hex === '#ffffff' || preset.hex === '#fdd937'
                                    ? 'text-slate-900'
                                    : 'text-white'
                                }`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Slot Manager & Selected Slot Tuning */}
              <div className="bg-white rounded-2xl border border-pink-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <h3 className="text-sm font-bold text-slate-800">文字框设计与自由缩放</h3>
                  </div>

                  <button
                    onClick={() => handleAddSlot()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>添加文字框</span>
                  </button>
                </div>

                {/* Horizontal Slot Chips list */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-thin">
                  {editingTemplate.slots.map((slot, idx) => {
                    const isSelected = slot.id === selectedSlotId;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-pink-50 hover:bg-pink-100 text-slate-700 border border-pink-200'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: slot.tagBgColor || '#f43f5e' }}
                        />
                        <span>{slot.label || `框 ${idx + 1}`}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Slot Detailed Attributes Editor */}
                {selectedSlot ? (
                  <div className="p-4 bg-pink-50/40 rounded-xl border border-pink-200/80 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-pink-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">
                          编辑选中框框:
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-xs font-semibold">
                          {selectedSlot.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDuplicateSlot(selectedSlot.id)}
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-pink-100 rounded-lg transition-colors cursor-pointer"
                          title="复制当前框"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSlot(selectedSlot.id)}
                          className="p-1 text-slate-500 hover:text-rose-600 hover:bg-pink-100 rounded-lg transition-colors cursor-pointer"
                          title="删除当前框"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Tag label & placeholder */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          标签名
                        </label>
                        <input
                          type="text"
                          value={selectedSlot.label}
                          onChange={(e) =>
                            handleUpdateSlotField(selectedSlot.id, { label: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-pink-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-rose-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          占位提示词 (Placeholder)
                        </label>
                        <input
                          type="text"
                          value={selectedSlot.placeholder}
                          onChange={(e) =>
                            handleUpdateSlotField(selectedSlot.id, { placeholder: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-pink-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-rose-400"
                        />
                      </div>
                    </div>

                    {/* Coordinates & Dimensions (Free Scaling) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-slate-600">
                          坐标与大小 (% 百分比，非等比自由拉伸)
                        </label>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500">水平位置 X: {selectedSlot.x}%</span>
                          <input
                            type="number"
                            step="0.5"
                            value={selectedSlot.x}
                            onChange={(e) =>
                              handleUpdateSlotField(selectedSlot.id, {
                                x: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 bg-white border border-pink-200 rounded-lg text-xs text-slate-800"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500">垂直位置 Y: {selectedSlot.y}%</span>
                          <input
                            type="number"
                            step="0.5"
                            value={selectedSlot.y}
                            onChange={(e) =>
                              handleUpdateSlotField(selectedSlot.id, {
                                y: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 bg-white border border-pink-200 rounded-lg text-xs text-slate-800"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold text-rose-600">宽度 W: {selectedSlot.width}%</span>
                          <input
                            type="number"
                            step="1"
                            value={selectedSlot.width}
                            onChange={(e) =>
                              handleUpdateSlotField(selectedSlot.id, {
                                width: parseFloat(e.target.value) || 10,
                              })
                            }
                            className="w-full px-2 py-1 bg-white border border-pink-200 rounded-lg text-xs text-slate-800 font-medium"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold text-rose-600">高度 H: {selectedSlot.height}%</span>
                          <input
                            type="number"
                            step="0.5"
                            value={selectedSlot.height}
                            onChange={(e) =>
                              handleUpdateSlotField(selectedSlot.id, {
                                height: parseFloat(e.target.value) || 4,
                              })
                            }
                            className="w-full px-2 py-1 bg-white border border-pink-200 rounded-lg text-xs text-slate-800 font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 1. Tag pill color selection */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: selectedSlot.tagBgColor || '#f43f5e' }}
                          />
                          <span>标签色块预设 (左侧标签胶囊底色)</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] text-slate-500 cursor-pointer hover:text-rose-600 flex items-center gap-1">
                            <span>自定义</span>
                            <input
                              type="color"
                              value={selectedSlot.tagBgColor || '#f43f5e'}
                              onChange={(e) =>
                                handleUpdateSlotField(selectedSlot.id, {
                                  tagBgColor: e.target.value,
                                  tagTextColor: '#ffffff',
                                })
                              }
                              className="w-4 h-4 p-0 border-0 rounded cursor-pointer"
                            />
                          </label>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {PRESET_TAG_COLORS.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() =>
                              handleUpdateSlotField(selectedSlot.id, {
                                tagBgColor: preset.bg,
                                tagTextColor: preset.text,
                              })
                            }
                            className={`w-6 h-6 rounded-md transition-transform cursor-pointer flex items-center justify-center ${
                              selectedSlot.tagBgColor === preset.bg
                                ? 'ring-2 ring-rose-500 scale-110 shadow-xs'
                                : 'opacity-85 hover:opacity-100 hover:scale-105'
                            }`}
                            style={{ backgroundColor: preset.bg }}
                            title={preset.name}
                          >
                            {selectedSlot.tagBgColor === preset.bg && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. Slot Text Default Color (文字框内文字默认颜色) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                          <Palette className="w-3 h-3 text-rose-500" />
                          <span>文字框内文字默认颜色</span>
                        </label>
                        <div className="flex items-center gap-2">
                          {selectedSlot.color && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSlotField(selectedSlot.id, { color: undefined })
                              }
                              className="text-[10px] text-slate-400 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer"
                              title="重置为跟随模板全局文字颜色"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>跟随模板</span>
                            </button>
                          )}
                          <label className="text-[10px] text-slate-500 cursor-pointer hover:text-rose-600 flex items-center gap-1">
                            <span>自定义</span>
                            <input
                              type="color"
                              value={selectedSlot.color || editingTemplate.defaultColor || '#1e293b'}
                              onChange={(e) =>
                                handleUpdateSlotField(selectedSlot.id, { color: e.target.value })
                              }
                              className="w-4 h-4 p-0 border-0 rounded cursor-pointer"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Text Color Presets Swatches */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {PRESET_TEXT_COLORS.map((preset) => {
                          const currentSlotColor =
                            selectedSlot.color || editingTemplate.defaultColor || '#1e293b';
                          const isSelected =
                            currentSlotColor.toLowerCase() === preset.hex.toLowerCase();

                          return (
                            <button
                              key={preset.name}
                              type="button"
                              onClick={() =>
                                handleUpdateSlotField(selectedSlot.id, { color: preset.hex })
                              }
                              className={`w-6 h-6 rounded-md transition-transform cursor-pointer flex items-center justify-center border ${
                                preset.hex === '#ffffff' ? 'border-slate-300' : 'border-transparent'
                              } ${
                                isSelected
                                  ? 'ring-2 ring-rose-500 scale-110 shadow-xs'
                                  : 'opacity-85 hover:opacity-100 hover:scale-105'
                              }`}
                              style={{ backgroundColor: preset.hex }}
                              title={`${preset.name} (${preset.hex})`}
                            >
                              {isSelected && (
                                <Check
                                  className={`w-3 h-3 ${
                                    preset.hex === '#ffffff' || preset.hex === '#fdd937'
                                      ? 'text-slate-900'
                                      : 'text-white'
                                  }`}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 bg-white/70 px-2 py-1 rounded-md border border-pink-100">
                        <span>当前文字颜色:</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-slate-300 inline-block"
                            style={{
                              backgroundColor:
                                selectedSlot.color || editingTemplate.defaultColor || '#1e293b',
                            }}
                          />
                          <span className="font-mono font-semibold text-slate-700">
                            {selectedSlot.color
                              ? selectedSlot.color
                              : `${editingTemplate.defaultColor || '#1e293b'} (默认全局)`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Text Alignment & Font Weight */}
                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-pink-100">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          文字对齐方式
                        </label>
                        <div className="flex items-center bg-white border border-pink-200 rounded-lg p-0.5">
                          {(['left', 'center', 'right'] as const).map((align) => (
                            <button
                              key={align}
                              type="button"
                              onClick={() => handleUpdateSlotField(selectedSlot.id, { align })}
                              className={`flex-1 py-1 flex items-center justify-center rounded text-xs transition-colors cursor-pointer ${
                                (selectedSlot.align || 'left') === align
                                  ? 'bg-rose-500 text-white font-bold'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                              title={align === 'left' ? '居左' : align === 'center' ? '居中' : '居右'}
                            >
                              {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                              {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                              {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          文字粗细
                        </label>
                        <div className="flex items-center bg-white border border-pink-200 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSlotField(selectedSlot.id, { fontWeight: 'normal' })
                            }
                            className={`flex-1 py-1 flex items-center justify-center rounded text-xs transition-colors cursor-pointer ${
                              (selectedSlot.fontWeight || 'normal') === 'normal'
                                ? 'bg-rose-500 text-white font-semibold'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            常规
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSlotField(selectedSlot.id, { fontWeight: 'bold' })
                            }
                            className={`flex-1 py-1 flex items-center justify-center rounded text-xs transition-colors cursor-pointer ${
                              selectedSlot.fontWeight === 'bold'
                                ? 'bg-rose-500 text-white font-bold'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <Bold className="w-3 h-3 mr-0.5" />
                            加粗
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400 bg-pink-50/30 rounded-xl border border-pink-200/60">
                    请点击上方或左侧画布选中一个文字框进行编辑
                  </div>
                )}
              </div>

              {/* Step 3: Save Button */}
              <div className="bg-white rounded-2xl border border-pink-100 p-5 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <h3 className="text-sm font-bold text-slate-800">保存模板到模板库</h3>
                </div>
                <p className="text-xs text-slate-500">
                  点击保存后，模板将存入后台模板库（草稿状态）。如需在前台对所有用户生效，请前往模板库点击「确认发布模板」。
                </p>
                <button
                  onClick={handleSaveTemplate}
                  disabled={isSaving}
                  className="w-full py-3 px-4 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-sm font-bold rounded-xl shadow-md shadow-rose-200 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>保存模板到模板库</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* 模板库管理 (Template Library List)                                        */
          /* ========================================================================= */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">模板库管理 (已发布 / 草稿)</h2>
                <p className="text-xs text-slate-500">
                  管理所有模板。制作好的模板在此处点击「确认发布模板」后，才会真正发布并在前台对用户生效。
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isSortMode ? (
                  <>
                    <button
                      onClick={() => setIsSortMode(false)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white text-slate-600 hover:bg-slate-100 border border-pink-100 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>取消</span>
                    </button>
                    <button
                      onClick={handleSaveOrder}
                      disabled={isSavingOrder}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm shadow-emerald-200 disabled:cursor-not-allowed"
                    >
                      {isSavingOrder ? (
                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>保存排序</span>
                    </button>
                  </>
                ) : (
                  <>
                    {isSuperAdmin && (
                      <button
                        onClick={handleEnterSortMode}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm shadow-indigo-200"
                        title="拖拽调整模板在前台与模板库的展示顺序"
                      >
                        <ArrowUpDown className="w-4 h-4" />
                        <span>调整排序</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingTemplate({
                          id: `diy-${Date.now()}`,
                          name: '新 DIY 模板',
                          category: '热门模版',
                          description: '',
                          aspectRatio: 0.75,
                          width: 1125,
                          height: 1500,
                          bgType: 'image',
                          bgImageUrl: 'https://picx.zhimg.com/v2-01d4b4d0a7a64017638b4f6936e243b0.png',
                          defaultFontId: 'zcool-kuaile',
                          defaultColor: '#1e293b',
                          isCustomDiy: true,
                          isPublished: false,
                          author: admin.username,
                          slots: [
                            {
                              id: `slot-1`,
                              label: '主标题',
                              placeholder: '请输入内容...',
                              value: '',
                              x: 25,
                              y: 35,
                              width: 50,
                              height: 8,
                              tagBgColor: '#f43f5e',
                              tagTextColor: '#ffffff',
                            },
                          ],
                        });
                        setSelectedSlotId('slot-1');
                        setActiveTab('workshop');
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-sm shadow-rose-200"
                    >
                      <Plus className="w-4 h-4" />
                      <span>制作新 DIY 模板</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Template Ordering Mode (Super Admin): drag handle or arrows to reorder */}
            {isSortMode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50/70 border border-indigo-200/70 rounded-xl text-xs text-indigo-700">
                  <ArrowUpDown className="w-4 h-4 shrink-0" />
                  <span>
                    按住左侧手柄拖拽，或使用上下箭头调整顺序。保存后前台与模板库将统一按此顺序展示；新建模板默认排在末尾。
                  </span>
                </div>
                <Reorder.Group
                  axis="y"
                  values={draftOrder}
                  onReorder={setDraftOrder}
                  className="space-y-2"
                >
                  {draftOrder.map((id, index) => {
                    const tpl = templates.find((t) => t.id === id);
                    if (!tpl) return null;
                    return (
                      <SortableRow
                        key={tpl.id}
                        tpl={tpl}
                        index={index}
                        count={draftOrder.length}
                        onMoveUp={() => handleMoveTemplate(index, -1)}
                        onMoveDown={() => handleMoveTemplate(index, 1)}
                      />
                    );
                  })}
                </Reorder.Group>
              </div>
            ) : null}

            {!isSortMode && (
              <>
            {/* Category Filter Navigation Bar */}
            {(() => {
              const categories = Array.from(
                new Set(templates.map((t) => (t.category || '未分类').trim()))
              ).filter(Boolean);

              return (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  <div className="flex items-center gap-1 text-slate-500 mr-1 shrink-0 font-medium">
                    <Filter className="w-3.5 h-3.5 text-rose-500" />
                    <span>分类筛选:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer shrink-0 ${
                      selectedCategory === 'all'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-pink-50 border border-pink-100'
                    }`}
                  >
                    全部模版 ({templates.length})
                  </button>
                  {categories.map((cat) => {
                    const count = templates.filter((t) => (t.category || '未分类').trim() === cat).length;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer shrink-0 ${
                          selectedCategory === cat
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-pink-50 border border-pink-100'
                        }`}
                      >
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Template Cards Grid */}
            {(() => {
              const filteredTemplates = templates.filter((tpl) => {
                if (selectedCategory === 'all') return true;
                return (tpl.category || '未分类').trim() === selectedCategory;
              });

              if (filteredTemplates.length === 0) {
                return (
                  <div className="p-12 text-center bg-white rounded-2xl border border-pink-100">
                    <Layout className="w-10 h-10 text-pink-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600">该分类下暂无模板</p>
                    <p className="text-xs text-slate-400 mt-1">
                      可切换至其他分类或点击右上角「制作新 DIY 模板」添加
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTemplates.map((tpl) => {
                    const isDiy = tpl.isCustomDiy || !tpl.isBuiltin;
                    const isPublished = tpl.isPublished !== false;
                    const displayDescription = tpl.description?.trim() || '管理员新建的 DIY 模板';

                    return (
                      <div
                        key={tpl.id}
                        className="bg-white rounded-2xl border border-pink-100 overflow-hidden shadow-xs hover:shadow-md hover:border-pink-200 transition-all flex flex-col"
                      >
                        {/* Thumbnail banner */}
                        <div className="relative h-48 bg-pink-50 overflow-hidden flex items-center justify-center border-b border-pink-100">
                          {tpl.bgImageUrl ? (
                            <img
                              src={tpl.bgImageUrl}
                              alt={tpl.name}
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <Layout className="w-12 h-12 text-pink-300" />
                          )}

                          {/* Badges */}
                          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                            {isPublished ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500 text-white shadow-xs flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> 前台已发布
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white shadow-xs flex items-center gap-0.5">
                                草稿 / 未发布
                              </span>
                            )}

                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/90 backdrop-blur-xs text-slate-700 border border-pink-100">
                              {tpl.category}
                            </span>
                          </div>

                          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-white/90 text-[10px] text-slate-600 backdrop-blur-xs border border-pink-100">
                            {tpl.slots.length} 个文字框
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-slate-800">{tpl.name}</h3>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                              {displayDescription}
                            </p>
                            {tpl.author && (
                              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                                <div className="flex items-center gap-1">
                                  <span>作者:</span>
                                  <span className="font-semibold text-slate-700">{tpl.author}</span>
                                  {isTemplateOwner(tpl) ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-700">
                                      我的模板
                                    </span>
                                  ) : !isSuperAdmin && isExplicitlyGranted(tpl) ? (
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-0.5"
                                      title="超级管理员已为您单独开放此模板的直接编辑与发布权限"
                                    >
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> 已获专属授权
                                    </span>
                                  ) : tpl.author.trim().toLowerCase() === 'zhangxiyu' ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-0.5">
                                      <Crown className="w-2.5 h-2.5" /> 超管
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                                      其他管理员
                                    </span>
                                  )}
                                </div>

                                {!hasEditPermission(tpl) && (
                                  <span
                                    className="text-[10px] text-amber-600 flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60"
                                    title="普通管理员修改他人模板将自动在工坊克隆为新副本"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                    <span>克隆编辑</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="mt-4 pt-3 border-t border-pink-100 flex items-center justify-between gap-2">
                            {!isPublished ? (
                              /* Unpublished: Prominent Confirm Publish Button */
                              hasPublishPermission(tpl) ? (
                                <button
                                  onClick={() => handleConfirmPublishTemplate(tpl)}
                                  className="flex-1 py-1.5 px-3 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-rose-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                  title="发布此模板到前台供所有用户使用"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>确认发布模板</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleConfirmPublishTemplate(tpl)}
                                  className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                                  title="普通管理员仅可发布自己的模板或受专属授权的模板，点击可查看授权说明"
                                >
                                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                                  <span>发布(需权限)</span>
                                </button>
                              )
                            ) : (
                              /* Already Published: Use on Frontend Button */
                              <button
                                onClick={() => {
                                  onSelectAndUseTemplate(tpl);
                                  onBackToApp();
                                }}
                                className="flex-1 py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200 transition-colors cursor-pointer flex items-center justify-center gap-1"
                                title="已发布，点击直接在前台选用"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>已发布 (前台使用)</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleLoadTemplateIntoWorkshop(tpl)}
                              className="py-1.5 px-2.5 bg-pink-50/70 hover:bg-pink-100 text-slate-700 text-xs font-semibold rounded-xl border border-pink-200 transition-colors cursor-pointer flex items-center gap-1"
                              title={
                                hasEditPermission(tpl)
                                  ? '在工坊中重新编辑'
                                  : '克隆他人模板副本至工坊自由编辑'
                              }
                            >
                              {hasEditPermission(tpl) ? (
                                <>
                                  <SlidersHorizontal className="w-3.5 h-3.5 text-pink-600" />
                                  <span>二次编辑</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-amber-600" />
                                  <span>克隆编辑</span>
                                </>
                              )}
                            </button>

                            {/* Super admin can assign this template to specific admins */}
                            {isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => setAssigningTemplate(tpl)}
                                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                                  tpl.allowedEditors && tpl.allowedEditors.length > 0
                                    ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                    : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                }`}
                                title={`指定授权：开放此模板给指定普通管理员 (${tpl.allowedEditors?.length || 0}人已获授权)`}
                              >
                                <Key className="w-4 h-4" />
                              </button>
                            )}

                            {(isDiy || tpl.isBuiltin) && (
                              <>
                                {isPublished && (
                                  <button
                                    onClick={() => handleUnpublishTemplate(tpl)}
                                    className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                                      hasPublishPermission(tpl)
                                        ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                        : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'
                                    }`}
                                    title={
                                      hasPublishPermission(tpl)
                                        ? '下架并撤回为草稿'
                                        : '下架需高级管理员权限'
                                    }
                                  >
                                    <EyeOff className="w-4 h-4" />
                                  </button>
                                )}
                                {hasDeletePermission(tpl) && (
                                  <button
                                    onClick={() => handleDeleteTemplateFromLibrary(tpl.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                    title={tpl.isBuiltin ? '删除此内置模板' : '删除此 DIY 模板'}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
              </>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 模板操作进度与结果提醒弹窗 (Operation Progress & Result Dialog)            */}
      {/* ========================================================================= */}
      {operationModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-3xl border border-pink-100 shadow-2xl max-w-md w-full p-6 sm:p-7 relative overflow-hidden flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative background blur ambient light */}
            <div
              className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-60 ${
                operationModal.status === 'error'
                  ? 'bg-rose-300'
                  : operationModal.status === 'success'
                  ? 'bg-emerald-200'
                  : 'bg-pink-300'
              }`}
            />

            {/* 1. In Progress State */}
            {operationModal.status === 'in_progress' && (
              <div className="w-full flex flex-col items-center">
                {/* Animated pulsing icon */}
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/30">
                    {operationModal.mode === 'publish' && <Send className="w-8 h-8 animate-pulse" />}
                    {operationModal.mode === 'unpublish' && <EyeOff className="w-8 h-8 animate-pulse" />}
                    {operationModal.mode === 'save' && <Save className="w-8 h-8 animate-pulse" />}
                    {operationModal.mode === 'delete' && <Trash2 className="w-8 h-8 animate-pulse" />}
                  </div>
                  <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center border border-pink-100">
                    <Loader2 className="w-4 h-4 text-rose-600 animate-spin" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-1">{operationModal.title}</h3>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-pink-50 border border-pink-200/80 rounded-full text-xs text-rose-700 font-medium mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  <span>模板: {operationModal.templateName}</span>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full mb-3">
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 text-rose-500 animate-spin" />
                      <span>处理进度</span>
                    </span>
                    <span className="font-mono text-rose-600 text-sm font-bold">
                      {operationModal.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 p-0.5 overflow-hidden border border-pink-100 shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 relative"
                      style={{ width: `${Math.max(8, operationModal.progress)}%` }}
                    >
                      <div className="absolute inset-0 bg-white/25 animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* Current Step description */}
                <div className="text-xs text-slate-600 font-medium flex items-center gap-2 mt-1 bg-pink-50/50 px-3.5 py-2.5 rounded-xl border border-pink-100 w-full justify-center text-center">
                  <span>{operationModal.currentStep}</span>
                </div>

                <p className="text-[11px] text-slate-400 mt-4">
                  正在与云端存储和前台同步数据，请稍候片刻...
                </p>
              </div>
            )}

            {/* 2. Success State */}
            {operationModal.status === 'success' && (
              <div className="w-full flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 mb-4 animate-in zoom-in-75 duration-300">
                  <Check className="w-9 h-9 stroke-[2.5]" />
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-1.5">{operationModal.title}</h3>

                <div className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs text-emerald-700 font-medium mb-3">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>模板: {operationModal.templateName}</span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-6 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 w-full text-left">
                  {operationModal.descriptionText}
                </p>

                {/* Action Buttons depending on mode */}
                <div className="w-full flex flex-col sm:flex-row items-center gap-2.5">
                  {operationModal.mode === 'publish' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (operationModal.targetTemplate) {
                            onSelectAndUseTemplate(operationModal.targetTemplate);
                            onBackToApp();
                          }
                          setOperationModal((prev) => ({ ...prev, isOpen: false }));
                        }}
                        className="w-full sm:flex-1 py-2.5 px-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md shadow-rose-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>立即去前台选用</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('list');
                          setOperationModal((prev) => ({ ...prev, isOpen: false }));
                        }}
                        className="w-full sm:w-auto py-2.5 px-4 bg-pink-50 hover:bg-pink-100 text-slate-700 text-xs font-semibold rounded-xl border border-pink-200 transition-colors cursor-pointer"
                      >
                        留在模板库
                      </button>
                    </>
                  )}

                  {operationModal.mode === 'save' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('list');
                          setOperationModal((prev) => ({ ...prev, isOpen: false }));
                        }}
                        className="w-full sm:flex-1 py-2.5 px-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md shadow-rose-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>前往模板库去发布</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOperationModal((prev) => ({ ...prev, isOpen: false }))}
                        className="w-full sm:w-auto py-2.5 px-4 bg-pink-50 hover:bg-pink-100 text-slate-700 text-xs font-semibold rounded-xl border border-pink-200 transition-colors cursor-pointer"
                      >
                        继续留在工坊
                      </button>
                    </>
                  )}

                  {(operationModal.mode === 'unpublish' || operationModal.mode === 'delete') && (
                    <button
                      type="button"
                      onClick={() => setOperationModal((prev) => ({ ...prev, isOpen: false }))}
                      className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                    >
                      我知道了
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 3. Error State */}
            {operationModal.status === 'error' && (
              <div className="w-full flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/25 mb-4 animate-in zoom-in-75 duration-300">
                  <AlertCircle className="w-9 h-9 stroke-[2.5]" />
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-1.5">{operationModal.title}</h3>

                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl w-full text-left mb-6">
                  {operationModal.errorMessage || '处理过程中发生未知错误，请检查网络或刷新重试。'}
                </p>

                <button
                  type="button"
                  onClick={() => setOperationModal((prev) => ({ ...prev, isOpen: false }))}
                  className="w-full py-2.5 px-4 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  关闭并返回
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Super Admin Permissions Management Modal */}
      {isPermissionsModalOpen && (
        <AdminPermissionsModal
          isOpen={isPermissionsModalOpen}
          onClose={() => setIsPermissionsModalOpen(false)}
          currentUser={currentAdmin}
          templates={templates}
          onRefreshTemplates={onRefreshTemplates}
          onAdminUpdated={(updatedList) => {
            const me = updatedList.find(
              (u) => u.username.trim().toLowerCase() === currentAdmin.username.trim().toLowerCase()
            );
            if (me) {
              setCurrentAdmin((prev) => ({
                ...prev,
                role: me.role,
                permissions: me.permissions,
              }));
            }
          }}
        />
      )}

      {/* Single Template Authorization Modal (Strictly for Super Admin only) */}
      {isSuperAdmin && assigningTemplate && (
        <TemplateEditorAssignModal
          isOpen={!!assigningTemplate}
          onClose={() => setAssigningTemplate(null)}
          template={assigningTemplate}
          currentUser={currentAdmin}
          onTemplateUpdated={async () => {
            await onRefreshTemplates();
          }}
        />
      )}
    </div>
  );
};
