# Pawmilya Native Simulation Script (5 People)

This is a live simulation script. Run it exactly in sequence, like role-play testing in a real sprint day.

## Team Roles

1. Person 1 = Guest and Auth Operator
2. Person 2 = User Operator
3. Person 3 = Shelter Operator
4. Person 4 = Rescuer Operator
5. Person 5 = Admin and QA Commander

## Simulation Rules

1. Everyone stays in their role account during simulation.
2. No one skips handoff messages.
3. Every step must produce evidence: screenshot, log, or status note.
4. If a step fails, Person 5 opens a bug and assigns an owner before continuing.

---

## Phase 1: Boot and Access (All Accounts)

What is happening in this phase:
1. The team confirms the app can move from logged-out guest state to role-based logged-in state.
2. This is the foundation check. If auth or routing fails here, every later phase becomes unreliable.

### Scene 1.1
1. Person 1 launches app from logged-out state.
2. Person 1 confirms guest screens are reachable.
3. Person 1 performs sign up and login with 2FA.
4. Person 1 confirms role routing works after successful auth.

What is happening in this scene:
1. Person 1 is validating the security gate and session gate.
2. Successful completion means user identity and role identity are trustworthy for the rest of the simulation.

Expected result:
1. No auth crash.
2. Wrong password shows safe error.
3. Wrong 2FA blocks access.

Handoff message from Person 1:
1. Auth flow ready.
2. Test account credentials shared with team.
3. Route map confirmed for User, Shelter, Rescuer, Admin.

---

## Phase 2: Main Business Simulation (Parallel)

What is happening in this phase:
1. Real role workflows run at the same time, similar to production usage.
2. This phase checks whether updates made by one role are visible and correct for other roles.

### Scene 2.1 User starts adoption intent (Person 2)
1. Person 2 logs in as normal user.
2. Person 2 opens home, browses shelters, selects a pet.
3. Person 2 submits an adoption request.
4. Person 2 checks request status appears in user adoptions.

What is happening in this scene:
1. The user creates the first business event: an adoption request.
2. This event should create records that downstream roles can process.

Expected result:
1. Adoption request created with pending status.
2. User can see request history.

Handoff message from Person 2 to Person 3:
1. New adoption request submitted.
2. Request ID and pet ID shared.

### Scene 2.2 Shelter processes request (Person 3)
1. Person 3 logs in as shelter.
2. Person 3 opens shelter adoption requests list.
3. Person 3 opens request from Person 2.
4. Person 3 approves or rejects with note.
5. Person 3 confirms pet status and request status update.

What is happening in this scene:
1. Shelter acts as decision maker for adoption lifecycle.
2. The system must synchronize shelter decisions back to user-facing status and pet availability.

Expected result:
1. Request status updates successfully.
2. User side receives reflected status.

Handoff message from Person 3 to Person 2 and Person 5:
1. Request processed.
2. Final status and timestamp shared.

### Scene 2.3 Rescuer mission execution (Person 4)
1. Person 4 logs in as rescuer.
2. Person 4 confirms rescuer registration or approved state.
3. Person 4 opens rescue mission list.
4. Person 4 accepts one mission and updates progress.
5. Person 4 marks mission complete.

What is happening in this scene:
1. Rescuer validates operational mission flow independent from adoption flow.
2. Mission status transitions must still update shared records used by shelter and admin.

Expected result:
1. Mission status moves through valid transitions.
2. Related pet or report data is updated.

Handoff message from Person 4 to Person 5:
1. Mission lifecycle completed.
2. Mission ID and final status shared.

---

## Phase 3: Admin Governance and Audit (Person 5)

What is happening in this phase:
1. Admin verifies control-plane integrity for the entire platform.
2. Person 5 confirms policies, approvals, and data consistency across all role actions.

### Scene 3.1 Application approvals
1. Person 5 logs in as admin.
2. Person 5 checks shelter and rescuer application queues.
3. Person 5 approves one pending item and rejects one pending item.

What is happening in this scene:
1. Admin access governance is tested to ensure permissions change safely.
2. Approved and rejected outcomes must both persist and propagate correctly.

Expected result:
1. Approval states persist correctly.
2. Affected roles reflect updated access.

### Scene 3.2 Pet and user integrity checks
1. Person 5 edits one pet profile.
2. Person 5 verifies change appears in role-facing screens.
3. Person 5 checks user management actions do not break auth.

What is happening in this scene:
1. Shared entity integrity is tested using pet and user data.
2. This confirms admin edits are reflected system-wide without side effects.

