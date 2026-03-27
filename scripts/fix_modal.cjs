const fs = require('fs');
const c = fs.readFileSync('src/components/SmartTaskModal.tsx', 'utf8');

const targetIndex = c.indexOf("同意\n              </button>\n            </div>\n          )}\n\n        </div>\n      </div>\n    </div>\n  );\n}");

if (targetIndex > -1) {
    const EndLen = "同意\n              </button>\n            </div>\n          )}\n\n        </div>\n      </div>\n    </div>\n  );\n}".length;
    
    fs.writeFileSync('src/components/SmartTaskModal.tsx', c.substring(0, targetIndex + EndLen) + "\n");
    console.log("Fixed!");
} else {
    // try finding just "export default function SmartTaskModal" closing brace
    console.log("Not found.");
}
