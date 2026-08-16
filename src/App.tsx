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
import { getAllTemplates, getSavedAdminSession, saveAdminSession, fetchTemplateImages } from './services/api';

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
  const currentTemplateIdRef = useRef<string>(BUILTIN_TEMPLATES[0].id);

  // 拉取模板 upload 型图片选项的 dataUrl 合并进内存映射；失败不阻断编辑
  const ensureTemplateImages = useCallback(async (template: Template) => {
    const uploadOptions = (template.imageOptions || []).filter((o) => o.source === 'upload');
    if (uploadOptions.length === 0) return;
    setImagesLoading(true);
    try {
      const images = await fetchTemplateImages(template.id);
      setImagesMap((prev) => ({ ...prev, ...images }));
    } catch (err) {
      console.warn('Failed to load template images:', err);
    } finally {
      setImagesLoading(false);
    }
  }, []);

  // Fetch templates from server on initial mount
  const fetchAndSyncTemplates = useCallback(async () => {
    try {
      const list = await getAllTemplates();
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
      if (found) ensureTemplateImages(found);
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  }, [ensureTemplateImages]);

  useEffect(() => {
    fetchAndSyncTemplates();
  }, [fetchAndSyncTemplates]);

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
  };

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
      // Create offscreen canvas for crisp 3x high-DPI rendering
      const offscreenCanvas = document.createElement('canvas');
      await renderTemplateToCanvas(offscreenCanvas, currentTemplate, renderOptions, 3, imagesMap);

      const dataUrl = offscreenCanvas.toDataURL('image/png', 1.0);
      setGeneratedImageDataUrl(dataUrl);
    } catch (err) {
      console.error('Failed to generate final image:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [currentTemplate, renderOptions, imagesMap]);

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
        onRefreshTemplates={fetchAndSyncTemplates}
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
              template={currentTemplate}
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
        template={currentTemplate}
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

