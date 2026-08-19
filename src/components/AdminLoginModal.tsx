import React, { useState, useRef } from 'react';
import { Shield, X, Lock, User, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { loginAdmin, registerAdmin } from '../services/api';
import { AdminUser } from '../types';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AdminUser) => void;
  notice?: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  notice,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Easter egg: Triple click on shield icon to toggle register mode
  const clickCountRef = useRef<number>(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  if (!isOpen) return null;

  const handleShieldClick = () => {
    clickCountRef.current += 1;

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 1200);

    if (clickCountRef.current >= 3) {
      setIsRegisterMode((prev) => !prev);
      setErrorMsg('');
      setSuccessMsg(
        !isRegisterMode
          ? '已解锁管理员注册模式'
          : '已切换回管理员登录模式'
      );
      clickCountRef.current = 0;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username.trim()) {
      setErrorMsg('请输入邮箱或用户名');
      return;
    }
    if (!password) {
      setErrorMsg('请输入密码');
      return;
    }

    if (isRegisterMode) {
      if (password !== confirmPassword) {
        setErrorMsg('两次输入的密码不一致，请重新输入');
        return;
      }
      if (password.length < 4) {
        setErrorMsg('密码长度不能少于 4 位');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isRegisterMode) {
        const user = await registerAdmin(username.trim(), password);
        setSuccessMsg('管理员注册成功！正在进入管理后台...');
        setTimeout(() => {
          onLoginSuccess(user);
          onClose();
        }, 800);
      } else {
        const user = await loginAdmin(username.trim(), password);
        setSuccessMsg('登录成功！正在进入管理后台...');
        setTimeout(() => {
          onLoginSuccess(user);
          onClose();
        }, 600);
      }
    } catch (err: any) {
      setErrorMsg(err.message || '操作失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4 bg-slate-900/40 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 sm:p-8 relative transform transition-all animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          title="关闭"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Shield Icon matching Fig 1 */}
        <div className="flex flex-col items-center text-center">
          <button
            type="button"
            onClick={handleShieldClick}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer select-none active:scale-95 ${
              isRegisterMode
                ? 'bg-amber-50 text-amber-600 ring-4 ring-amber-100 shadow-md'
                : 'bg-blue-50 text-blue-600 ring-4 ring-blue-50/60 hover:bg-blue-100'
            }`}
          >
            {isRegisterMode ? (
              <KeyRound className="w-7 h-7" />
            ) : (
              <Shield className="w-7 h-7" />
            )}
          </button>

          <h2 className="mt-4 text-xl font-bold text-slate-900 tracking-tight">
            {isRegisterMode ? '管理员注册' : '管理员登录'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {isRegisterMode
              ? '创建管理员账号以发布与管理 DIY 模板'
              : '登录以管理兑换码活动'}
          </p>
        </div>

        {/* Message Alert */}
        {notice && !errorMsg && (
          <div className="mt-4 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Fields matching Fig 1 */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              邮箱 / 用户名
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              密码
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          {/* Confirm password for register mode */}
          {isRegisterMode && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-150">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                确认密码
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>
          )}

          {/* Login / Register Submit Button matching Fig 1 */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isRegisterMode ? (
              '立即注册并登录'
            ) : (
              '登录'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
