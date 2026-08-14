import React, { useEffect, useRef, useState } from 'react';
import { Template, RenderOptions, TextSlot } from '../types';
import { renderTemplateToCanvas } from '../utils/canvasRenderer';
import { Eye, Move, Plus, Trash2, GripHorizontal } from 'lucide-react';

interface TemplateCanvasProps {
  template: Template;
  options: RenderOptions;
  activeSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
  onUpdateSlotPos?: (slotId: string, x: number, y: number) => void;
  onAddSlot?: () => void;
  onDeleteSlot?: (slotId: string) => void;
  onToggleLockSlot?: (slotId: string) => void;
  isCustomImage?: boolean;
}

export const TemplateCanvas: React.FC<TemplateCanvasProps> = ({
  template,
  options,
  activeSlotId,
  onSelectSlot,
  onUpdateSlotPos,
  onAddSlot,
  onDeleteSlot,
  onToggleLockSlot,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);

  // Render canvas whenever template or options change
  useEffect(() => {
    if (canvasRef.current) {
      renderTemplateToCanvas(canvasRef.current, template, options, 2);
    }
  }, [template, options]);

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
            const isLocked = slot.locked ?? false;

            return (
              <div
                key={slot.id}
                onMouseDown={(e) => handleStartDrag(e, slot, slot.x, slot.y)}
                onTouchStart={(e) => handleStartDrag(e, slot, slot.x, slot.y)}
                className={`absolute transition-colors rounded-lg border-2 flex items-center justify-between group select-none ${
                  isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                } ${
                  isActive
                    ? 'border-blue-500 bg-blue-500/15 ring-2 ring-blue-400/50 z-20 shadow-md'
                    : 'border-dashed border-slate-400/50 hover:border-blue-400 hover:bg-blue-400/10 z-10'
                } ${isDragging ? 'ring-4 ring-blue-500/60 scale-[1.01]' : ''}`}
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: `${slot.width}%`,
                  height: `${slot.height}%`,
                }}
                title={`点击编辑文本: ${slot.label}`}
              >
                {/* Active / Hover Drag Badge */}
                <div
                  className={`absolute -top-3.5 left-2 px-1.5 py-0.5 rounded-sm text-[10px] font-bold flex items-center gap-1 shadow-2xs pointer-events-none transition-opacity ${
                    isActive
                      ? 'bg-blue-600 text-white opacity-100'
                      : 'bg-slate-800/80 text-white opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <GripHorizontal className="w-3 h-3" />
                  <span>{slot.label}</span>
                </div>

                {/* Delete Button (If more than 1 slot) */}
                {onDeleteSlot && template.slots.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSlot(slot.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 absolute -top-3 -right-3 p-1 bg-red-600 text-white rounded-full shadow-md hover:bg-red-700 transition-opacity cursor-pointer z-30"
                    title="删除文本框"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500 text-center flex items-center justify-center gap-1 flex-wrap">
        <Move className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span>提示：点击图中框框进行文本编辑；需要移动框框时，可在下方卡片右上方点击 🔒 解锁。</span>
      </p>
    </div>
  );
};
