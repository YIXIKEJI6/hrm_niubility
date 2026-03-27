const fs = require('fs');
const file = './src/pages/EmployeeDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const startMarker = "          {/* Editing Toolbar */}";
const endMarker = "          {/* ── 嵌入: 个人目标管理（原个人管理模块） ── */}";

if (content.includes(startMarker) && content.includes(endMarker)) {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);
  
  const blockToMove = content.substring(startIndex, endIndex);
  
  // Remove the block from its current place
  content = content.substring(0, startIndex) + content.substring(endIndex);
  
  // Find where to insert it: right before the </div> for max-w-[1400px] which is before </main>
  const beforeMain = "        </div>\n      </main>";
  const insertIndex = content.lastIndexOf(beforeMain);
  
  if (insertIndex > -1) {
    // add a title or spacing before inserting the block
    const injectedBlock = `
          {/* ── 自由拖拽布局区（自定义模块） ── */}
          <div className="mt-10 relative z-10 border-t border-slate-200/60 dark:border-slate-800 pt-8">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-500">dashboard_customize</span>
              自定义仪表盘
            </h3>
${blockToMove}          </div>
`;
    
    content = content.substring(0, insertIndex) + injectedBlock + content.substring(insertIndex);
    fs.writeFileSync(file, content);
    console.log("Moved successfully.");
  } else {
    console.log("Could not find insert index.");
  }
} else {
  console.log("Could not find markers.");
}
