import React, { useState, useRef, useCallback, useEffect } from 'react';
import { BUILTIN_TEMPLATES } from './data/templates';
import { CHINESE_FONTS } from './data/fonts';
import { COLOR_PRESETS } from './data/colors';
import { Template, RenderOptions, TextSlot, AdminUser, isImageSlot } from './types';
import { Header } from './components/Header';
import { TemplateCanvas } from './components/TemplateCanvas';
import { EditorPanel } from './components/EditorPanel';
import { PreviewModal } from './components/PreviewModal';
import { ImageLibraryModal } from './components/ImageLibraryModal';
import { MobileQuickEditor } from './components/MobileQuickEditor';
import { MobileFloatingPreview } from './components/MobileFloatingPreview';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminPanel } from './components/AdminPanel';
import { renderTemplateToCanvas } from './utils/canvasRenderer';
import { getAllTemplates, getSavedAdminSession, saveAdminSession, fetchTemplateImages, fetchTemplateBackground, fetchShareTemplate } from './services/api';
import { Sparkles } from 'lucide-react';
import { ContentGuardModal } from './components/ContentGuardModal';
import { checkTextInputs } from './utils/contentGuard';

// 分享模式：/share/<templateId> 直达单模板编辑器。
// SPA 无客户端路由，仅首次加载解析一次路径（后续引入路由时需移入组件内）
const SHARE_PATH_RE = /^\/share\/([^/]+)/;
function getShareTemplateId(): string | null {
  const m = window.location.pathname.match(SHARE_PATH_RE);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

// --- 内容安全：当日违规次数计数（软提示，供弹窗阈值判断） ---
const VIOLATION_COUNT_KEY = 'content_guard_violation_count_v1';
function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function recordViolation(): number {
  try {
    const today = getTodayKey();
    const raw = localStorage.getItem(VIOLATION_COUNT_KEY);
    let data: { date: string; count: number } = { date: today, count: 0 };
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.date === today && typeof parsed.count === 'number') {
        data = parsed;
      }
    }
    data.count += 1;
    localStorage.setItem(VIOLATION_COUNT_KEY, JSON.stringify(data));
    return data.count;
  } catch {
    return 1;
  }
}

