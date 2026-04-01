const db = require("better-sqlite3")("C:/hrm-niubility-test/data/hrm.db");
console.log("USERS:", db.prepare("SELECT id, name, status FROM users LIMIT 10").all());
console.log("PF:", db.prepare("SELECT id, title, assignee_id, approver_id FROM perf_plans WHERE id = 11").all());
