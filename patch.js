const fs = require('fs');
let code = fs.readFileSync('app/Rescuer/UserRescuerDashboardScreen.js', 'utf8');

// Normalizing CRLF
code = code.replace(/\r\n/g, '\n');

let t1 = "        transaction.update(reportRef, {\n          status: 'in_progress',\n          rescuer_id: rescuerId,\n          accepted_at: serverTimestamp(),\n          updated_at: serverTimestamp(),\n        });\n      });\n\n      const patch = {\n        status: 'in_progress',";
let r1 = "logRescuerAction(report, 'Accepted Rescue Mission', 'Rescuer accepted the rescue mission and is en route', 'in_progress');\n\n      const patch =";
code = code.replace(t1, t1.replace('const patch =', r1));

let t2 = "      await fallbackUpdateStatus(workflowReport, newStatus);\n      Alert.alert('Status Updated'";
let r2 = "      await fallbackUpdateStatus(workflowReport, newStatus);\n      logRescuerAction(workflowReport, 'Updated Rescue Status', 'Status updated to ' + newStatus.replace(/_/g, ' '), newStatus);\n      Alert.alert('Status Updated'";
code = code.replace(t2, r2);

let t3 = "      await notifyProofSubmitted(workflowReport, finalNotes);\n\n      Alert.alert(\n        'Submission Successful!',";
let r3 = "      await notifyProofSubmitted(workflowReport, finalNotes);\n      logRescuerAction(workflowReport, 'Submitted for Verification', 'Rescuer submitted photo proof of successful rescue', 'pending_verification');\n\n      Alert.alert(\n        'Submission Successful!',";
code = code.replace(t3, r3);

let t4 = "      await updateRescueInFirestore(workflowReport.id, patch);\n\n      Alert.alert(\n        'Status Updated',";
let r4 = "      await updateRescueInFirestore(workflowReport.id, patch);\n      logRescuerAction(workflowReport, 'Cannot Complete Rescue', 'Rescue failed', 'cannot_complete');\n\n      Alert.alert(\n        'Status Updated',";
code = code.replace(t4, r4);

let t5 = "      await fallbackUpdateStatus(selectedRescueForShelter, patch.status, patch.notes, extraPatch);\n\n      setSubmittingTransfer(false);";
let r5 = "      await fallbackUpdateStatus(selectedRescueForShelter, patch.status, patch.notes, extraPatch);\n      logRescuerAction(selectedRescueForShelter, 'Initiated Shelter Transfer', 'Transferring rescued animal to shelter', 'in_transit');\n\n      setSubmittingTransfer(false);";
code = code.replace(t5, r5);

let t6 = "      Alert.alert(\n        'Adoption Successful!'";
let r6 = "      logRescuerAction(report, 'Adopted Rescued Animal', 'Rescuer has successfully adopted the animal', report?.status || '');\n      Alert.alert(\n        'Adoption Successful!'";
code = code.replace(t6, r6);

// Ensure CRLF on write
fs.writeFileSync('app/Rescuer/UserRescuerDashboardScreen.js', code.replace(/\n/g, '\r\n'));
console.log('Done replacement from script');
