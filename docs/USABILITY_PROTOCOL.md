# Usability protocol: six tasks with FCIT students

Task 15 · **Status: approved by the supervisor (recorded 2026-11-11); no session has taken place yet.** The consent text is `pilot-consent-v1-2026-11-11` in `src/content/pilotConsent.js`. Before the first session, write down where the study files are kept, when they are deleted, and the session dates (see the open items in `PILOT_PROTOCOL_DRAFT.md`). The wider pilot plan is in [`PILOT_PROTOCOL_DRAFT.md`](PILOT_PROTOCOL_DRAFT.md); this protocol is the short usability part of it.

## Purpose
Check whether students can **find and finish** the six tasks without help. The automated click budget ([`USABILITY_BASELINE.md`](USABILITY_BASELINE.md)) cannot measure this, because the script already knows the route.

This protocol does **not** assess the student, their grades or their job readiness.

## Participants
- **At least 5 FCIT students** (final year or recent graduates), invited by the team after supervisor approval.
- Participation is voluntary, and a student can stop at any time without giving a reason.

## Data rules
- **Synthetic transcripts only.** Every participant uses the app's built-in synthetic example (`جرّب المثال التوضيحي`) or the same prepared synthetic transcript file. No participant uploads their own record.
- **No personal data is recorded.**
  - Do not record names, student IDs, emails, screen recordings or audio.
  - Each session gets a code (P1, P2, …).
  - Notes are written on the sheet below only.
- **A shared, clean device:**
  - Run every session in a fresh private browser window.
  - Open Kamin with the study link (`/ar/?pilot=1` or `/en/?pilot=1`, Task 18). The student reads the consent screen and agrees there; in study mode the example button loads the trial's synthetic transcript.
  - At the end (Task 18): fill in the "End of the session" form with the student. It holds the six task results, one overall clarity question and an optional comment; the per-task time, clarity and "where they got stuck" stay on the paper sheet below. The student reviews the anonymous study file, downloads it and hands it over. Then they press "Delete the session data from this device".
  - Use "Delete all my data from this device" at the end. During the trial this keeps the study file until the session ends, and says so.
- Write down the commit or URL tested and the date before the first session.

## Session (about 20 minutes)
1. **Read the consent text** approved by the supervisor, and get verbal agreement. Remind the student that the app is being tested, not them.
2. **Give the six tasks one at a time**, read aloud in the student's preferred language (Arabic or English). Do not show the route or name the buttons.

| # | Task as read to the student | Done when |
|---|---|---|
| 1 | "Build your capability profile using the example transcript." | The student sees their capabilities after approving the record |
| 2 | "Find which courses support one of your capabilities." | The student opens a capability and points to its courses |
| 3 | "Pick one suggested path and find why it was suggested and what is missing." | The student opens the explanation and names one gap |
| 4 | "Choose one course you could take next and put it in your comparison." | The course is added to the comparison |
| 5 | "Keep your profile on this device. Then imagine a new phone: bring your profile back from the backup file we give you." | The profile is saved, then restored from the prepared encrypted backup and passphrase |
| 6 | "Change the grade of one course; then stop the app from using your transcript; then delete everything from this device." | The grade is changed, the transcript consent is withdrawn and the deleted confirmation shows |

3. **Ask one clarity question** after each task: "How clear was it what to do? 1 = not clear at all, 5 = very clear."
4. **At the end, ask one open question:** "What, if anything, confused you?" Write it down in the student's words, without any personal details.

## What to record per task
| Field | Values |
|---|---|
| Result | **Success** (alone) · **With help** (the facilitator gave any hint) · **Failed** (gave up, or more than 5 minutes) |
| Time | Seconds from the end of reading the task to "Done when", or until it failed |
| Clarity | 1–5 |
| Where they got stuck | Free text: the screen and what they looked for. No personal details. |

**Hints are given only after 60 seconds without progress**, and every hint turns the result into "With help".

## Reporting
- **Per task:** count success, with help and failed separately. Give the median time and the median clarity. With at least 5 students, report counts ("4 of 5"), never percentages.
- **Linking to the clicks:** compare each task with its automated click count in `USABILITY_BASELINE.md`. A task with few clicks but frequent "With help" is a findability problem, not a length problem.
- **Changes after the sessions:** go through a PR as usual. The click budget must still pass. Re-run the protocol after any large change to navigation.
