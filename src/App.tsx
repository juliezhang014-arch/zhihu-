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
import { getAllTemplates, getSavedAdminSession, saveAdminSession, fetchTemplateImages, fetchTemplateBackground } from './services/api';

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

  // 图片位相关状态：upload 型选项的 dataUrl 只存在内存（绝不写 localStorage）
  const [imagesMap, setImagesMap] = useState<Record<string, string>>({});
  const [imageLibrarySlotId, setImageLibrarySlotId] = useState<string | null>(null);
  const [imagesLoading, setImagesLoading] = useState<boolean>(false);
  // 模板背景图 dataUrl 内存映射（模板 JSON 已剥离背景，渲染前按需拉取；同样不进 localStorage）
  const [bgImageMap, setBgImageMap] = useState<Record<string, string>>({});
  // 模板列表首次拉取中状态（新访客先看到内置模板，下拉框显示「加载中」）
  const [templatesLoading, setTemplatesLoading] = useState<boolean>(true);
  const currentTemplateIdRef = useRef<string>(BUILTIN_TEMPLATES[0].id);

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
    fetchAndSyncTemplates();
  }, [fetchAndSyncTemplates]);

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
    } else {
      setIsAdminLoginModalOpen(true);
    }
  };

  const handleAdminLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    setIsAdminView(true);
  };

  const handleAdminLogout = () => {
    saveAdminSession(null);
    setAdminUser(null);
    setIsAdminView(false);
  };

  // If in Admin Management View, render the Admin Studio Dashboard
  if (isAdminView && adminUser) {
    return (
      <AdminPanel
        admin={adminUser}
        templates={allTemplates}
        onBackToApp={() => setIsAdminView(false)}
        onLogout={handleAdminLogout}
        onRefreshTemplates={() => fetchAndSyncTemplates(true)}
        onSelectAndUseTemplate={(tpl) => {
          handleSelectTemplate(tpl);
          setIsAdminView(false);
        }}
      />
    );
  }

  // Only published templates appear in the frontend dropdown
  const publishedTemplates = allTemplates.filter((t) => t.isPublished !== false);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-800">
      
      {/* Navbar */}
      <Header
        templates={publishedTemplates.length > 0 ? publishedTemplates : allTemplates}
        currentTemplate={currentTemplate}
        loading={templatesLoading}
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
              onUpdateSlotPos={handleUpdateSlotPos}
              onUpdateSlotSize={handleUpdateSlotSize}
              onAddSlot={handleAddSlot}
              onDeleteSlot={handleDeleteSlot}
              onToggleLockSlot={handleToggleLockSlot}
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
              onUpdateSlotPos={handleUpdateSlotPos}
              onAddSlot={handleAddSlot}
              onDeleteSlot={handleDeleteSlot}
              onToggleLockSlot={handleToggleLockSlot}
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

      {/* Admin Login / Registration Modal (Fig 1 Design + Triple Click Easter Egg) */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
      />

    </div>
  );
}

