const fs = require('fs');
let code = fs.readFileSync('app/Rescuer/UserRescuerDashboardScreen.js', 'utf8').split(/\r?\n/);

function hookAction(searchStr, insertOffset, hookLine) {
    let idx = code.findIndex(l => l.includes(searchStr));
    if (idx > -1) {
        code.splice(idx + insertOffset, 0, hookLine);
        console.log('Hooked: ' + searchStr.trim());
    } else {
        console.log('Could not hook: ' + searchStr.trim());
    }
}

hookAction('const patch = {', 0, "      logRescuerAction(report, 'Accepted Rescue Mission', 'Rescuer accepted the rescue mission and is en route', 'in_progress');");

hookAction("Alert.alert('Status Updated'", 0, "      logRescuerAction(workflowReport, 'Updated Rescue Status', 'Status updated to ' + newStatus.replace(/_/g, ' '), newStatus);");

hookAction("'Submission Successful!',", -1, "      logRescuerAction(workflowReport, 'Submitted for Verification', 'Rescuer submitted photo proof of successful rescue', 'pending_verification');");

hookAction("'Status Updated',", -1, "      logRescuerAction(workflowReport, 'Cannot Complete Rescue', 'Rescue failed: ' + reason, 'cannot_complete');");

hookAction("setSubmittingTransfer(false);", 0, "      logRescuerAction(selectedRescueForShelter, 'Initiated Shelter Transfer', 'Transferring rescued animal to shelter', 'in_transit');");

hookAction("'Adoption Successful!'", -1, "      logRescuerAction(report, 'Adopted Rescued Animal', 'Rescuer has successfully adopted the animal', report?.status || '');");

fs.writeFileSync('app/Rescuer/UserRescuerDashboardScreen.js', code.join('\r\n'));
console.log('Finished insertions via array splicing');
