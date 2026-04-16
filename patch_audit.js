const fs = require('fs');
let originalCode = fs.readFileSync('app/Rescuer/UserRescuerDashboardScreen.js', 'utf8');
let code = originalCode.replace(/\r\n/g, '\n');

function replaceStr(oldStr, newStr) {
    if (code.includes(oldStr)) {
        code = code.replace(oldStr, newStr);
        console.log('Replaced successfully: ' + oldStr.substring(0, 30).trim().replace(/\n/g, '\\n'));
    } else {
        console.log('Could not find: ' + oldStr.substring(0, 30).trim().replace(/\n/g, '\\n') + '...');
    }
}

// 1. fallbackAcceptRescue
replaceStr(
`    });

    const patch = {
      status: 'in_progress',`,
`    });

    logRescuerAction(report, 'Accepted Rescue Mission', 'Rescuer has accepted the rescue mission and is en route.', 'in_progress');

    const patch = {
      status: 'in_progress',`
);

// 2. updateWorkflowStatus
replaceStr(
`      await fallbackUpdateStatus(workflowReport, newStatus);
      Alert.alert('Status Updated',`,
`      await fallbackUpdateStatus(workflowReport, newStatus);
      logRescuerAction(workflowReport, 'Updated Rescue Status', 'Status updated to ' + newStatus.replace(/_/g, ' '), newStatus);
      Alert.alert('Status Updated',`
);

// 3. submitForVerification
replaceStr(
`      await notifyProofSubmitted(workflowReport, finalNotes);

      Alert.alert(
        'Submission Successful!',`,
`      await notifyProofSubmitted(workflowReport, finalNotes);
      logRescuerAction(workflowReport, 'Submitted for Verification', 'Rescuer submitted photo proof of successful rescue.', 'pending_verification');

      Alert.alert(
        'Submission Successful!',`
);

// 4. submitCannotComplete
replaceStr(
`      await updateRescueInFirestore(workflowReport.id, patch);

      Alert.alert(
        'Status Updated',`,
`      await updateRescueInFirestore(workflowReport.id, patch);
      logRescuerAction(workflowReport, 'Cannot Complete Rescue', 'Rescue failed: ' + reason, 'cannot_complete');

      Alert.alert(
        'Status Updated',`
);

// 5. handleConfirmShelterTransfer
replaceStr(
`      await fallbackUpdateStatus(selectedRescueForShelter, patch.status, patch.notes, extraPatch);

      setSubmittingTransfer(false);`,
`      await fallbackUpdateStatus(selectedRescueForShelter, patch.status, patch.notes, extraPatch);
      logRescuerAction(selectedRescueForShelter, 'Initiated Shelter Transfer', 'Transferring rescued animal to shelter: ' + selectedShelter.name, 'in_transit');

      setSubmittingTransfer(false);`
);

// 6. processAdoption
replaceStr(
`      Alert.alert(
        'Adoption Successful!',`,
`      logRescuerAction(report, 'Adopted Rescued Animal', 'Rescuer has successfully adopted the animal.', report?.status || '');
      Alert.alert(
        'Adoption Successful!',`
);

// Add to handleCannotCompleteWorkflow?
// We already log submitCannotComplete

fs.writeFileSync('app/Rescuer/UserRescuerDashboardScreen.js', code.replace(/\n/g, '\r\n'));
console.log('Patched dashboard Iter 4');
