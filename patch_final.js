const fs = require('fs');
let code = fs.readFileSync('app/Rescuer/UserRescuerDashboardScreen.js', 'utf8');

const t1 =         transaction.update(reportRef, {
          status: 'in_progress',
          rescuer_id: rescuerId,
          accepted_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      });

      const patch = {
        status: 'in_progress',;

code = code.replace(t1, t1.replace('      const patch',       logRescuerAction(report, 'Accepted Rescue Mission', 'Rescuer accepted the rescue mission and is en route', 'in_progress');\n\n      const patch));

const t2 =       await fallbackUpdateStatus(workflowReport, newStatus);
      Alert.alert('Status Updated';

code = code.replace(t2,       await fallbackUpdateStatus(workflowReport, newStatus);\n      logRescuerAction(workflowReport, 'Updated Rescue Status', 'Status updated to ' + newStatus.replace(/_/g, ' '), newStatus);\n      Alert.alert('Status Updated');

const t3 =       await notifyProofSubmitted(workflowReport, finalNotes);

      Alert.alert(
        'Submission Successful!',;

code = code.replace(t3,       await notifyProofSubmitted(workflowReport, finalNotes);\n      logRescuerAction(workflowReport, 'Submitted for Verification', 'Rescuer submitted photo proof of successful rescue', 'pending_verification');\n\n      Alert.alert(\n        'Submission Successful!',);

const t4 =       await updateRescueInFirestore(workflowReport.id, patch);

      Alert.alert(
        'Status Updated',;

code = code.replace(t4,       await updateRescueInFirestore(workflowReport.id, patch);\n      logRescuerAction(workflowReport, 'Cannot Complete Rescue', 'Rescue failed: ' + reason, 'cannot_complete');\n\n      Alert.alert(\n        'Status Updated',);

const t5 =       await fallbackUpdateStatus(selectedRescueForShelter, patch.status, patch.notes, extraPatch);

      setSubmittingTransfer(false);;

code = code.replace(t5,       await fallbackUpdateStatus(selectedRescueForShelter, patch.status, patch.notes, extraPatch);\n      logRescuerAction(selectedRescueForShelter, 'Initiated Shelter Transfer', 'Transferring rescued animal to shelter: ' + selectedShelter.name, 'in_transit');\n\n      setSubmittingTransfer(false););

const t6 =       Alert.alert(
        'Adoption Successful!';

code = code.replace(t6,       logRescuerAction(report, 'Adopted Rescued Animal', 'Rescuer has successfully adopted the animal', report?.status || '');\n      Alert.alert(\n        'Adoption Successful!');

fs.writeFileSync('app/Rescuer/UserRescuerDashboardScreen.js', code);
console.log('Final patch succeeded');
