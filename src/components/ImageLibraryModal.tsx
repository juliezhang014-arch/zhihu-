import React, { useState } from 'react';
import { Template, ImageOption } from '../types';
import { X, Loader2, ImageOff } from 'lucide-react';

// 图片选项的显示源：外链直连 / 上传型取 imagesMap 中的 dataUrl（供多处复用）
export function getOptionImageSrc(
  option: ImageOption,
  imagesMap: Record<string, string>
): string | undefined {
  return option.source === 'url' ? option.url : imagesMap[option.id];
}

interface ImageLibraryModalProps {
  template: Template;
  imagesMap: Record<string, string>;
  loading: boolean;
  slotId: string;
  onPick: (slotId: string, optionId: string | null) => void;
  onClose: () => void;
}

export const ImageLibraryModal: React.FC<ImageLibraryModalProps> = ({
  template,
  imagesMap,
  loading,
  slotId,
  onPick,
  onClose,
}) => {
  const options = template.imageOptions || [];
  const slot = template.slots.find((s) => s.id === slotId);
  const currentValue = slot && slot.type === 'image' ? slot.value : undefined;
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(new Set());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[82vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-900">图片库 — 选择一张图片</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              点击任意图片即嵌入当前位置（逐位单选）
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="text-xs">正在加载图片库...</span>
            </div>
          ) : options.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              该模板没有可选的图片选项
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {options.map((opt) => {
                const src = getOptionImageSrc(opt, imagesMap);
                const isFailed = failedSrcs.has(opt.id);
                const isSelected = opt.id === currentValue;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onPick(slotId, opt.id)}
                    className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                        : 'border-slate-200 hover:border-blue-400 hover:shadow-md'
                    }`}
                    title={`选择「${opt.label}」`}
                  >
                    {src && !isFailed ? (
                      <img
                        src={src}
                        alt={opt.label}
                        className="w-full h-full object-cover"
                        onError={() =>
                          setFailedSrcs((prev) => new Set(prev).add(opt.id))
                        }
                      />
                    ) : (
                      <span className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-100 text-slate-400">
                        <ImageOff className="w-5 h-5" />
                        {isFailed && (
                          <span className="text-[9px] font-semibold text-rose-400">
                            加载失败
                          </span>
                        )}
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white">
                        已选择
                      </span>
                    )}
                    <span className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-slate-900/80 to-transparent text-[10px] font-semibold text-white truncate text-left">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[10px] text-slate-400">
            提示：外链图片需支持跨域 CORS，否则显示加载失败
          </p>
          <button
            type="button"
            onClick={() => onPick(slotId, null)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            清除选择
          </button>
        </div>
      </div>
    </div>
  );
};
