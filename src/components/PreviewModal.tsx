import React, { useState } from 'react';
import { Download, ArrowLeft, Check, Share2, Copy, Sparkles, X } from 'lucide-react';

interface PreviewModalProps {
  imageDataUrl: string | null;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ imageDataUrl, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!imageDataUrl) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `锐评模版合成图_${Date.now()}.png`;
    link.href = imageDataUrl;
    link.click();
  };

  const handleCopy = async () => {
    try {
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy image to clipboard:', err);
      // Fallback download if clipboard fails
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
      
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">图片合成成功</h3>
              <p className="text-xs text-slate-500">可在下方预览高清图片，长按保存或下载导出</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
            title="关闭预览"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Preview Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/90 flex flex-col items-center justify-center min-h-[350px]">
          
          <div className="relative group max-w-lg w-full shadow-2xl rounded-2xl overflow-hidden border border-slate-200 bg-white">
            <img
              src={imageDataUrl}
              alt="合成后图片预览"
              className="w-full h-auto object-contain block select-none"
              referrerPolicy="no-referrer"
            />
            
            {/* Long Press Badge Overlay */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/85 backdrop-blur-md text-white text-xs px-4 py-1.5 rounded-full shadow-lg pointer-events-none flex items-center gap-1.5 whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>移动端可长按图片保存到相册，桌面端可右键另存为</span>
            </div>
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Left Action: 返回继续修改 (Back to Edit) */}
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回继续修改</span>
          </button>

          {/* Right Actions: Copy & Download */}
          <div className="w-full sm:w-auto flex items-center gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">已复制到剪贴板</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-600" />
                  <span>复制图片</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="flex-1 sm:flex-initial px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>下载保存图片</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
