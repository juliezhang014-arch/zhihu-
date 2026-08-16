import React from 'react';
import { Type, Palette, Sparkles, SlidersHorizontal, Bold, Check, Plus, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Lock, Unlock, Image as ImageIcon } from 'lucide-react';
import { Template, RenderOptions, TextSlot, FontOption, isImageSlot } from '../types';
import { CHINESE_FONTS } from '../data/fonts';
import { COLOR_PRESETS } from '../data/colors';
import { getOptionImageSrc } from './ImageLibraryModal';

interface EditorPanelProps {
  template: Template;
  options: RenderOptions;
  activeSlotId: string | null;
  onSlotChange: (slotId: string, value: string) => void;
  onSelectSlot: (slotId: string) => void;
  onUpdateSlotPos?: (slotId: string, x: number, y: number) => void;
  onAddSlot?: () => void;
  onDeleteSlot?: (slotId: string) => void;
  onToggleLockSlot?: (slotId: string) => void;
  onPickImage?: (slotId: string) => void;
  imagesMap?: Record<string, string>;
  onOptionsChange: (newOptions: Partial<RenderOptions>) => void;
  onGenerateImage: () => void;
  isGenerating?: boolean;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  template,
  options,
  activeSlotId,
  onSlotChange,
  onSelectSlot,
  onUpdateSlotPos,
  onAddSlot,
  onDeleteSlot,
  onToggleLockSlot,
  onPickImage,
  imagesMap = {},
  onOptionsChange,
  onGenerateImage,
  isGenerating = false,
}) => {
  return (
    <div id="editor-panel" className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-20">
      
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-none">内容编辑与样式设定</h2>
            <p className="text-xs text-slate-500 mt-0.5">右侧编辑框实时同步至图片模版</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-200/80 text-slate-700 rounded-md">
          共 {template.slots.length} 个框（{template.slots.filter(isImageSlot).length} 图片位 + {template.slots.filter((s) => !isImageSlot(s)).length} 文字框）
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* 1. Text Slot Editable Boxes (Gray Styled Blocks matching user's diagram) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-blue-600" />
              编辑框列表
            </label>
            {onAddSlot && (
              <button
                onClick={onAddSlot}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加文字框</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {template.slots.map((slot, index) => {
              const isActive = slot.id === activeSlotId;
              const isImg = isImageSlot(slot);
              const selectedOpt = isImg
                ? (template.imageOptions || []).find((o) => o.id === slot.value)
                : undefined;
              const selectedSrc = selectedOpt
                ? getOptionImageSrc(selectedOpt, imagesMap)
                : undefined;
              return (
                <div
                  key={slot.id}
                  onClick={() => onSelectSlot(slot.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? isImg
                        ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-100 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-slate-100/90 hover:bg-slate-200/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md text-white shadow-2xs flex items-center gap-1 ${
                          isImg ? 'bg-emerald-600' : ''
                        }`}
                        style={isImg ? undefined : { backgroundColor: slot.tagBgColor || '#3b82f6' }}
                      >
                        {isImg && <ImageIcon className="w-3 h-3" />}
                        {isImg ? slot.label || '图片位' : slot.label}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        框框 #{index + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isActive && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                          isImg ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50'
                        }`}>
                          正在编辑
                        </span>
                      )}
                      
                      {/* Lock/Unlock Button (To the left of Trash2 Delete Icon) */}
                      {onToggleLockSlot && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLockSlot(slot.id);
                          }}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            slot.locked
                              ? 'text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                          }`}
                          title={slot.locked ? '位置已锁定（点击解锁）' : '未锁定位置（点击加锁）'}
                        >
                          {slot.locked ? (
                            <Lock className="w-3.5 h-3.5 text-amber-700" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      {/* Delete Button */}
                      {onDeleteSlot && template.slots.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSlot(slot.id);
                          }}
                          className="text-slate-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                          title="删除此编辑框"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 图片位：当前选择 + 打开图片库；文字框：文本输入 */}
                  {isImg ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-300 bg-slate-200 shrink-0 flex items-center justify-center">
                        {selectedSrc ? (
                          <img
                            src={selectedSrc}
                            alt={selectedOpt?.label || '已选图片'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-700 truncate">
                          {selectedOpt ? `已选：${selectedOpt.label}` : '未选择图片'}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPickImage?.(slot.id);
                          }}
                          className="mt-1.5 flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                        >
                          <ImageIcon className="w-3 h-3" />
                          打开图片库
                        </button>
                      </div>
                    </div>
                  ) : (
                    <textarea
                      rows={2}
                      value={slot.value}
                      onChange={(e) => onSlotChange(slot.id, e.target.value)}
                      onFocus={() => onSelectSlot(slot.id)}
                      placeholder={slot.placeholder}
                      style={{
                        color: slot.value ? (slot.color || options.globalColor || '#1e293b') : undefined,
                      }}
                      className="w-full px-3 py-2 bg-slate-200/90 text-slate-800 placeholder-slate-400 text-sm font-medium rounded-lg border border-slate-300 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all resize-none"
                    />
                  )}

                  {/* Position Fine-Tuning Nudge Controls for Active Slot */}
                  {isActive && onUpdateSlotPos && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-600">框框位置微调:</span>
                      <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateSlotPos(slot.id, slot.x, Math.max(0, slot.y - 0.5));
                            }}
                            className="p-1 rounded bg-white hover:bg-slate-200 border border-slate-300 cursor-pointer"
                            title="向上移"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateSlotPos(slot.id, slot.x, Math.min(100, slot.y + 0.5));
                            }}
                            className="p-1 rounded bg-white hover:bg-slate-200 border border-slate-300 cursor-pointer"
                            title="向下移"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateSlotPos(slot.id, Math.max(0, slot.x - 0.5), slot.y);
                            }}
                            className="p-1 rounded bg-white hover:bg-slate-200 border border-slate-300 cursor-pointer"
                            title="向左移"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateSlotPos(slot.id, Math.min(100, slot.x + 0.5), slot.y);
                            }}
                            className="p-1 rounded bg-white hover:bg-slate-200 border border-slate-300 cursor-pointer"
                            title="向右移"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <hr className="border-slate-200" />

        {/* 2. Chinese Font Selection */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
            <Type className="w-3.5 h-3.5 text-blue-600" />
            字体选择 (提供 3-5+ 常用中文字体)
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CHINESE_FONTS.map((font) => {
              const isSelected = options.globalFontFamily === font.fontFamily;
              return (
                <button
                  key={font.id}
                  onClick={() => onOptionsChange({ globalFontFamily: font.fontFamily })}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-xs font-semibold block text-slate-800 truncate mb-1">
                    {font.name.split(' ')[0]}
                  </span>
                  
                  {/* Font Visual Sample */}
                  <span
                    className="text-base text-slate-900 block truncate"
                    style={{ fontFamily: font.fontFamily }}
                  >
                    {font.previewText || '锐评表达'}
                  </span>

                  {isSelected && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <hr className="border-slate-200" />

        {/* 3. Text Color Palette Picker */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-blue-600" />
              文字颜色调色盘
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">HEX: {options.globalColor}</span>
              <input
                type="color"
                value={options.globalColor}
                onChange={(e) => onOptionsChange({ globalColor: e.target.value })}
                className="w-7 h-7 rounded-lg border border-slate-300 cursor-pointer p-0 bg-transparent"
                title="选择自定义颜色"
              />
            </div>
          </div>

          {/* Color Chips */}
          <div className="flex flex-wrap gap-2.5">
            {COLOR_PRESETS.map((preset) => {
              const isSelected = options.globalColor.toLowerCase() === preset.hex.toLowerCase();
              return (
                <button
                  key={preset.id}
                  onClick={() => onOptionsChange({ globalColor: preset.hex })}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer relative ${
                    isSelected
                      ? 'ring-2 ring-offset-2 ring-blue-600 scale-105 shadow-xs'
                      : 'border-slate-300 hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset.hex }}
                  title={`${preset.name} (${preset.hex})`}
                >
                  {isSelected && (
                    <Check
                      className={`w-4 h-4 ${
                        preset.hex === '#ffffff' ? 'text-slate-900' : 'text-white'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <hr className="border-slate-200" />

        {/* 4. Fine-Tuning Size & Style Controls */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
            字号与排版微调
          </label>

          <div className="space-y-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            {/* Font Scale Slider */}
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>字号缩放比例</span>
                <span>{Math.round(options.fontSizeScale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.5"
                step="0.05"
                value={options.fontSizeScale}
                onChange={(e) => onOptionsChange({ fontSizeScale: parseFloat(e.target.value) })}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Bold and Shadow Toggles */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() =>
                  onOptionsChange({
                    fontWeight: options.fontWeight === 'bold' ? 'normal' : 'bold',
                  })
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                  options.fontWeight === 'bold'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
                加粗显示
              </button>

              <button
                onClick={() => onOptionsChange({ shadowEnabled: !options.shadowEnabled })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                  options.shadowEnabled
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                文字轻立体阴影
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Primary Action: 图片生成 (Generate Image Button) */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
        <button
          onClick={onGenerateImage}
          disabled={isGenerating}
          className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 text-white font-bold text-base rounded-xl shadow-md shadow-blue-500/25 hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span>图片生成</span>
        </button>
      </div>

    </div>
  );
};
