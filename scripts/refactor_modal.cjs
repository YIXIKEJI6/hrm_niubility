const fs = require('fs');
const file = './src/components/SmartTaskModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add comments state
const stateMarker = "const [tempVoice, setTempVoice] = useState('');";
if (content.includes(stateMarker) && !content.includes("const [comments, setComments] = useState")) {
  content = content.replace(stateMarker, stateMarker + "\n  const [comments, setComments] = useState<Record<string, string>>({});");
}

// 2. Wrap the section rendering in a flex container
const sectionStartMarker = "<motion.div \n                        layout\n                        transition={{ duration: 0.2 }}\n                        key={section.id}";

if (content.includes(sectionStartMarker)) {
  const replacement = `<div key={section.id} className="flex gap-4 items-stretch w-full">\n                      <motion.div \n                        layout\n                        transition={{ duration: 0.2 }}\n                        className={\`flex-1 max-w-[calc(100%-316px)] \${!approverMode && 'max-w-full'}\`}`;
  // wait we need to replace the key= on the motion.div since we moved it to the parent div
  content = content.replace(
    /<motion\.div \s*layout\s*transition=\{\{ duration: 0\.2 \}\}\s*key=\{section\.id\}\s*onClick=\{\(\) => !isActive && setActiveSection\(section\.id as SectionId\)\}\s*className=\{`/g,
    `<div key={section.id} className="flex gap-4 items-stretch w-full">\n                      <motion.div \n                        layout\n                        transition={{ duration: 0.2 }}\n                        onClick={() => !isActive && setActiveSection(section.id as SectionId)}\n                        className={\`flex-1 \${approverMode ? 'max-w-[calc(100%-316px)]' : 'max-w-full'}\` + " \n                          "`
  );
  // this is a bit too hacky because of the complex regex. Let's do a more precise replacement.
}

