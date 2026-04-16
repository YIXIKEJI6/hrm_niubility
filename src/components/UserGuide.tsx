import React, { useState } from 'react';

interface GuideSection {
  id: string;
  icon: string;
  title: string;
  content: React.ReactNode;
}

const sections: GuideSection[] = [
  {
    id: 'overview',
    icon: 'dashboard',
    title: '系统概述',
    content: (
      <div className="space-y-3">
        <p>You!Niubility! HRM 是一套集绩效管理、人力地图、组织架构、审批流程、团队协作于一体的智能人力资源管理系统。</p>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300">💡 主要功能模块</p>
          <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
            <li>📊 <b>我的主页</b> — 个人仪表盘、待办任务、绩效概览</li>
            <li>👥 <b>我的团队</b> — 团队成员管理、绩效追踪</li>
            <li>🔥 <b>赏金榜</b> — 公司级任务发布、认领与奖金激励</li>
            <li>🗺️ <b>人力地图</b> — 全公司人员分布可视化</li>
            <li>📈 <b>全景仪表盘</b> — 多维数据分析与 PDCA 监管</li>
            <li>🏗️ <b>组织关系</b> — 部门架构树状图管理</li>
            <li>📅 <b>排班请假</b> — 值班日历排班、请假申请与审批</li>
            <li>🎯 <b>能力大盘</b> — 团队能力评测模型与短板预警</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'bounty',
    icon: 'local_fire_department',
    title: '赏金榜使用指南',
    content: (
      <div className="space-y-3">
        <p>赏金榜是公司级任务激励平台。管理层发布高价值任务，员工自主认领，完成后获得奖金/绩效分奖励。</p>
        <div className="space-y-2">
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">1</span> 提案申请</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">员工可通过"申请绩效池提案"提议新任务，使用 SMART 原则填写目标，经 HR → 总经理逐级审批后入池。</p>
          
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">2</span> 任务认领</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">在任务视图点击"立即加入"认领任务。查看任务详情了解具体要求和奖金金额。</p>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">3</span> RACI 角色</h4>
          <div className="ml-7 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-xs space-y-1">
            <p><b className="text-blue-600">R (负责人)</b> — 单选，最终负责交付</p>
            <p><b className="text-green-600">A (执行人)</b> — 多选，实际执行任务</p>
            <p><b className="text-amber-600">C (咨询人)</b> — 多选，提供专业建议</p>
            <p><b className="text-violet-600">验收人</b> — 多选，负责验收成果</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'perf',
    icon: 'trending_up',
    title: '绩效管理',
    content: (
      <div className="space-y-3">
        <p>系统支持 OKR 与 PDCA 双轨绩效管理模式。</p>
        <div className="space-y-2">
          <h4 className="text-sm font-bold">🎯 个人绩效</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">在"我的主页"查看个人绩效目标，提交目标制定申请并追踪进度。支持 SMART 原则的结构化目标设定。</p>
          
          <h4 className="text-sm font-bold">📋 PDCA 监管</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">全景仪表盘提供 PDCA（计划-执行-检查-改进）全周期监控，可查看项目健康度、进度/时间差距分析。</p>
          
          <h4 className="text-sm font-bold">🤖 AI 诊断</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">系统内置 AI 诊断引擎（页面右下角浮窗），可对绩效数据进行智能分析、瓶颈诊断和改善建议。</p>
        </div>
      </div>
    ),
  },
  {
    id: 'flow1',
    icon: 'assignment',
    title: '流程一 · 任务下发',
    content: (
      <div className="space-y-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">签收制 · 无审批链 · 主管直接下发</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">团队负责人直接向下属指派绩效任务，参与人签收确认后由负责人启动执行。</p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto py-2 text-[10px] font-medium">
          {['草稿','待签收','全员签收','发车启动','执行中','评估','完结'].map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className="text-slate-300 shrink-0">→</span>}
              <span className={`shrink-0 px-2 py-1 rounded-full ${
                i <= 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                i <= 4 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                i === 5 ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' :
                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              }`}>{s}</span>
            </React.Fragment>
          ))}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">1</span> 主管创建任务</h4>
          <div className="ml-7 text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>入口：<b>「我的团队」→「向下发起绩效目标」</b></p>
            <p>填写 SMART 目标、PDCA 时间、选择执行人(R)，负责人(A)默认为自己。</p>
          </div>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">2</span> 参与人签收</h4>
          <div className="ml-7 text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>下发后 R + A 全员收到企微推送，在「我的流程 → 待我审核」中查看并<b>确认签收</b>。</p>
            <p className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-1.5">⚠️ 任一人拒签 → 退回草稿，主管需修改后重新下发。</p>
          </div>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">3</span> 负责人「发车」启动</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">全员签收后，仅负责人(A)有权点击「🚀 发起任务」正式启动。</p>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">4</span> 执行 → 评分 → 完结</h4>
          <div className="ml-7 text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>执行期间可更新进度百分比、在 STAR 广场记录反思。</p>
            <p>评估阶段由<b>创建者(主管)</b>打分(1-100)，A 可先提交自评供参考。</p>
            <p>完结后自动抄送 HRBP + GM。</p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">RACI 角色</p>
          <div className="text-xs space-y-1 text-slate-500 dark:text-slate-400">
            <p><b className="text-pink-600">A 负责人</b> — 主管自己（创建后不可修改）</p>
            <p><b className="text-blue-600">R 执行人</b> — 被指派的下属（可多人）</p>
            <p><b className="text-violet-600">评分人</b> — 创建者（即主管本人）</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'flow2',
    icon: 'front_hand',
    title: '流程二 · 任务申请',
    content: (
      <div className="space-y-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">签收 + 审批制 · 员工自主发起</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">员工自己发起绩效目标申请，经执行人签收 + 上级审批后自动启动执行。</p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto py-2 text-[10px] font-medium">
          {['填写目标','R签收','上级审批','自动启动','执行中','上级评分','完结'].map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className="text-slate-300 shrink-0">→</span>}
              <span className={`shrink-0 px-2 py-1 rounded-full ${
                i === 0 ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' :
                i === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                i === 2 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                i <= 4 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' :
                i === 5 ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' :
                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              }`}>{s}</span>
            </React.Fragment>
          ))}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">1</span> 员工填写并提交</h4>
          <div className="ml-7 text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>入口：<b>「我的目标」→ 右上角「+ 申请新任务」</b>，或<b>「我的团队」→「申请新任务」</b></p>
            <p>填写 SMART 目标、PDCA 时间。可点「AI 智能拆解」从描述自动生成模板。</p>
            <p>负责人(A)默认为自己，可指定其他执行人(R)。</p>
          </div>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">2</span> 执行人签收 → 上级审批</h4>
          <div className="ml-7 text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>如指定了其他执行人，先等待签收确认。签收后自动流转到<b>直属上级主管</b>审批。</p>
            <p className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg px-3 py-1.5">💡 若申请人本身是主管，审批人自动升级为上一级部门主管（防止自审）。</p>
          </div>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">3</span> 审批通过 → 自动启动</h4>
          <div className="ml-7 text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>审批通过后任务<b>自动进入「进行中」</b>，无需手动启动。抄送 HRBP。</p>
            <p>被驳回时可修改后点「提交修改」重新提交。</p>
          </div>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">4</span> 上级评分 → 完结</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">评分人为<b>上级主管</b>（非申请人自己），确保评分客观性。完结后抄送 HRBP + GM。</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">与流程一的关键区别</p>
          <div className="text-xs space-y-1 text-slate-500 dark:text-slate-400">
            <p>• 流程一：主管下发，<b>创建者</b>评分</p>
            <p>• 流程二：员工申请，<b>上级主管</b>评分（非创建者自己）</p>
            <p>• 流程二审批通过后自动启动，无需手动「发车」</p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">主管视角：审批操作</p>
          <div className="text-xs space-y-1 text-slate-500 dark:text-slate-400">
            <p>在「我的流程 → 待我审核」中查看下属申请，可执行：</p>
            <p>• <b className="text-green-600">同意</b> — 审批通过，任务自动启动</p>
            <p>• <b className="text-red-600">驳回</b> — 退回修改（需填理由）</p>
            <p>• <b className="text-blue-600">转办</b> — 委托其他同事审批（如休假时）</p>
            <p>• <b>修改内容</b> — 审批前可切换编辑模式调整目标</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'flow3',
    icon: 'lightbulb',
    title: '流程三 · 绩效提案',
    content: (
      <div className="space-y-3">
        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4">
          <p className="text-xs font-bold text-violet-700 dark:text-violet-300 mb-1">HR → GM 两级审批 · 无免审通道</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">任何员工均可发起赏金榜提案，经 HRBP 初审 + GM 终审后发榜公示。</p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto py-2 text-[10px] font-medium">
          {['撰写提案','HRBP审核','GM终审','审批通过','发榜公示'].map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className="text-slate-300 shrink-0">→</span>}
              <span className={`shrink-0 px-2 py-1 rounded-full ${
                i === 0 ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' :
                i === 1 ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' :
                i === 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              }`}>{s}</span>
            </React.Fragment>
          ))}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-violet-500 text-white text-[10px] flex items-center justify-center font-black">1</span> 撰写提案</h4>
          <div className="ml-7 text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>入口：<b>「赏金榜」→ 右上角「+ 发起提案」</b></p>
            <p>填写提案标题、SMART 内容（可插入模板）、奖金池金额、人数上限、分类、附件。</p>
            <p className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg px-3 py-1.5">💡 提案模式下无需填 PDCA 时间和执行人，这些在认领阶段确定。</p>
          </div>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-violet-500 text-white text-[10px] flex items-center justify-center font-black">2</span> HRBP 初审</h4>
          <div className="ml-7 text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>提交后进入 HRBP 审核。HRBP 可编辑 SMART 内容、调整奖金和人数。</p>
            <p>通过后流转给 GM，驳回则退回提案人修改。</p>
          </div>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-violet-500 text-white text-[10px] flex items-center justify-center font-black">3</span> GM 终审</h4>
          <div className="ml-7 text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>GM 审阅并可编辑内容后同意/驳回。</p>
          </div>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-violet-500 text-white text-[10px] flex items-center justify-center font-black">4</span> 发榜公示</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">GM 通过后，HRBP/管理员点击「一键发榜」，提案在赏金榜页面公示。</p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
          <p className="text-xs font-bold text-red-700 dark:text-red-300">🚫 无免审通道</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">所有人的提案都必须经过 HRBP → GM 两级审批，包括 GM 和管理员自己提交的提案。</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">驳回处理</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">被驳回后收到通知（附驳回理由），修改后点「提交修改」重新提交，从 HRBP 审核重新开始。</p>
        </div>
      </div>
    ),
  },
  {
    id: 'flow4',
    icon: 'emoji_events',
    title: '流程四 · 赏金榜认领',
    content: (
      <div className="space-y-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-1">RACI 角色认领 · 跨部门协作 · 奖金激励</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">提案发榜后，员工自主认领角色，项目执行完毕后通过 STAR 报告发放奖金。</p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto py-2 text-[10px] font-medium">
          {['浏览赏金榜','申请角色','审批认领','项目执行','STAR报告','发赏归档'].map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className="text-slate-300 shrink-0">→</span>}
              <span className={`shrink-0 px-2 py-1 rounded-full ${
                i === 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                i <= 2 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                i === 3 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' :
                i === 4 ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' :
                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              }`}>{s}</span>
            </React.Fragment>
          ))}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-emerald-500 text-white text-[10px] flex items-center justify-center font-black">1</span> 浏览并认领</h4>
          <div className="ml-7 text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>入口：<b>「赏金榜」页面</b>，查看已发榜项目列表。</p>
            <p>点击项目卡片 →「发起加入申请」→ 选择 RACI 角色：</p>
          </div>
          <div className="ml-7 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-xs space-y-1">
            <p><b className="text-blue-600">R 执行人</b> — 实际完成任务，可多人</p>
            <p><b className="text-pink-600">A 负责人</b> — 对结果负总责，仅一人</p>
            <p><b className="text-amber-600">C 咨询人</b> — 提供专业建议</p>
            <p><b className="text-violet-600">I 知会人</b> — 了解进展即可</p>
          </div>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-emerald-500 text-white text-[10px] flex items-center justify-center font-black">2</span> 审批认领</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">依次经过：直属部门主管确认 → 项目创建者审批。通过后正式加入项目。</p>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-emerald-500 text-white text-[10px] flex items-center justify-center font-black">3</span> 项目执行</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">R + A 满员后，负责人(A)或 HR 启动项目。执行期间可在 STAR 广场记录反思。</p>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-emerald-500 text-white text-[10px] flex items-center justify-center font-black">4</span> 完结与奖金发放</h4>
          <div className="ml-7 text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>项目完结 → 负责人提交 STAR 报告 → HR 创建奖励分配方案。</p>
            <p>奖励方案经 HRBP → GM 审批后，线下清算发放奖金。</p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">项目创建者/负责人额外操作</p>
          <div className="text-xs space-y-1 text-slate-500 dark:text-slate-400">
            <p>• 审批他人的角色认领申请</p>
            <p>• R + A 满员后启动项目</p>
            <p>• 可选择提前完结（需填原因）</p>
            <p>• 提交 STAR 报告并发起奖励分配</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'approval',
    icon: 'approval',
    title: '流程中心与异常处理',
    content: (
      <div className="space-y-3">
        <p>在「我的流程」页面统一管理所有审批事项。</p>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300">📋 五大功能 Tab</p>
          <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
            <li>• <b>我参与的</b> — 自己发起的 + 分配给自己的流程</li>
            <li>• <b>待我审核</b> — 需要你操作的审批事项（红色角标提示）</li>
            <li>• <b>我已审核</b> — 历史审批记录</li>
            <li>• <b>抄送我的</b> — 知会通知（仅查看）</li>
            <li>• <b>绩效池管理</b> — HR/管理员专属，管理赏金榜</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-bold">通用审批操作</h4>
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>• <b className="text-green-600">同意</b> — 审批通过，流转到下一节点</p>
            <p>• <b className="text-red-600">驳回</b> — 退回修改（需填理由）</p>
            <p>• <b className="text-blue-600">转办</b> — 委托他人审批（如休假时）</p>
            <p>• <b>修改内容</b> — 审批前可编辑任务详情</p>
            <p>• <b>撤回申请</b> — 发起人可在审批中撤回</p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-300">⚠️ 流程异常管理（HR/管理员专属）</p>
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <p>在「流程异常」Tab 中处理卡住的流程：</p>
            <p>• <b>转派审批人</b> — 当审批人离职/休假时，转给其他人</p>
            <p>• <b>强制推进</b> — 强制通过或驳回当前节点（需填原因）</p>
            <p>• <b>节点补录</b> — 修复审批人缺失的异常流程</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400">所有审批通知会通过企业微信实时推送。也可在导航栏消息盒(铃铛图标)中查看。</p>
      </div>
    ),
  },
  {
    id: 'org',
    icon: 'account_tree',
    title: '组织架构',
    content: (
      <div className="space-y-3">
        <p>组织关系页面展示公司完整的部门架构树状图。</p>
        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p>• <b>同步企微通讯录</b> — 点击"同步企微通讯录"按钮一键同步企业微信部门和人员</p>
          <p>• <b>部门管理</b> — 支持新建、编辑、删除和移动部门</p>
          <p>• <b>人员管理</b> — 点击部门可查看成员列表，编辑人员信息</p>
        </div>
      </div>
    ),
  },
  {
    id: 'schedule',
    icon: 'calendar_month',
    title: '排班请假',
    content: (
      <div className="space-y-3">
        <p>排班请假模块提供全公司值班排班管理和请假申请功能，支持按部门查看值班日历、在线提交请假、主管审批和自定义假期/班次类型。</p>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300">📅 三大功能 Tab</p>
          <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
            <li>• <b>值班日历</b> — 月历视图查看全员排班，主管可直接点击排班</li>
            <li>• <b>请假管理</b> — 员工提交请假、查看记录，主管审批/驳回</li>
            <li>• <b>假期配置</b> — 管理员自定义假期类型和班次定义</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">1</span> 值班日历</h4>
          <div className="ml-7 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            <p>• 月历视图：横轴为日期(1-31)，纵轴按部门分组显示成员姓名</p>
            <p>• 每个格子用彩色标签显示班次(早/中/晚/全天/休息)，请假日期会用红色标记覆盖</p>
            <p>• <b>切换月份</b>：点击左右箭头切换查看月份</p>
            <p>• <b>部门筛选</b>：下拉选择部门，可查看指定部门或全公司排班</p>
            <p>• <b>主管排班</b>：点击任意格子，弹出班次选择菜单，选择后自动保存；点"清除"可删除已有排班</p>
            <p className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-1.5">⚠️ 普通员工只能查看排班表，无法编辑。只有主管/HR/管理员有排班权限。</p>
          </div>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">2</span> 请假管理</h4>
          <div className="ml-7 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            <p><b>提交请假：</b></p>
            <p>① 点击右上角"新建请假" → ② 选择假期类型(年假/事假/病假等) → ③ 选择起止日期和上午/下午 → ④ 系统自动计算天数 → ⑤ 填写事由 → ⑥ 提交</p>
            <p><b>额度检查：</b>如果假期类型设置了年度上限(如年假15天)，系统会自动检查剩余额度，不足时提交会被拒绝。</p>
            <p><b>查看模式：</b></p>
            <p>• "我的请假" — 查看自己的请假记录</p>
            <p>• "部门请假" — 主管/HR 查看本部门所有请假记录</p>
            <p><b>操作：</b></p>
            <p>• 员工可在"待审批"状态下撤销自己的请假</p>
            <p>• 主管/HR 可对他人的待审批请假进行"通过"或"驳回"</p>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2.5 text-xs text-green-700 dark:text-green-300">
              <b>💡 请假与排班联动：</b>请假审批通过后，值班日历上对应日期会自动显示请假标记，无需手动修改排班表。
            </div>
          </div>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">3</span> 假期配置（管理员）</h4>
          <div className="ml-7 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            <p><b>假期类型管理：</b></p>
            <p>• 系统预设了 8 种假期类型：年假、事假、病假、调休、婚假、产假、陪产假、丧假</p>
            <p>• 管理员可新增/编辑假期类型，配置名称、颜色、年度天数上限、是否需要审批、计量单位(天/半天/小时)</p>
            <p><b>班次定义管理：</b></p>
            <p>• 系统预设了 5 种班次：早班(08:00-17:00)、中班(13:00-22:00)、晚班(22:00-06:00)、全天、休息</p>
            <p>• 管理员可新增/编辑班次，配置名称、颜色和上下班时间</p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">🔐 权限说明</p>
          <div className="text-xs space-y-1 text-slate-500 dark:text-slate-400">
            <p>• <b>全员</b>：查看排班表、提交/撤销自己的请假</p>
            <p>• <b>主管</b>：编辑本部门排班、查看部门请假、审批/驳回请假</p>
            <p>• <b>HR/管理员</b>：管理全公司排班、管理假期类型和班次定义</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'competency',
    icon: 'psychology',
    title: '能力大盘与预警',
    content: (
      <div className="space-y-3">
        <p>能力大盘用于建立公司的人才能力指标模型，发掘员工潜能，并实时追踪团队的能力短板以便于及时招聘补齐。</p>
        <div className="space-y-2">
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">1</span> 预设能力库配置 (字典)</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">HR 或架构师可在此沉淀通用的“职级能力”与“素养要求”，配置评估说明标准与满分，统一各部门评估尺度。</p>
          
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">2</span> 能力模型与目标分数</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">为不同岗位组装多项能力维度。创建模型时可「从字典一键导入」，并为其设定一个决定是否合格的<b className="text-blue-600">“达标分”(期望靶点)</b>。</p>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">3</span> 自动短板诊断与预警</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">当产生评估日志后，系统会<b className="text-red-500">自动聚合</b>计算。如果某项技能的<b className="text-red-500">团队实际均分持续低于期望达标线</b>，该领域大盘会「标红警报」，提示您团队当前该项人才短缺，亟待启动招募补充计划。</p>
        </div>
      </div>
    ),
  },
  {
    id: 'admin',
    icon: 'admin_panel_settings',
    title: '管理后台',
    content: (
      <div className="space-y-3">
        <p>仅管理员和 HR 可访问管理后台，包含以下功能：</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: 'group', label: '组织架构管理' },
            { icon: 'verified', label: '权限矩阵配置' },
            { icon: 'route', label: '审批流模板' },
            { icon: 'payments', label: '工资表管理' },
            { icon: 'notifications_active', label: '消息推送' },
            { icon: 'bar_chart', label: '数据分析' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="material-symbols-outlined text-[14px] text-blue-500">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'shortcuts',
    icon: 'keyboard',
    title: '快捷操作',
    content: (
      <div className="space-y-3">
        <div className="space-y-2">
          {[
            { key: '头像菜单', desc: '更新通知、工资单、个人设置、管理后台、帮助中心' },
            { key: '消息铃铛', desc: '查看企微推送通知和系统消息' },
            { key: '回收站', desc: '赏金榜中删除的任务可恢复/彻底删除' },
            { key: 'AI 助手', desc: '右下角浮窗，随时咨询系统使用问题' },
          ].map(item => (
            <div key={item.key} className="flex items-start gap-3">
              <span className="text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-md whitespace-nowrap">{item.key}</span>
              <p className="text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserGuide({ isOpen, onClose }: UserGuideProps) {
  const [activeSection, setActiveSection] = useState('overview');

  if (!isOpen) return null;

  const currentSection = sections.find(s => s.id === activeSection) || sections[0];

  return (
    <div className="fixed inset-0 z-[70] flex">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="ml-auto relative w-full max-w-2xl bg-white dark:bg-slate-900 h-full flex shadow-2xl animate-in slide-in-from-right-8 duration-200">
        {/* Sidebar Navigation */}
        <div className="w-52 bg-slate-50 dark:bg-slate-950 border-r border-slate-200/60 dark:border-slate-800 flex flex-col shrink-0">
          <div className="px-5 py-5 border-b border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0060a9] to-[#409eff] flex items-center justify-center text-white shadow-md">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
              </div>
              <div>
                <h2 className="font-black text-sm text-slate-800 dark:text-slate-100">使用说明</h2>
                <p className="text-[10px] text-slate-400 font-medium">User Guide</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 text-xs font-medium transition-all duration-200 ${
                  activeSection === section.id
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-sm border-r-2 border-blue-500'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-900/60 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{section.icon}</span>
                {section.title}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-slate-200/60 dark:border-slate-800">
            <p className="text-[10px] text-slate-400 text-center">You!Niubility! HRM v2.9.0</p>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-blue-500">{currentSection.icon}</span>
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{currentSection.title}</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {currentSection.content}
          </div>
        </div>
      </div>
    </div>
  );
}