Expected result:
1. Cross-role data is consistent.
2. No unauthorized action is possible from lower roles.

### Scene 3.3 Rescue and transfer audit
1. Person 5 reviews rescue reports and transfer requests.
2. Person 5 verifies each status transition is legal.
3. Person 5 records defects if mismatch is found.

What is happening in this scene:
1. Admin checks historical traceability and status legality.
2. This catches impossible transitions and missing links before release.

Expected result:
1. Report and transfer trail is traceable.
2. No orphan or impossible status appears.

---

## Phase 4: End-to-End Validation Loop (All 5)

What is happening in this phase:
1. The team repeats key flows with different outcomes to verify stability.
2. This is the confidence pass that checks reliability, not just first-run success.

1. Person 2 creates a second adoption request.
2. Person 3 processes it with opposite decision from first run.
3. Person 2 verifies notification and chat updates.
4. Person 4 performs one more mission update.
5. Person 5 runs final role-access regression.

Release gate:
1. No red screen.
2. No role leakage.
3. No status inconsistency.

---

## Communication Script During Simulation

Use this exact message format in your team chat:

1. Role:
2. Step completed:
3. Entity IDs:
4. Status before:
5. Status after:
6. Evidence:
7. Next role pinged:

---

## Bug Protocol (If Any Step Fails)

What is happening in this protocol:
1. Failures are controlled and resolved with clear ownership.
2. Retest by the original role proves the fix works in the real workflow.

1. Person who found bug posts failure evidence.
2. Person 5 labels severity:
	- P1 = blocks flow
	- P2 = wrong data but workaround exists
	- P3 = UI or minor behavior issue
3. Owner fixes bug.
4. Same step is re-run by original role.
5. Person 5 signs off retest.

---

## End of Simulation Sign-Off

What is happening at sign-off:
1. Every role gives a release decision based on executed evidence.
2. Release can only proceed when all blocking risks are closed.

Each person submits:

1. What I executed:
2. What passed:
3. What failed:
4. Open risks:
5. Ready for release: Yes or No

If any person says No, release is blocked until Person 5 closes the blocker.

---

## One Whole User Flows (Requested)

This section gives full start-to-finish user journeys in one line of flow each.

### Flow A: User Sign In to Become Rescuer

What is happening:
1. A normal user logs in, applies to become rescuer, waits for admin approval, then gets rescuer access.

Step-by-step:
1. User opens app and signs in.
2. User goes to settings and taps Become a Rescuer.
3. User fills rescuer registration form and submits.
4. System sets rescuer status to pending.
5. Admin reviews rescuer application.
6. Admin approves application.
7. User logs in again or refreshes session.
8. User now sees and opens Rescuer Dashboard.
9. User accepts a rescue mission.
10. User updates mission progress until complete.

Expected result:
1. Rescuer status changes from pending to approved.
2. Rescuer dashboard becomes available only after approval.
3. Mission updates save and reflect in admin or shelter records.

### Flow B: User Sign In to Become Shelter Manager

What is happening:
1. A normal user signs in, applies for shelter role, gets approved, and gains shelter manager access.

Step-by-step:
1. User opens app and signs in.
2. User goes to settings and taps Register a Shelter.
3. User submits shelter application details.
4. System sets shelter application status to pending.
5. Admin reviews shelter application.
6. Admin approves application.
7. User logs in again or refreshes session.
8. User now sees Manage My Shelter.
9. User opens shelter dashboard.
10. User configures shelter profile and starts managing pets or requests.

Expected result:
1. Shelter application changes from pending to approved.
2. Shelter manager access appears only after admin approval.
3. Shelter screens are accessible and data is editable.

### Flow C: User Sign In to Adopt

What is happening:
1. A signed-in user finds a pet, submits adoption request, shelter reviews it, and adoption reaches final status.

Step-by-step:
1. User opens app and signs in.
2. User browses available pets.
3. User opens a pet and starts adoption form.
4. User completes all adoption details and payment method if required.
5. User submits adoption request.
6. System records request as pending.
7. Shelter opens adoption requests and reviews submission.
8. Shelter approves or rejects the request.
9. If approved, user and shelter communicate through adoption chat.
10. Shelter proceeds with dispatch, handover, and complete adoption steps.
11. System updates pet listing status and final adoption status.

Expected result:
1. User can track adoption status from pending to final state.
2. Shelter actions are reflected in user adoptions and notifications.
3. Final adoption completion updates pet availability correctly.
