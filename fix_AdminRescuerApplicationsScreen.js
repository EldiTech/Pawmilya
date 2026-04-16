const fs = require('fs');
let p = 'app/Admin/AdminRescuerApplicationsScreen.js';
let code = fs.readFileSync(p, 'utf8');

code = code.replace(/collection\(db, 'rescue_missions'\)/g, "collection(db, 'rescuer_audit_logs')");

fs.writeFileSync(p, code);
console.log('Fixed');