export default function App() {
  // All templates (Builtin + DIY templates)
  const [allTemplates, setAllTemplates] = useState<Template[]>(BUILTIN_TEMPLATES);

  // Current active template
  const [currentTemplate, setCurrentTemplate] = useState<Template>(BUILTIN_TEMPLATES[0]);
  
  // Currently active selected slot ID
  const [activeSlotId, setActiveSlotId] = useState<string | null>(
    BUILTIN_TEMPLATES[0].slots[0]?.id || null
  );

  // Admin session state
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => getSavedAdminSession());
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState<boolean>(false);
  const [isAdminView, setIsAdminView] = useState<boolean>(false);
  // 登录弹窗顶部提示（改密成功后引导重新登录）
  const [loginNotice, setLoginNotice] = useState<string | undefined>(undefined);

  // Mobile Quick Edit Drawer State
  const [isQuickEditClosed, setIsQuickEditClosed] = useState<boolean>(false);

  // Styling & Rendering Options
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({
    globalFontFamily: CHINESE_FONTS[0].fontFamily,
    globalColor: '#1e293b',
    fontSizeScale: 1.0,
    showGuidelines: true,
    shadowEnabled: false,
    fontWeight: 'normal',
  });

  // Preview Modal State
  const [generatedImageDataUrl, setGeneratedImageDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // 内容安全拦截弹窗状态
  const [violation, setViolation] = useState<{ categoryLabel?: string; label?: string; strikeCount: number } | null>(null);

  // 图片位相关状态：upload 型选项的 dataUrl 只存在内存（绝不写 localStorage）
  const [imagesMap, setImagesMap] = useState<Record<string, string>>({});
  const [imageLibrarySlotId, setImageLibrarySlotId] = useState<string | null>(null);
  const [imagesLoading, setImagesLoading] = useState<boolean>(false);
  // 模板背景图 dataUrl 内存映射（模板 JSON 已剥离背景，渲染前按需拉取；同样不进 localStorage）
  const [bgImageMap, setBgImageMap] = useState<Record<string, string>>({});
  // 模板列表首次拉取中状态（新访客先看到内置模板，下拉框显示「加载中」）
  const [templatesLoading, setTemplatesLoading] = useState<boolean>(true);
  const currentTemplateIdRef = useRef<string>(BUILTIN_TEMPLATES[0].id);

  // 分享模式状态机：/share/<id> 直达单模板编辑器（仅已发布模板，后端校验）
  const shareTemplateId = getShareTemplateId();
  const isShareMode = shareTemplateId !== null;
  const [shareStatus, setShareStatus] = useState<'loading' | 'ready' | 'notFound'>(
    isShareMode ? 'loading' : 'ready'
  );

  // 拉取模板 upload 型图片选项的 dataUrl 合并进内存映射；失败不阻断编辑
  // 已成功拉取过的模板跳过重复请求（空结果不记账，下次打开图库自动重试）
  const fetchedImagesRef = useRef<Set<string>>(new Set());
  const ensureTemplateImages = useCallback(async (template: Template) => {
    const uploadOptions = (template.imageOptions || []).filter((o) => o.source === 'upload');
    if (uploadOptions.length === 0) return;
    if (fetchedImagesRef.current.has(template.id)) return;
    setImagesLoading(true);
    try {
      const images = await fetchTemplateImages(template.id);
      if (Object.keys(images).length > 0) {
        fetchedImagesRef.current.add(template.id);
      } else {
        fetchedImagesRef.current.delete(template.id);
      }
      setImagesMap((prev) => ({ ...prev, ...images }));
    } catch (err) {
      console.warn('Failed to load template images:', err);
    } finally {
      setImagesLoading(false);
    }
  }, []);

  // 拉取模板背景图 dataUrl 合并进内存映射；无背景（纯色/外链）或已拉取则跳过
  // 返回拉取到的 dataUrl（生成图片前 await 用，避免闭包内读到旧的 bgImageMap）
  const ensureTemplateBackground = useCallback(async (template: Template): Promise<string | null> => {
    if (template.bgType !== 'image' || template.bgImageUrl) return null;
    if (bgImageMap[template.id]) return bgImageMap[template.id];
    try {
      const bg = await fetchTemplateBackground(template.id);
      if (bg) {
        setBgImageMap((prev) => ({ ...prev, [template.id]: bg }));
      }
      return bg;
    } catch (err) {
      console.warn('Failed to load template background:', err);
      return null;
    }
  }, [bgImageMap]);

  // Fetch templates from server on initial mount
  // fresh=true 绕过边缘缓存（管理端保存后立即刷新列表用）
  const fetchAndSyncTemplates = useCallback(async (fresh = false) => {
    try {
      const list = await getAllTemplates(fresh);
      setAllTemplates(list);
      // Ensure current template retains latest properties if matched
      const found = list.find((t) => t.id === currentTemplateIdRef.current);
      setCurrentTemplate((prev) => {
        if (!found) {
          // Template was removed (e.g. deleted builtin) - fall back to the first available one
          return list.length > 0 ? list[0] : prev;
        }
        return { ...found, slots: prev.slots.map(s => {
          const match = found.slots.find(fs => fs.id === s.id);
          return match ? { ...match, value: s.value } : s;
        }) };
      });
      if (found) {
        ensureTemplateImages(found);
        ensureTemplateBackground(found);
      }
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setTemplatesLoading(false);
    }
  }, [ensureTemplateImages, ensureTemplateBackground]);

  useEffect(() => {
    if (shareTemplateId) return; // 分享模式只拉单个模板，跳过全量列表
    fetchAndSyncTemplates();
  }, [fetchAndSyncTemplates, shareTemplateId]);

  // 分享模式：拉取单模板数据（后端仅返回已发布模板），成功后接管当前模板，
  // 背景图与图片选项由下方预取 effect 自动补齐；cancelled 防 StrictMode 双挂载
  useEffect(() => {
    if (!shareTemplateId) return;
    let cancelled = false;
    (async () => {
      const tpl = await fetchShareTemplate(shareTemplateId);
      if (cancelled) return;
      if (!tpl) {
        setShareStatus('notFound');
        return;
      }
      setAllTemplates([tpl]);
      currentTemplateIdRef.current = tpl.id;
      setCurrentTemplate(tpl);
      setActiveSlotId(tpl.slots[0]?.id || null);
      setRenderOptions((prev) => ({ ...prev, globalColor: tpl.defaultColor || '#1e293b' }));
      setTemplatesLoading(false);
      setShareStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [shareTemplateId]);

  // 模板列表到达后，后台预取所有照片模板的背景图与图片选项 dataUrl：
  // 用户在浏览/切换时下载已并行进行，选中即可秒渲染（不再等选中后才开始下载）
  useEffect(() => {
    allTemplates.forEach((t) => {
      ensureTemplateBackground(t);
      ensureTemplateImages(t);
    });
  }, [allTemplates, ensureTemplateBackground, ensureTemplateImages]);

  // Handle template selection
  const handleSelectTemplate = (template: Template) => {
    currentTemplateIdRef.current = template.id;
    setCurrentTemplate(template);
    setActiveSlotId(template.slots[0]?.id || null);
    setImageLibrarySlotId(null);
    setRenderOptions((prev) => ({
      ...prev,
      globalColor: template.defaultColor || '#1e293b',
    }));
    ensureTemplateImages(template);
    ensureTemplateBackground(template);
  };

  // 渲染用的模板视图：bgImageUrl 为空但已有背景缓存时补上 dataUrl（仅内存，不落盘）
  const templateForRender = React.useMemo(
    () =>
      currentTemplate.bgType === 'image' && !currentTemplate.bgImageUrl && bgImageMap[currentTemplate.id]
        ? { ...currentTemplate, bgImageUrl: bgImageMap[currentTemplate.id] }
        : currentTemplate,
    [currentTemplate, bgImageMap]
  );

  // Handle custom image upload (temp front-end)
  const handleUploadCustomImage = (imageUrl: string, imgW: number, imgH: number) => {
    const customTemplate: Template = {
      id: `custom-${Date.now()}`,
      name: '自定义背景图片',
      category: '自定义',
      description: '上传的本地背景图片',
      aspectRatio: imgW / imgH,
      width: Math.min(1200, Math.max(800, imgW)),
      height: Math.min(1600, Math.max(800, imgH)),
      bgType: 'image',
      bgImageUrl: imageUrl,
      defaultFontId: 'zcool-kuaile',
      defaultColor: '#1e293b',
      isCustomDiy: false,
      slots: [
        {
          id: 'custom-slot-1',
          label: '文字 1',
          placeholder: '请输入要在框中显示的文字...',
          value: '自定义背景图文字示例',
          x: 20,
          y: 30,
          width: 60,
          height: 8,
          align: 'center',
          fontSize: 32,
          tagBgColor: '#2563eb',
          tagTextColor: '#ffffff',
        },
        {
          id: 'custom-slot-2',
          label: '文字 2',
          placeholder: '请输入第二行文字...',
          value: '你可以自由调整字体与颜色',
          x: 20,
          y: 50,
          width: 60,
          height: 8,
          align: 'center',
          fontSize: 32,
          tagBgColor: '#059669',
          tagTextColor: '#ffffff',
        },
      ],
    };

    setCurrentTemplate(customTemplate);
    setActiveSlotId(customTemplate.slots[0].id);
    currentTemplateIdRef.current = customTemplate.id;
  };

  // Handle slot value change
  const handleSlotChange = (slotId: string, value: string) => {
    setCurrentTemplate((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.id === slotId ? { ...s, value } : s)),
    }));
  };

  // Handle updating slot position (x, y) via dragging
  const handleUpdateSlotPos = (slotId: string, x: number, y: number) => {
    setCurrentTemplate((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.id === slotId ? { ...s, x, y } : s)),
    }));
  };

  // Handle resizing a text slot (x/y/width/height) via canvas handles
  const handleUpdateSlotSize = (
    slotId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    setCurrentTemplate((prev) => ({
      ...prev,
      slots: prev.slots.map((s) =>
        s.id === slotId && !isImageSlot(s) ? { ...s, x, y, width, height } : s
      ),
    }));
  };

  // Handle adding new slot (for custom image)
  const handleAddSlot = () => {
    const newId = `slot-${Date.now()}`;
    const newSlotCount = currentTemplate.slots.length + 1;
    const newSlot: TextSlot = {
      id: newId,
      label: `文字 ${newSlotCount}`,
      placeholder: '点击在此输入文本...',
      value: '新增文本内容',
      x: 20,
      y: Math.min(80, 20 + newSlotCount * 12),
      width: 60,
      height: 8,
      align: 'center',
      fontSize: 28,
      tagBgColor: '#7c3aed',
      tagTextColor: '#ffffff',
    };

    setCurrentTemplate((prev) => ({
      ...prev,
      slots: [...prev.slots, newSlot],
    }));
    setActiveSlotId(newId);
  };

  // Handle deleting slot
  const handleDeleteSlot = (slotId: string) => {
    if (currentTemplate.slots.length <= 1) return;
    setCurrentTemplate((prev) => ({
      ...prev,
      slots: prev.slots.filter((s) => s.id !== slotId),
    }));
  };

  // Handle locking/unlocking slot position
  const handleToggleLockSlot = (slotId: string) => {
    setCurrentTemplate((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.id === slotId ? { ...s, locked: !s.locked } : s)),
    }));
  };

  // 打开图片库：点击图片位时进入（有上传型选项则先确保 dataUrl 已拉取）
  const handleOpenImageLibrary = (slotId: string) => {
    const hasUploadOptions = (currentTemplate.imageOptions || []).some((o) => o.source === 'upload');
    if (hasUploadOptions) {
      ensureTemplateImages(currentTemplate);
    }
    setImageLibrarySlotId(slotId);
  };

  // 选中图片库中的一张图（或清除选择）写入对应图片位
  const handlePickImage = (slotId: string, optionId: string | null) => {
    setCurrentTemplate((prev) => ({
      ...prev,
      slots: prev.slots.map((s) =>
        s.id === slotId && isImageSlot(s) ? { ...s, value: optionId ?? undefined } : s
      ),
    }));
    setImageLibrarySlotId(null);
  };

  // Reset to initial default template values
  const handleReset = () => {
    const original = allTemplates.find((t) => t.id === currentTemplate.id) || allTemplates[0] || BUILTIN_TEMPLATES[0];
    setCurrentTemplate(JSON.parse(JSON.stringify(original)));
    setActiveSlotId(original.slots[0]?.id || null);
  };

  // Update options
  const handleOptionsChange = (newOptions: Partial<RenderOptions>) => {
    setRenderOptions((prev) => ({ ...prev, ...newOptions }));
  };

  // Final Image Generation Action: "图片生成"
  const handleGenerateImage = useCallback(async () => {
    // 内容安全检测：合成前对全部文字槽位做输入侧过滤，命中即阻止合成
    const textItems = currentTemplate.slots
      .filter((s) => !isImageSlot(s))
      .map((s) => {
        const t = s as TextSlot;
        return { label: t.label, value: t.value || '' };
      });
    const check = checkTextInputs(textItems);
    if (!check.safe) {
      setViolation({
        categoryLabel: check.categoryLabel,
        label: check.label,
        strikeCount: recordViolation(),
      });
      return;
    }

    setIsGenerating(true);

    try {
      // 生成前先确保背景已就绪（切换模板后立刻点生成也不会导出灰底/矢量底）
      const bg = await ensureTemplateBackground(currentTemplate);
      const renderTemplate = bg
        ? { ...currentTemplate, bgImageUrl: bg }
        : currentTemplate;

      // Create offscreen canvas for crisp 3x high-DPI rendering
      const offscreenCanvas = document.createElement('canvas');
      await renderTemplateToCanvas(offscreenCanvas, renderTemplate, renderOptions, 3, imagesMap);

      // JPEG 0.92：照片类模板体积从 ~20MB 降至 3~5MB，画质肉眼几乎无差异
      // （模板底图均为不透明照片/纯色，JPEG 无透明需求）
      const dataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.92);
      setGeneratedImageDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate final image:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [currentTemplate, renderOptions, imagesMap, ensureTemplateBackground]);

  // Admin trigger handler: open login modal or navigate directly if logged in
  const handleAdminEntranceClick = () => {
    if (adminUser) {
      setIsAdminView(true);
      // 进入后台强制绕过边缘缓存刷新，确保不同管理员看到一致的最新数据（如他人刚删除的模板）
      fetchAndSyncTemplates(true);
    } else {
      setIsAdminLoginModalOpen(true);
    }
  };

  const handleAdminLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    setIsAdminView(true);
    setLoginNotice(undefined);
    // 登录后台立即拉最新列表（绕过边缘缓存），避免看到其他管理员刚删除的模板
    fetchAndSyncTemplates(true);
  };

  // 改密成功后：后端已使当前令牌失效（pv+1），退出并引导重新登录
  const handlePasswordChanged = () => {
    handleAdminLogout();
    setLoginNotice('密码修改成功，请重新登录');
    setIsAdminLoginModalOpen(true);
  };

  const handleAdminLogout = () => {
    saveAdminSession(null);
    setAdminUser(null);
    setIsAdminView(false);
  };

  // 管理端列表注入已预取的背景图 dataUrl：bg 剥离后列表 JSON 不含图（bgImageUrl 为空），
  // 不注入则模板库封面图只显示占位图标；bgImageMap 已在后台预取管线中就绪，零新增请求
  const adminTemplates = React.useMemo(
    () =>
      allTemplates.map((t) =>
        t.bgType === 'image' && !t.bgImageUrl && bgImageMap[t.id]
          ? { ...t, bgImageUrl: bgImageMap[t.id] }
          : t
      ),
    [allTemplates, bgImageMap]
  );

  // 分享模式首屏：单模板拉取中（不渲染工作区，避免内置模板闪现）
  if (isShareMode && shareStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-3 font-sans text-slate-600">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
          <Sparkles className="w-5 h-5" />
        </div>
        <p className="text-sm">模板加载中…</p>
      </div>
    );
  }

  // 分享模式：模板未上线/不存在/已下架（后端 404）→ 提示页
  if (isShareMode && shareStatus === 'notFound') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 p-6 font-sans text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg">
          <Sparkles className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">该模板未上线</h1>
        <p className="text-sm text-slate-500">该分享链接对应的模板不存在或已被下架。</p>
        <a
          href="/"
          className="mt-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition-colors"
        >
          返回首页
        </a>
      </div>
    );
  }

  // If in Admin Management View, render the Admin Studio Dashboard
  if (isAdminView && adminUser) {
    return (
      <AdminPanel
        admin={adminUser}
        templates={adminTemplates}
        onBackToApp={() => setIsAdminView(false)}
        onLogout={handleAdminLogout}
        onRefreshTemplates={() => fetchAndSyncTemplates(true)}
        onSelectAndUseTemplate={(tpl) => {
          handleSelectTemplate(tpl);
          setIsAdminView(false);
        }}
        onPasswordChanged={handlePasswordChanged}
      />
    );
  }

  // Only published templates appear in the frontend dropdown
  const publishedTemplates = allTemplates.filter((t) => t.isPublished !== false);

  // 分享模式：不传任何框位操作回调 —— TemplateCanvas/EditorPanel 内部即隐藏
  // 拖拽、缩放、添加/删除、锁定等全部框位编辑入口（文字编辑与选图不受影响）
  const canvasSlotControls = isShareMode
    ? {}
    : {
        onUpdateSlotPos: handleUpdateSlotPos,
        onUpdateSlotSize: handleUpdateSlotSize,
        onAddSlot: handleAddSlot,
        onDeleteSlot: handleDeleteSlot,
        onToggleLockSlot: handleToggleLockSlot,
      };
  const panelSlotControls = isShareMode
    ? {}
    : {
        onUpdateSlotPos: handleUpdateSlotPos,
        onAddSlot: handleAddSlot,
        onDeleteSlot: handleDeleteSlot,
        onToggleLockSlot: handleToggleLockSlot,
      };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-800">
      
      {/* Navbar */}
      <Header
        // 仅首屏加载期（模板列表尚未拉取）回退展示内置模板；加载完成后只展示已上线模板，
        // 避免零发布场景把后台草稿泄露到前台下拉
        templates={
          templatesLoading && publishedTemplates.length === 0 ? allTemplates : publishedTemplates
        }
        currentTemplate={currentTemplate}
        loading={templatesLoading}
        shareMode={isShareMode}
        onSelectTemplate={handleSelectTemplate}
        onUploadCustomImage={handleUploadCustomImage}
        onReset={handleReset}
        onOpenAdminModal={handleAdminEntranceClick}
        admin={adminUser}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Template Canvas Preview (Sticky on desktop so preview stays in view when scrolling editor) */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col items-center lg:sticky lg:top-20 self-start">
            <TemplateCanvas
              template={templateForRender}
              options={renderOptions}
              activeSlotId={activeSlotId}
              onSelectSlot={(id) => {
                setActiveSlotId(id);
                setIsQuickEditClosed(false);
              }}
              {...canvasSlotControls}
              onPickImage={handleOpenImageLibrary}
              imagesMap={imagesMap}
              isCustomImage={currentTemplate.bgType === 'image'}
            />
          </div>

          {/* Right Column: Editor Controls & Input Boxes */}
          <div className="lg:col-span-6 xl:col-span-5 h-full">
            <EditorPanel
              template={currentTemplate}
              options={renderOptions}
              activeSlotId={activeSlotId}
              onSlotChange={handleSlotChange}
              onSelectSlot={(id) => {
                setActiveSlotId(id);
                setIsQuickEditClosed(false);
              }}
              {...panelSlotControls}
              onPickImage={handleOpenImageLibrary}
              imagesMap={imagesMap}
              onOptionsChange={handleOptionsChange}
              onGenerateImage={handleGenerateImage}
              isGenerating={isGenerating}
            />
          </div>

        </div>
      </main>

      {/* Mobile Floating Real-time Preview Window (Follows scroll when user scrolls down to tweak colors/fonts) */}
      <MobileFloatingPreview
        template={templateForRender}
        options={renderOptions}
        onGenerateImage={handleGenerateImage}
        isGenerating={isGenerating}
        imagesMap={imagesMap}
      />

      {/* Mobile Quick Text Editor Bottom Drawer (Scheme C) */}
      {!isQuickEditClosed && activeSlotId && (
        <MobileQuickEditor
          template={currentTemplate}
          activeSlotId={activeSlotId}
          onSlotChange={handleSlotChange}
          onSelectSlot={(id) => setActiveSlotId(id)}
          onClose={() => setIsQuickEditClosed(true)}
          onPickImage={handleOpenImageLibrary}
          onOpenFullStyles={() => {
            document.getElementById('editor-panel')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      )}

      {/* 图片库弹窗：点击图片位后逐位单选 */}
      {imageLibrarySlotId && (
        <ImageLibraryModal
          template={currentTemplate}
          imagesMap={imagesMap}
          loading={imagesLoading}
          slotId={imageLibrarySlotId}
          onPick={handlePickImage}
          onClose={() => setImageLibrarySlotId(null)}
        />
      )}

      {/* Popover Preview Modal when Image Generated */}
      <PreviewModal
        imageDataUrl={generatedImageDataUrl}
        onClose={() => setGeneratedImageDataUrl(null)}
      />

      {/* 内容安全拦截弹窗 */}
      <ContentGuardModal
        open={!!violation}
        categoryLabel={violation?.categoryLabel}
        label={violation?.label}
        strikeCount={violation?.strikeCount ?? 0}
        onClose={() => setViolation(null)}
      />

      {/* Admin Login / Registration Modal (Fig 1 Design + Triple Click Easter Egg) */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
        notice={loginNotice}
      />

    </div>
  );
}

