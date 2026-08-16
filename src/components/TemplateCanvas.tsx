import React, { useEffect, useRef, useState } from 'react';
import { Template, RenderOptions, TextSlot, isImageSlot } from '../types';
import { renderTemplateToCanvas } from '../utils/canvasRenderer';
import { Eye, Move, Plus, Trash2, GripHorizontal, Image as ImageIcon } from 'lucide-react';

interface TemplateCanvasProps {
  template: Template;
  options: RenderOptions;
  activeSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
  onUpdateSlotPos?: (slotId: string, x: number, y: number) => void;
  onUpdateSlotSize?: (slotId: string, x: number, y: number, width: number, height: number) => void;
  onAddSlot?: () => void;
  onDeleteSlot?: (slotId: string) => void;
  onToggleLockSlot?: (slotId: string) => void;
  onPickImage?: (slotId: string) => void;
  imagesMap?: Record<string, string>;
  isCustomImage?: boolean;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const TemplateCanvas: React.FC<TemplateCanvasProps> = ({
  template,
  options,
  activeSlotId,
  onSelectSlot,
  onUpdateSlotPos,
  onUpdateSlotSize,
  onAddSlot,
  onDeleteSlot,
  onToggleLockSlot,
  onPickImage,
  imagesMap = {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [resizingSlotId, setResizingSlotId] = useState<string | null>(null);

  // Render canvas whenever template or options change
  useEffect(() => {
    if (canvasRef.current) {
      renderTemplateToCanvas(canvasRef.current, template, options, 2, imagesMap);
    }
  }, [template, options, imagesMap]);

  // Handle Dragging Slot Box
  const handleStartDrag = (
    e: React.MouseEvent | React.TouchEvent,
    slot: TextSlot,
    currentX: number,
    currentY: number
  ) => {
    e.stopPropagation();
    onSelectSlot(slot.id);

    // If locked, prevent position dragging
    if (slot.locked) return;

    if (!onUpdateSlotPos || !containerRef.current) return;

    setDraggingSlotId(slot.id);

    const containerRect = containerRef.current.getBoundingClientRect();
    const startClientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startClientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const startXPercent = currentX;
    const startYPercent = currentY;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentClientX =
        'touches' in moveEvent
          ? moveEvent.touches[0].clientX
          : (moveEvent as MouseEvent).clientX;
      const currentClientY =
        'touches' in moveEvent
          ? moveEvent.touches[0].clientY
          : (moveEvent as MouseEvent).clientY;

      const deltaPxX = currentClientX - startClientX;
      const deltaPxY = currentClientY - startClientY;

      const deltaPercentX = (deltaPxX / containerRect.width) * 100;
      const deltaPercentY = (deltaPxY / containerRect.height) * 100;

      const newX = Math.max(0, Math.min(95, Math.round((startXPercent + deltaPercentX) * 10) / 10));
      const newY = Math.max(2, Math.min(98, Math.round((startYPercent + deltaPercentY) * 10) / 10));

      onUpdateSlotPos(slot.id, newX, newY);
    };

    const handleEnd = () => {
      setDraggingSlotId(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  // 8 向自由缩放（与管理端一致的逻辑与手感；仅未锁定文字框可用）
  const handleStartResize = (
    e: React.MouseEvent | React.TouchEvent,
    slot: TextSlot,
    handle: ResizeHandle
  ) => {
    e.stopPropagation();
    onSelectSlot(slot.id);

    // If locked, prevent resizing
    if (slot.locked) return;

    if (!onUpdateSlotSize || !containerRef.current) return;

    setResizingSlotId(slot.id);

    const containerRect = containerRef.current.getBoundingClientRect();
    const startClientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startClientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const initialX = slot.x;
    const initialY = slot.y;
    const initialW = slot.width;
    const initialH = slot.height;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentClientX =
        'touches' in moveEvent
          ? moveEvent.touches[0].clientX
          : (moveEvent as MouseEvent).clientX;
      const currentClientY =
        'touches' in moveEvent
          ? moveEvent.touches[0].clientY
          : (moveEvent as MouseEvent).clientY;

      const deltaXPercent = ((currentClientX - startClientX) / containerRect.width) * 100;
      const deltaYPercent = ((currentClientY - startClientY) / containerRect.height) * 100;

      let newX = initialX;
      let newY = initialY;
      let newW = initialW;
      let newH = initialH;

      // 右侧 / 东
      if (handle === 'e' || handle === 'se' || handle === 'ne') {
        newW = Math.max(4, Math.min(100 - initialX, initialW + deltaXPercent));
      }
      // 下侧 / 南
      if (handle === 's' || handle === 'se' || handle === 'sw') {
        newH = Math.max(2, Math.min(100 - initialY, initialH + deltaYPercent));
      }
      // 左侧 / 西
      if (handle === 'w' || handle === 'nw' || handle === 'sw') {
        const boundedDeltaX = Math.min(initialW - 4, deltaXPercent);
        newX = Math.max(0, initialX + boundedDeltaX);
        newW = initialW - (newX - initialX);
      }
      // 上侧 / 北
      if (handle === 'n' || handle === 'nw' || handle === 'ne') {
        const boundedDeltaY = Math.min(initialH - 2, deltaYPercent);
        newY = Math.max(0, initialY + boundedDeltaY);
        newH = initialH - (newY - initialY);
      }

      onUpdateSlotSize(
        slot.id,
        Number(newX.toFixed(2)),
        Number(newY.toFixed(2)),
        Number(newW.toFixed(2)),
        Number(newH.toFixed(2))
      );
    };

    const handleEnd = () => {
      setResizingSlotId(null);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4 lg:p-6 bg-slate-200/70 rounded-2xl border border-slate-300 relative select-none min-h-[500px]">
      
      {/* Top Bar Indicators */}
      <div className="w-full flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-full border border-slate-300/80 shadow-2xs">
          <Eye className="w-3.5 h-3.5 text-blue-600" />
          <span>模板实时预览 ({template.width} × {template.height}px)</span>
        </div>

        {onAddSlot && (
          <button
            onClick={onAddSlot}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full border border-blue-200 shadow-2xs transition-colors cursor-pointer"
            title="手动添加新的文字框"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>添加文字框</span>
          </button>
        )}
      </div>

      {/* Canvas Wrapper */}
      <div
        ref={containerRef}
        className="relative shadow-xl rounded-xl overflow-hidden bg-white max-w-full flex items-center justify-center transition-all border border-slate-300"
        style={{
          aspectRatio: `${template.aspectRatio}`,
          maxHeight: 'calc(100vh - 180px)',
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain block"
        />

        {/* Overlay Hotspots for Slot Selection & Dragging */}
        <div className="absolute inset-0 pointer-events-auto">
          {template.slots.map((slot) => {
            const isActive = slot.id === activeSlotId;
            const isDragging = slot.id === draggingSlotId;
            const isResizing = slot.id === resizingSlotId;
            const isLocked = slot.locked ?? false;
            const isImg = isImageSlot(slot);

            // 图片位：点击直接打开图片库（逐位单选），不进入拖拽
            const handleHotspotDown = (e: React.MouseEvent | React.TouchEvent) => {
              if (isImg) {
                e.stopPropagation();
                onSelectSlot(slot.id);
                onPickImage?.(slot.id);
                return;
              }
              handleStartDrag(e, slot, slot.x, slot.y);
            };

            return (
              <div
                key={slot.id}
                onMouseDown={handleHotspotDown}
                onTouchStart={handleHotspotDown}
                className={`absolute transition-colors rounded-lg border-2 flex items-center justify-between group select-none ${
                  isImg ? 'cursor-pointer' : isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                } ${
                  isActive
                    ? isImg
                      ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-400/50 z-20 shadow-md'
                      : 'border-blue-500 bg-blue-500/15 ring-2 ring-blue-400/50 z-20 shadow-md'
                    : isImg
                    ? 'border-dashed border-emerald-400/60 hover:border-emerald-400 hover:bg-emerald-400/10 z-10'
                    : 'border-dashed border-slate-400/50 hover:border-blue-400 hover:bg-blue-400/10 z-10'
                } ${isDragging ? 'ring-4 ring-blue-500/60 scale-[1.01]' : ''} ${isResizing ? 'ring-4 ring-blue-500/60' : ''}`}
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: `${slot.width}%`,
                  height: `${slot.height}%`,
                }}
                title={isImg ? `点击从图片库选择: ${slot.label || '图片位'}` : `点击编辑文本: ${slot.label}`}
              >
                {/* Active / Hover Drag Badge */}
                <div
                  className={`absolute -top-3.5 left-2 px-1.5 py-0.5 rounded-sm text-[10px] font-bold flex items-center gap-1 shadow-2xs pointer-events-none transition-opacity ${
                    isActive
                      ? isImg
                        ? 'bg-emerald-600 text-white opacity-100'
                        : 'bg-blue-600 text-white opacity-100'
                      : 'bg-slate-800/80 text-white opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {isImg ? (
                    <ImageIcon className="w-3 h-3" />
                  ) : (
                    <GripHorizontal className="w-3 h-3" />
                  )}
                  <span>{isImg ? slot.label || '图片位' : slot.label}</span>
                </div>

                {/* Delete Button (If more than 1 slot) */}
                {onDeleteSlot && template.slots.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSlot(slot.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 absolute -top-3 -right-3 p-1 bg-red-600 text-white rounded-full shadow-md hover:bg-red-700 transition-opacity cursor-pointer z-30"
                    title="删除框"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}

                {/* 8 向缩放手柄（选中且未锁定的文字框可自由调整大小，同管理端） */}
                {!isImg && isActive && !isLocked && onUpdateSlotSize && (
                  <>
                    {/* 左上 NW */}
                    <div
                      onMouseDown={(e) => handleStartResize(e, slot, 'nw')}
                      onTouchStart={(e) => handleStartResize(e, slot, 'nw')}
                      className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full shadow-xs cursor-nwse-resize hover:scale-125 transition-transform z-40"
                      title="自由拉伸"
                    />
                    {/* 上 N */}
                    <div
                      onMouseDown={(e) => handleStartResize(e, slot, 'n')}
                      onTouchStart={(e) => handleStartResize(e, slot, 'n')}
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-xs cursor-ns-resize hover:scale-125 transition-transform z-40"
                      title="调整高度"
                    />
                    {/* 右上 NE */}
                    <div
                      onMouseDown={(e) => handleStartResize(e, slot, 'ne')}
                      onTouchStart={(e) => handleStartResize(e, slot, 'ne')}
                      className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full shadow-xs cursor-nesw-resize hover:scale-125 transition-transform z-40"
                      title="自由拉伸"
                    />
                    {/* 右 E */}
                    <div
                      onMouseDown={(e) => handleStartResize(e, slot, 'e')}
                      onTouchStart={(e) => handleStartResize(e, slot, 'e')}
                      className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-xs cursor-ew-resize hover:scale-125 transition-transform z-40"
                      title="调整宽度"
                    />
                    {/* 右下 SE */}
                    <div
                      onMouseDown={(e) => handleStartResize(e, slot, 'se')}
                      onTouchStart={(e) => handleStartResize(e, slot, 'se')}
                      className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full shadow-xs cursor-nwse-resize hover:scale-125 transition-transform z-40"
                      title="自由拉伸"
                    />
                    {/* 下 S */}
                    <div
                      onMouseDown={(e) => handleStartResize(e, slot, 's')}
                      onTouchStart={(e) => handleStartResize(e, slot, 's')}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-xs cursor-ns-resize hover:scale-125 transition-transform z-40"
                      title="调整高度"
                    />
                    {/* 左下 SW */}
                    <div
                      onMouseDown={(e) => handleStartResize(e, slot, 'sw')}
                      onTouchStart={(e) => handleStartResize(e, slot, 'sw')}
                      className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-full shadow-xs cursor-nesw-resize hover:scale-125 transition-transform z-40"
                      title="自由拉伸"
                    />
                    {/* 左 W */}
                    <div
                      onMouseDown={(e) => handleStartResize(e, slot, 'w')}
                      onTouchStart={(e) => handleStartResize(e, slot, 'w')}
                      className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-xs cursor-ew-resize hover:scale-125 transition-transform z-40"
                      title="调整宽度"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500 text-center flex items-center justify-center gap-1 flex-wrap">
        <Move className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span>提示：点击文字框编辑文本，点击图片位从图片库选图；选中未锁定的文字框可拖动移动、拉动四周圆点自由缩放，或在下图卡片右上方点击 🔒 解锁后操作。</span>
      </p>
    </div>
  );
};
