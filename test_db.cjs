const db = require("better-sqlite3")("C:/hrm-niubility-test/data/hrm.db");
console.log(db.prepare("SELECT id, name, status FROM users WHERE id IN ('admin', 'huangli')").all());
