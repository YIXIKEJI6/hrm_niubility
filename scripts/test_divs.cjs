const fs = require('fs');

const content = fs.readFileSync('src/components/SmartTaskModal.tsx', 'utf8');
const lines = content.split('\n');

let depth = 0;
let outputWrapDepth = -1;
let leftPanelDepth = -1;
let approverSidePanelLine = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Very rough tag counting
  const openDivs = (line.match(/<div/g) || []).length;
  const closedDivs = (line.match(/<\/div>/g) || []).length;
  
  /*
  const openTags = (line.match(/<[a-zA-Z]+/g) || []).length;
  const closedTags = (line.match(/<\/[a-zA-Z]+/g) || []).length;
  const selfClosing = (line.match(/\/>/g) || []).length;
  */
  
  depth += openDivs - closedDivs;

  if (line.includes('className="flex flex-1 overflow-hidden"')) {
    outputWrapDepth = depth;
    console.log(`Line ${i+1}: Output layout wrap starts at depth ${depth}`);
  }
  
  if (line.includes('className="flex-1 flex flex-col overflow-hidden relative border-r border-slate-200"')) {
    leftPanelDepth = depth;
    console.log(`Line ${i+1}: Left panel starts at depth ${depth}`);
  }
  
  if (line.includes('<ApproverSidePanel')) {
    approverSidePanelLine = i + 1;
    console.log(`Line ${i+1}: ApproverSidePanel rendered at depth ${depth}`);
  }
}
