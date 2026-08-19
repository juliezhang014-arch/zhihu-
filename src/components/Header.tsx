import React, { useRef } from 'react';
import { ImagePlus, RotateCcw, Sparkles, LayoutTemplate, Shield, Settings, User } from 'lucide-react';
import { Template, AdminUser } from '../types';

interface HeaderProps {
  templates: Template[];
  currentTemplate: Template;
  loading?: boolean;
  onSelectTemplate: (template: Template) => void;
  onUploadCustomImage: (imageUrl: string, width: number, height: number) => void;
  onReset: () => void;
  onOpenAdminModal: () => void;
  admin: AdminUser | null;
}

export const Header: React.FC<HeaderProps> = ({
  templates,
  currentTemplate,
  loading = false,
  onSelectTemplate,
  onUploadCustomImage,
  onReset,
  onOpenAdminModal,
  admin,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const img = new Image();
        img.onload = () => {
          onUploadCustomImage(result, img.width, img.height);
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
          
          {/* Logo & Brand Title Bar */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight tracking-tight whitespace-nowrap">
                    图片模板合成器
                  </h1>
                  <span className="text-[10px] sm:text-xs font-normal px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                    实时合成
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden md:block">在图片模板中填充文字，一键生成配图</p>
              </div>
            </div>

            {/* Mobile Admin & Reset buttons */}
            <div className="sm:hidden flex items-center gap-1.5">
              <button
                onClick={onOpenAdminModal}
                className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors cursor-pointer shrink-0"
                title="管理后台"
              >
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                <span>{admin ? '后台' : '管理'}</span>
              </button>
              <button
                onClick={onReset}
                className="flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium rounded-lg border border-slate-200 transition-colors cursor-pointer shrink-0"
                title="重置当前文字内容"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重置</span>
              </button>
            </div>
          </div>

          {/* Controls Bar (Template Picker, Custom Image Upload, Admin, Reset) */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0 border-t border-slate-100 sm:border-t-0">
            
            {/* Template Dropdown */}
            <div className="relative flex items-center flex-1 sm:flex-none min-w-0">
              <LayoutTemplate className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
              <select
                value={currentTemplate.id}
                onChange={(e) => {
                  const found = templates.find((t) => t.id === e.target.value);
                  if (found) onSelectTemplate(found);
                }}
                className="w-full sm:w-auto pl-8 pr-7 py-1.5 sm:py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-800 hover:border-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer truncate"
              >
                {loading && (
                  <option disabled value="__loading__" className="text-slate-400">
                    模板加载中…
                  </option>
                )}
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}

                <option disabled value="coming-soon" className="text-slate-400 bg-slate-100">
                  更多模板持续更新中…
                </option>
              </select>
            </div>

            {/* Upload Custom Image */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-lg border border-slate-300 transition-colors cursor-pointer shrink-0"
              title="上传临时本地背景图"
            >
              <ImagePlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
              <span>临时换图</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {/* Desktop Reset Button */}
            <button
              onClick={onReset}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-sm font-medium rounded-lg transition-colors cursor-pointer shrink-0"
              title="重置当前文字内容"
            >
              <RotateCcw className="w-4 h-4" />
              <span>重置示例</span>
            </button>

            {/* Admin Management System Entrance Button */}
            <button
              onClick={onOpenAdminModal}
              className={`hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg border transition-all cursor-pointer shrink-0 shadow-xs ${
                admin
                  ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20'
              }`}
              title={admin ? `已登录: ${admin.username}，点击进入管理后台` : '管理员登录 / DIY 模板制作后台'}
            >
              <Shield className="w-4 h-4" />
              <span>{admin ? `管理后台 (${admin.username})` : '管理后台'}</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};

