import React from 'react';
import { Template, isImageSlot } from '../types';
import { X, ChevronLeft, ChevronRight, Sliders, Type, Image as ImageIcon } from 'lucide-react';

interface MobileQuickEditorProps {
  template: Template;
  activeSlotId: string | null;
  onSlotChange: (slotId: string, value: string) => void;
  onSelectSlot: (slotId: string) => void;
  onClose: () => void;
  onOpenFullStyles?: () => void;
  onPickImage?: (slotId: string) => void;
}

export const MobileQuickEditor: React.FC<MobileQuickEditorProps> = ({
  template,
  activeSlotId,
  onSlotChange,
  onSelectSlot,
  onClose,
  onOpenFullStyles,
  onPickImage,
}) => {
  if (!activeSlotId) return null;

  const currentSlotIndex = template.slots.findIndex((s) => s.id === activeSlotId);
  const activeSlot = template.slots[currentSlotIndex] || template.slots[0];

  if (!activeSlot) return null;

  const isActiveImg = isImageSlot(activeSlot);

  const handlePrev = () => {
    const prevIndex = (currentSlotIndex - 1 + template.slots.length) % template.slots.length;
    onSelectSlot(template.slots[prevIndex].id);
  };

  const handleNext = () => {
    const nextIndex = (currentSlotIndex + 1) % template.slots.length;
    onSelectSlot(template.slots[nextIndex].id);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl rounded-t-2xl sm:hidden p-3.5 transition-transform duration-200 ease-out animate-in slide-in-from-bottom">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
        
        {/* Horizontal scrollable slot chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
            <Type className="w-3 h-3" />
            框框:
          </span>
          {template.slots.map((s) => {
            const isSelected = s.id === activeSlotId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSlot(s.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs scale-105'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block shadow-2xs"
                  style={{ backgroundColor: isImageSlot(s) ? '#10b981' : s.tagBgColor || '#3b82f6' }}
                />
                <span>{isImageSlot(s) ? s.label || '图片位' : s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          title="收起快速编辑"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Area: 图片位 → 打开图片库；文字框 → 实时输入 */}
      <div className="relative mb-2.5">
        {isActiveImg ? (
          <button
            type="button"
            onClick={() => onPickImage?.(activeSlot.id)}
            className="w-full px-3 py-3 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-xl border border-emerald-300 flex items-center justify-center gap-2 active:bg-emerald-100 transition-all cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
            <span>{activeSlot.value ? '更换所选图片' : '从图片库选择图片'}</span>
          </button>
        ) : (
          <textarea
            rows={2}
            value={activeSlot.value}
            onChange={(e) => onSlotChange(activeSlot.id, e.target.value)}
            placeholder={activeSlot.placeholder || '在此输入文案内容...'}
            className="w-full px-3 py-2 bg-slate-50 text-slate-900 text-sm font-medium rounded-xl border border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all resize-none shadow-inner"
          />
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrev}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>上个框</span>
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
          >
            <span>下个框</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {onOpenFullStyles && (
          <button
            type="button"
            onClick={onOpenFullStyles}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 font-semibold border border-blue-200 transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span>调色号/字体 ⬇</span>
          </button>
        )}
      </div>
    </div>
  );
};
