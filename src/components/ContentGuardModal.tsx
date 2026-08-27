import React from 'react';
import { ShieldAlert, X } from 'lucide-react';

interface ContentGuardModalProps {
  open: boolean;
  categoryLabel?: string; // 命中分类（政治敏感/色情低俗等）
  label?: string; // 命中的文字框标签
  strikeCount?: number; // 当日累计违规次数（达到阈值时提示更严厉）
  errorMessage?: string; // 检测服务异常提示（区别于违规命中）
  onClose: () => void;
}

export const ContentGuardModal: React.FC<ContentGuardModalProps> = ({
  open,
  categoryLabel,
  label,
  strikeCount = 0,
  errorMessage,
  onClose,
}) => {
  if (!open) return null;

  const hitThreshold = strikeCount >= 3;
  const isError = !!errorMessage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center font-bold text-sm">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">{isError ? '无法生成' : '无法合成'}</h3>
              <p className="text-xs text-slate-500">{isError ? '内容安全检测服务异常' : '内容安全检测未通过'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
            title="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex items-start gap-3 rounded-2xl bg-red-50 border border-red-100 p-4">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700 leading-relaxed">
              <p className="font-semibold text-red-700">{isError ? '内容检测服务异常' : '无法合成，请检查文字合规性'}</p>
              <p className="mt-1 text-slate-600">
                {isError ? (
                  errorMessage
                ) : categoryLabel ? (
                  <>
                    检测到「{categoryLabel}」相关内容
                    {label ? <>（文字框：{label}）</> : null}，请修改后重试。
                  </>
                ) : (
                  '输入的文字不符合内容规范，请修改后重试。'
                )}
              </p>
            </div>
          </div>

          {hitThreshold && !isError && (
            <p className="mt-3 text-xs text-amber-600 leading-relaxed">
              您已多次输入违规内容，请注意遵守平台内容规范；若继续违规，可能被限制使用。
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            我知道了，返回修改
          </button>
        </div>
      </div>
    </div>
  );
};
