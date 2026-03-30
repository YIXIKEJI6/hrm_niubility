import React, { useState, useEffect, useRef } from 'react';

// ── Confirm Dialog (替代 window.confirm) ──────────────────────────────
interface ConfirmState {
  id: number;
  message: string;
  resolve: (val: boolean) => void;
}

let _confirmQueue: ((state: ConfirmState) => void) | null = null;

/** 替代 window.confirm 的 Promise 版本 */
export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (_confirmQueue) {
      const id = Date.now() + Math.random();
      _confirmQueue({ id, message, resolve });
    } else {
      // 降级回原生 confirm
      resolve(window.confirm(message));
    }
  });
}

// ── Toast System ──────────────────────────────────────────────────────
interface ToastItem {
  id: number;
  msg: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export default function GlobalToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const originalAlertRef = useRef<typeof window.alert>(window.alert);

  // 注册 confirm 队列
  useEffect(() => {
    _confirmQueue = (state: ConfirmState) => setConfirm(state);
    return () => { _confirmQueue = null; };
  }, []);

  // 拦截 window.alert
  useEffect(() => {
    const originalAlert = window.alert;
    originalAlertRef.current = originalAlert;

    window.alert = (msg: any) => {
      const messageStr = String(msg);
      const id = Date.now() + Math.random();
      let type: ToastItem['type'] = 'info';

      if (messageStr.includes('失败') || messageStr.includes('错误') || messageStr.includes('异常') ||
          messageStr.includes('过期') || messageStr.includes('不符合') || messageStr.includes('无效') ||
          messageStr.includes('拒绝') || messageStr.includes('0-100')) {
        type = 'error';
      } else if (messageStr.includes('成功') || messageStr.includes('已保存') || messageStr.includes('已提交') ||
                 messageStr.includes('完成') || messageStr.includes('草稿') || messageStr.includes('已') ||
                 messageStr.includes('通过') || messageStr.includes('发布')) {
        type = 'success';
      } else if (messageStr.includes('⚠') || messageStr.includes('请') || messageStr.includes('注意')) {
        type = 'warning';
      }

      setToasts(prev => [...prev, { id, msg: messageStr, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
    };

    return () => { window.alert = originalAlert; };
  }, []);

  const handleConfirm = (result: boolean) => {
    if (confirm) {
      confirm.resolve(result);
      setConfirm(null);
    }
  };

  const TOAST_CONFIG = {
    success: { bg: 'bg-emerald-600', shadow: 'shadow-emerald-500/20', icon: 'check_circle' },
    error:   { bg: 'bg-red-500',     shadow: 'shadow-red-500/20',     icon: 'error' },
    warning: { bg: 'bg-amber-500',   shadow: 'shadow-amber-500/20',   icon: 'warning' },
    info:    { bg: 'bg-slate-800',   shadow: 'shadow-slate-800/20',   icon: 'info' },
  };

  return (
    <>
      {/* Toast 堆叠 */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-2.5 pointer-events-none items-center">
        {toasts.map(t => {
          const cfg = TOAST_CONFIG[t.type];
          return (
            <div
              key={t.id}
              className={`${cfg.bg} shadow-2xl ${cfg.shadow} px-5 py-3 rounded-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm`}
            >
              <span className="material-symbols-outlined text-[18px] text-white shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
              <span className="font-semibold text-sm text-white tracking-wide leading-snug">{t.msg}</span>
            </div>
          );
        })}
      </div>

      {/* Confirm 弹窗（替代原生 confirm）*/}
      {confirm && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200/60 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="px-6 pt-6 pb-2 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-amber-500 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>help</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed pt-1.5 font-medium">{confirm.message}</p>
            </div>
            <div className="px-6 pb-5 pt-4 flex gap-3 justify-end">
              <button
                onClick={() => handleConfirm(false)}
                className="px-5 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleConfirm(true)}
                className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
