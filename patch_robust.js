const fs = require('fs');
let code = fs.readFileSync('app/Rescuer/UserRescuerDashboardScreen.js', 'utf8');

function insertBeforeRegex(regex, insertText) {
    const match = code.match(regex);
    if (match) {
        code = code.replace(regex, insertText + '$&');
        console.log('Matched and inserted before: ' + match[0].substring(0, 30).trim());
    } else {
        console.log('Regex not found: ' + regex);
    }
}

insertBeforeRegex(
/    const patch = \{\s*status: 'in_progress'/m,
"    logRescuerAction(report, 'Accepted Rescue Mission', 'Rescuer has accepted the rescue mission and is en route.', 'in_progress');\n\n"
);

insertBeforeRegex(
/      Alert\.alert\('Status Updated'/m,
"      logRescuerAction(workflowReport, 'Updated Rescue Status', 'Status updated to ' + newStatus.replace(/_/g, ' '), newStatus);\n"
);

insertBeforeRegex(
/      Alert\.alert\(\s*'Submission Successful!'/m,
"      logRescuerAction(workflowReport, 'Submitted for Verification', 'Rescuer submitted photo proof of successful rescue.', 'pending_verification');\n\n"
);

insertBeforeRegex(
/      Alert\.alert\(\s*'Status Updated'/m,
"      logRescuerAction(workflowReport, 'Cannot Complete Rescue', 'Rescue failed: ' + reason, 'cannot_complete');\n\n"
);

insertBeforeRegex(
/      setSubmittingTransfer\(false\);/m,
"      logRescuerAction(selectedRescueForShelter, 'Initiated Shelter Transfer', 'Transferring rescued animal to shelter.', 'in_transit');\n\n"
);

insertBeforeRegex(
/      Alert\.alert\(\s*'Adoption Successful!'/m,
"      logRescuerAction(report, 'Adopted Rescued Animal', 'Rescuer has successfully adopted the animal.', report?.status || '');\n"
);

fs.writeFileSync('app/Rescuer/UserRescuerDashboardScreen.js', code);
console.log('Done');
