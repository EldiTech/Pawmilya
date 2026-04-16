# Pawmilya Guest Flow Script

## Purpose
This script explains the end-to-end flow for a guest user in the app, from first launch up to login handoff points.

## 1. App Entry Flow
1. App opens and shows the main splash screen.
2. It transitions to the cafe splash screen.
3. If onboarding is not yet completed, onboarding is shown.
4. After onboarding (or if already done), the app lands on the Guest Home experience.

## 2. Guest Bottom Navigation Flow
Guest users can navigate these tabs from the bottom bar:
1. Home
2. Pets
3. Rescue
4. Mission
5. Log In

Behavior notes:
1. `Log In` opens the auth flow.
2. `Home` remains the default guest landing page.
3. Tabs are hidden when user-only screens are active after authentication.

## 3. Home Screen Flow (Guest)
1. Screen loads featured pets from the backend.
2. Guest sees welcome banner and CTA.
3. `Get Started` triggers account-required prompt, then redirects to login.
4. `Found a Stray Animal?` card routes directly to Rescue tab.
5. Featured pets are visible, but selecting them prompts login requirement.
6. The `How It Works` carousel explains adoption and rescue journey steps.

## 4. Pets Screen Flow (Guest)
1. Pets list loads with optional search and category filters.
2. Guest can:
   - Search pets
   - Filter by category
   - Change sort mode
   - Open pet detail modal
3. In pet modal:
   - User can inspect pet profile details.
   - `Adopt` requires account and redirects to login/signup path.
4. `Favorite` action also requires account and redirects to login/signup.

## 5. Rescue Screen Flow (Guest)
The Rescue screen has two modes:
1. Rescue Requests
2. Report a Stray

### 5A. Rescue Requests
1. Loads rescue stats (active, volunteers, saved).
2. Loads recent rescue reports.
3. Guest can open report details.
4. If guest taps volunteer/help action, login is required first.
5. If logged-in member taps volunteer, system checks rescuer verification status before allowing dashboard access.

### 5B. Report a Stray (4-Step Form)
Step 1: Basic info
1. Enter report title.
2. Select animal type.
3. Select urgency level.

Step 2: Location
1. Enter location text.
2. Optionally pin location on interactive map.
3. Optionally auto-detect current location.

Step 3: Details
1. Add incident description.
2. Add animal condition.
3. Add estimated number of animals.

Step 4: Photos and contact
1. Add up to 5 photos (camera/gallery).
2. Provide reporter name, phone, and email.
3. Submit rescue report.

Validation and submit behavior:
1. Required fields are validated before step progression and submit.
2. Phone and email formats are validated on submit.
3. Images are converted to base64 and sent with report payload.
4. On success: form resets, tab switches back to requests, data refreshes.

## 6. Mission Screen Flow (Guest)
1. Screen presents app mission, problem statement, solution pillars, history, vision, and values.
2. `Contact Us` offers quick actions (email/call).
3. Mission is informational and does not require login.

## 7. Authentication Handoff Points (Guest -> Auth)
Guest is routed to authentication when attempting restricted actions:
1. Home `Get Started`
2. Home featured pet interaction
3. Pets `Favorite`
4. Pets `Adopt`
5. Rescue volunteering/help actions
6. Bottom `Log In` tab direct access

## 8. Quick Narration Version (For Demo)
"A new user enters Pawmilya through splash and onboarding, then lands on the Guest Home screen. From there, they can explore featured pets, read the mission, and check active rescue requests. If they are ready to help immediately, they can file a rescue report as a guest through a guided 4-step form that captures animal details, location, photos, and contact information. If they try protected actions like adopting, favoriting, or volunteering, the app smoothly redirects them to the login flow. This keeps exploration open while protecting critical adoption and rescue operations through account verification."
