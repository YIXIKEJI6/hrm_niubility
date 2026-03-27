import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';

export default function SalaryManager({ navigate }: { navigate: (v: string) => void }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-['Inter'] antialiased">
      <Sidebar currentView="salary" navigate={navigate} />
      
      <main className="flex-1 h-screen flex flex-col relative animate-in fade-in duration-300">
        {/* Header */}
        <header className="h-16 flex items-center px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 z-10">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">payments</span>
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  工资表管理 <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100">集成企微智能文档</span>
                </h1>
                <p className="text-[11px] text-slate-500 font-medium">支持企业微信文档、智能表格等无缝嵌入，实现高级薪资计算</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => window.open('https://doc.weixin.qq.com/', '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                独立窗口打开企微文档
              </button>
            </div>
          </div>
        </header>

        {/* Content (Iframe Embed) */}
        <div className="flex-1 w-full h-full relative p-6 bg-slate-50 dark:bg-slate-950">
          <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-sm relative bg-white dark:bg-slate-900 flex flex-col items-center justify-center">
            
            {/* Loading Placeholder */}
            {!iframeLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm z-10">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">正在加载企业微信文档模块...</p>
                <p className="text-xs text-slate-400 mt-2">首次加载可能需要几秒钟</p>
              </div>
            )}

            {/* Simulated WeCom Iframe - the src can be changed to any public WeCom docs publish link */}
            <iframe 
              src="https://doc.weixin.qq.com/" 
              className="w-full h-full border-none"
              title="Salary Spreadsheet"
              onLoad={() => setIframeLoaded(true)}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
            
            {/* Note: Standard WeCom docs might block cross-origin iframes unless they are specifically generated public embed links.
                For demonstration, we use the main page, but in production, replace `src` with the actual embed link. */}
          </div>
        </div>
      </main>
    </div>
  );
}
