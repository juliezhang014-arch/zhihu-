import React, { useEffect, useRef, useState } from 'react';
import { Template, RenderOptions } from '../types';
import { renderTemplateToCanvas } from '../utils/canvasRenderer';
import { Eye, ArrowUp, Sparkles, X, Maximize2, Minimize2 } from 'lucide-react';

interface MobileFloatingPreviewProps {
  template: Template;
  options: RenderOptions;
  onGenerateImage?: () => void;
  isGenerating?: boolean;
  imagesMap?: Record<string, string>;
}

export const MobileFloatingPreview: React.FC<MobileFloatingPreviewProps> = ({
  template,
  options,
  onGenerateImage,
  isGenerating,
  imagesMap = {},
}) => {
  const miniCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Render mini canvas whenever template or options update in real time
  useEffect(() => {
    if (miniCanvasRef.current && isVisible && !isDismissed) {
      renderTemplateToCanvas(miniCanvasRef.current, template, options, 2, imagesMap);
    }
  }, [template, options, imagesMap, isVisible, isDismissed, isExpanded]);

  // Monitor scroll position on mobile to show floating preview when main canvas scrolls out of view
  useEffect(() => {
    const handleScroll = () => {
      // If screen is lg (desktop), we don't need floating preview since desktop uses sticky layout
      if (window.innerWidth >= 1024) {
        setIsVisible(false);
        return;
      }

      // Check if user has scrolled past 260px (past top canvas)
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      if (scrollY > 260) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
        setIsDismissed(false); // Reset dismissal when user scrolls back to top
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div
      className={`fixed z-40 lg:hidden transition-all duration-300 ease-out ${
        isExpanded
          ? 'bottom-20 right-4 left-4 max-w-sm mx-auto'
          : 'bottom-20 right-3'
      }`}
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-blue-200 p-2.5 flex flex-col items-center animate-in zoom-in-95 duration-200">
        {/* Header bar */}
        <div className="w-full flex items-center justify-between gap-1 mb-1.5 px-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Eye className="w-3 h-3 text-blue-600" />
            <span>实时随动预览</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Scroll back to top */}
            <button
              type="button"
              onClick={handleScrollToTop}
              className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="回到顶部查看大图"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>

            {/* Expand / Minimize toggle */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title={isExpanded ? '缩小预览' : '放大预览'}
            >
              {isExpanded ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Close/Dismiss */}
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="暂时关闭浮窗"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Mini Canvas Container */}
        <div
          onClick={handleScrollToTop}
          className="relative rounded-xl overflow-hidden shadow-inner bg-slate-100 border border-slate-200 cursor-pointer flex items-center justify-center transition-all group"
          style={{
            width: isExpanded ? '100%' : '130px',
            aspectRatio: `${template.aspectRatio || 0.75}`,
            maxHeight: isExpanded ? '280px' : '170px',
          }}
          title="点击回到顶部查看原图"
        >
          <canvas
            ref={miniCanvasRef}
            className="w-full h-full object-contain block"
          />

          {/* Hover overlay hint */}
          <div className="absolute inset-0 bg-blue-900/15 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <span className="text-[10px] font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded-full shadow-sm">
              点击回顶部
            </span>
          </div>
        </div>

        {/* Quick action bar inside expanded view */}
        {isExpanded && onGenerateImage && (
          <div className="w-full mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleScrollToTop}
              className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              <ArrowUp className="w-3 h-3" />
              <span>回顶部大图</span>
            </button>
            <button
              type="button"
              onClick={onGenerateImage}
              disabled={isGenerating}
              className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3" />
              <span>{isGenerating ? '生成中...' : '生成图片'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
