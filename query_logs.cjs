const db = require("better-sqlite3")("C:/hrm-niubility-test/data/hrm.db");
console.log(db.prepare("SELECT * FROM action_logs WHERE business_type = 'perf_plan' AND business_id = 11").all());
