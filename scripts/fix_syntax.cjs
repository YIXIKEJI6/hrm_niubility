const fs = require('fs');

function fixMissingDivs(file, fixFunction) {
  let c = fs.readFileSync(file, 'utf8');
  let newC = fixFunction(c);
  if (newC !== c) {
    fs.writeFileSync(file, newC);
    const tsErrorPattern = /error TS/; // Just an example, doesn't matter here
    console.log(`[Fixed] ${file}`);
  }
}

// 1. EmployeeDashboard.tsx: missing `</div>`
fixMissingDivs('src/pages/EmployeeDashboard.tsx', c => {
  // My previous replacement chunk:
  // "              </div>\n            </div>\n          )}\n\n          {/* ── 自由拖拽布局区（自定义模块） ── */}"
  // Wait, I can just inject "</div>\n" right before "</main>"
  if (c.includes('        </div>\n      </main>')) {
    return c.replace('        </div>\n      </main>', '          </div>\n        </div>\n      </main>');
  }
  return c;
});

// 2. SmartTaskModal.tsx: missing `</div>`
fixMissingDivs('src/components/SmartTaskModal.tsx', c => {
  // It's missing `</div>` right before `  );\n}`
  if (c.endsWith('    </div>\n  );\n}\n')) {
      return c.replace('    </div>\n  );\n}\n', '      </div>\n    </div>\n  );\n}\n');
  }
  if (c.endsWith('    </div>\n  );\n}')) { // No newline
      return c.replace('    </div>\n  );\n}', '      </div>\n    </div>\n  );\n}');
  }
  
  if (c.includes('    </div>\n  );\n}')) {
      return c.replace('    </div>\n  );\n}', '      </div>\n    </div>\n  );\n}');
  }
  
  return c;
});
