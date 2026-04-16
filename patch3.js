const fs = require('fs');
let code = fs.readFileSync('app/Rescuer/UserRescuerDashboardScreen.js', 'utf8').split(/\r?\n/);

function hookAction(searchStr, offset, hookLine) {
    let idx = code.findIndex(l => l.includes(searchStr));
    if (idx > -1) {
        code.splice(idx + offset, 0, hookLine);
        console.log('Hooked: ' + searchStr.trim());
    } else {
        console.log('Could not hook: ' + searchStr.trim());
    }
}

hookAction("Submission Successful", -1, "      logRescuerAction(workflowReport, 'Submitted for Verification', 'Rescuer submitted photo proof of successful rescue', 'pending_verification');");
hookAction("Adoption Successful", -1, "      logRescuerAction(report, 'Adopted Rescued Animal', 'Rescuer has successfully adopted the animal', report?.status || '');");

fs.writeFileSync('app/Rescuer/UserRescuerDashboardScreen.js', code.join('\r\n'));
console.log('Finished secondary insertions');
