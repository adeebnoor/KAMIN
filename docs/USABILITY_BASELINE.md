# Usability baseline and comparison: clicks per task

Task 15 · measured 2026-11-11 · Playwright Chromium.
- Desktop: Desktop Chrome, 1280×720.
- Phone: Pixel 7, 412×839.

Task 30 (2026-11-12) added page length, sideways scroll, cut-off text, the Back button and axe on every view: see [Page length and layout](#page-length-and-layout-task-30) below.

Every number below was measured by a script; nothing is estimated. The raw data has every step of every route:
- [`usability/baseline-85ce2ce.json`](usability/baseline-85ce2ce.json): before.
- [`usability/after-task15.json`](usability/after-task15.json): after.

## What is measured
These are the six tasks from the 13 Oct usability run. Each journey starts with the app window already open: the start screen for a new student, or the dashboard for a student with an approved record. It then follows the **shortest route** to the end of the task.

| Measure | Definition |
|---|---|
| **Clicks** | Every click, including ticking a checkbox and pressing a confirmation button. Typing is counted separately as **inputs**. |
| **Screens** | Distinct screens passed through, including the first. A screen is the selected tab plus the visible heading. |
| **Choices** | Visible controls in the app window when the journey starts: buttons, links, form fields, menus and "show more" toggles. The whole screen is counted, not just the part above the fold. |

**Limit:** a script that already knows the route cannot measure whether a student *finds* it. The 13 Oct tester could not find restore, correct, withdraw or delete. That is what the human protocol in [`USABILITY_PROTOCOL.md`](USABILITY_PROTOCOL.md) measures.

## Before and after

**Before:** commit `85ce2ce` (Task 08), the code before the Tasks 09–14 simplification, with its own menus and labels. This baseline was measured after Tasks 09–14 had been written. To measure it, the `85ce2ce` code was checked out in a separate working copy, using the same counting code (`e2e/usability-lib.js`).

**After:** Tasks 09–15. Task 15 adds two small changes, described in the next section.

### Clicks (screens), desktop → phone
| # | Task | Before, desktop | After, desktop | Before, phone | After, phone | Budget |
|---|---|---|---|---|---|---|
| 1a | Reach upload | 0 (1) | 0 (1) | 0 (1) | 0 (1) | 0 |
| 1b | Build a profile (synthetic example, consent, approve) | 3 (3) | 3 (3) | 3 (3) | 3 (3) | 3 |
| 2 | Open a capability's evidence | 1 (2) | **1 (1)** | 2 (2) | **1 (1)** | 1 |
| 3 | Understand a recommendation (evidence, gaps, explanation) | 2 (2) | 2 (2) | 2 (2) | 2 (2) | 2 |
| 4 | Choose a learning step (add a course to compare) | 2 (2) | **3 (3)** ▲ | 3 (2) | 3 (3) | 3 |
| 5a | Save on this device | 1 (1) | 1 (1) | 1 (1) | 1 (1) | 1 |
| 5b | Restore from an encrypted backup (+1 typed passphrase) | 2 (2) | 2 (2) | 2 (2) | 2 (2) | 2 |
| 6a | Correct a grade (+1 typed grade) | 3 (3) | 3 (3) | 3 (3) | 3 (3) | 3 |
| 6b | Withdraw transcript consent | 2 (2) | **3 (3)** ▲ | 2 (2) | **3 (3)** ▲ | 3 |
| 6c | Delete all data | 3 (3) | 3 (4) | 3 (3) | 3 (4) | 3 |

### Choices visible when a journey starts
| Screen | Before, desktop | After, desktop | Before, phone | After, phone | Budget |
|---|---|---|---|---|---|---|
| Start screen (no record yet) | 21 | **10** | 16 | **9** | 10 |
| Dashboard (approved record) | 35 | **22** | 30 | **21** | 22 |

Task 26 (2026-11-15) raised these two budgets to **11** and **24**: the app top bar now has a language button on every screen and a save status chip once there is data (`e2e/usability-budget.json` gives the reason).

## Reading the numbers honestly
- **Fewer choices, by the most:** the start screen shows about half as many controls, and the dashboard about a third fewer. This answers the 13 Oct complaint that "the options were too many and distracting".
- **Evidence is closer:** a capability's evidence opens in place on the dashboard. That is 1 click on both devices, where the phone used to need 2 ("More" then "My skills").
- **Two routes are one click longer, as the price of fewer menu items:**
  - **Withdraw consent (2 → 3):** consents moved from a top-level "Privacy" item into a tab of "My data" ("Consents, saving and deletion").
  - **Choose a course on desktop (2 → 3):** courses moved into a tab of "My next step". On the phone it stays 3, because the old route went through "More".
  - Both stay within the task's example budgets: withdraw ≤ 3, and no route exceeds 3 clicks.
- **The same as before:** building a profile, restoring, correcting and deleting take the same clicks. Delete-all passes one more screen ("My data"), but now has a direct link there; see below.
- **Not done:** the click counts were not pushed below the baseline everywhere. Further cuts would mean bringing back top-level menu items, which works against the "fewer choices" result. The human sessions should decide that trade-off.

## What Task 15 itself changed
1. **A delete-all shortcut on "My data".** The footer of "My data" now has two buttons: "Consents and backup" and "Delete all my data from this device". The second opens the existing confirmation, which still lists what will be deleted. That makes delete-all 3 clicks: My data → shortcut → confirm.
   - Without the shortcut, the route after Tasks 09–14 went through the consents tab.
   - That route was not measured, so no number is given for it.
2. **The "Add project evidence" form on the dashboard starts closed.** It had opened by default whenever no project had been added yet. That added 17 controls (fields, a menu and 11 capability chips) to a dashboard the student had not asked to edit.
   - Measured: 39 → 22 controls on desktop, 38 → 21 on the phone.
   - The form is one click away ("Add project evidence"), and nothing about how project evidence is reviewed changed.

## The guard
- `e2e/usability-journeys.spec.js` runs in `npm run e2e`.
- It writes `test-results/usability.json` (one key per browser) and **fails if any route needs more clicks**, or any start screen shows more choices, than [`e2e/usability-budget.json`](../e2e/usability-budget.json) allows.
- **Checked once:** an extra click was added to the delete-all route. The test failed on both browsers ("delete-all-data: EXTRA STEP → my data → delete all my data → confirm · Expected: <= 3 · Received: 4"). The change was then reverted.
- **Raising a budget number** needs a reason in the PR.

## Page length and layout (Task 30)

Measured 2026-11-12 on branch `ui2/guards`, before Tasks 20–29 · Playwright Chromium · synthetic example · the same two projects as above (desktop 1280×720, phone Pixel 7 412×839).

**Reference machine: Linux, as in CI.** The quality gate runs on GitHub's `ubuntu-24.04`, so the numbers below and the budget are the Linux numbers: the CI run of `05d36d9` (GitHub Actions run 43259280915), repeated to the pixel three more times in the `mcr.microsoft.com/playwright:v1.63.0-noble` image. Raw data: [`usability/before-task30-linux.json`](usability/before-task30-linux.json). The first measurement was taken on Windows ([`usability/before-task30.json`](usability/before-task30.json)); see [Windows and Linux](#windows-and-linux) for the views that differ and why.

Task 15 counts clicks and choices. It did not see a 28-screen Matches page, a table that scrolls sideways, cut-off course names, Back leaving the site, or a message on top of the heading. `e2e/page-length.spec.js` and `e2e/a11y-all-views.spec.js` open **every app view** (the list `APP_VIEWS` in `e2e/nav.js`, 11 views) in Arabic and English on both projects and measure these.

| Measure | Definition |
|---|---|
| **Screens** | Height of everything in the app's scrolling area (`.app-content-wrap`) divided by the height visible at once: 612px on desktop, 693px on the phone. 1.0 means no scrolling. |
| **Wider than its box** | At 360px wide: elements inside the app view whose content is wider than the element (`scrollWidth > clientWidth + 1`). They scroll sideways or cut their content. An element marked `data-scroll-x` is sideways scroll chosen on purpose and is not counted; nothing is marked today. |
| **Cut-off text fields** | At 360px wide: text fields that show only part of their text (`scrollWidth > clientWidth`). |

### Page length in screens
| View | Before, desktop AR | Before, desktop EN | Before, phone AR | Before, phone EN | After Tasks 20–29 |
|---|---|---|---|---|---|
| Start screen (no record yet) | 1.1 | 1.1 | 1.0 | 1.1 | not measured yet |
| Review (synthetic example) | 2.8 | 2.8 | 2.7 | 3.2 | not measured yet |
| Dashboard (right after approval) | 1.6 | 1.7 | 2.2 | 2.5 | not measured yet |
| Matches | 13.0 | 14.5 | 24.4 | **28.1** | not measured yet |
| Courses | 4.8 | 5.6 | 6.2 | 7.8 | not measured yet |
| Compare (empty) | 1.1 | 1.1 | 1.0 | 1.2 | not measured yet |
| Show connections | 4.7 | 5.1 | 5.6 | 6.4 | not measured yet |
| Interests & goal (before consent) | 1.3 | 1.4 | 1.6 | 1.8 | not measured yet |
| My data: review & correct | 2.9 | 2.9 | 2.6 (2.7 since PR #27) | 2.6 (2.9 since PR #27) | not measured yet |
| Consent, saving & deletion | 6.3 | 6.6 | 7.1 | 7.9 | not measured yet |
| Usage log | 1.3 | 1.3 | 1.2 | 1.3 | not measured yet |

The "before" columns are the budget in [`e2e/usability-budget.json`](../e2e/usability-budget.json) (`screens`). The test allows 3% on top (at least a tenth of a screen), because the same page comes out a few pixels longer or shorter with another machine's fonts.

**My data on the phone is the one budget that went up, and why.** The "before" numbers were measured while My data was 702px wide on the phone (see "Known layout problems" below), so its text ran in long lines off the side of the screen. PR #27 (merged 2026-11-13) made the page fit the screen; the text now wraps at the phone's width and the page is taller. Measured on Linux on 2026-11-13: phone AR 1787 → 1863px (2.6 → 2.7 screens), phone EN 1808 → 1994px (2.6 → 2.9 screens); desktop unchanged (1797px and 1787px, 2.9). The budget uses the new Linux numbers. Every other view measured the same as before, to the pixel.

**Not the same numbers as the task brief.** The brief lists numbers from a hand walk-through in other window sizes: desktop 1366×768 English and phone 390×844 Arabic (for example Matches 13.4 and 27.2 screens). Those were measured by the brief's author, not by this suite, and are not repeated here. Window size changes the result, so compare a later run only with the table above.

### Windows and Linux
The same code gives the same numbers on both systems for every view except the ones below. The fonts are the same (both use the bundled Inter and Noto Sans Arabic; Chromium reports the same fonts and glyph counts). Windows and Linux measure the same text a fraction of a pixel differently, and a line that sits exactly at the edge of its box breaks on one system and not on the other.

| View, project, language | Windows | Linux | What breaks differently |
|---|---|---|---|
| Courses, desktop EN | 5.3 (3257px) | **5.6** (3418px) | In every course card, "Review this judgment" and "Contest this judgment" are 194.23 + 219.70px wide on Windows and fit next to each other in the 425px row; on Linux they are 198 + 221px and the second button goes to a new row (+53px per card). |
| Courses, phone AR | 6.7 (4619px) | **6.2** (4323px) | In every course card, "ترتيب مبدئي" and the note next to it fill the 346px row exactly. Windows breaks the line, Linux does not (−59px per card). |
| Courses, phone EN | 7.7 (5338px) | 7.8 (5388px) | One line more in the last card's reasons. |
| Show connections, phone AR / EN | 5.5 / 6.3 | 5.6 / 6.4 | 52px / 26px longer on Linux. |
| Matches, phone AR | 24.3 | 24.4 | 24px longer on Linux. |
| Review at 360px, EN: cut-off fields | 18 | 17 | The Grade 4 field is 33px wide for 34px of text on Windows, 34px on Linux. |

The budget uses the Linux numbers because CI decides. On Windows, `npm run e2e` therefore fails two checks, both because Windows wraps a line that Linux does not (Courses on the phone in Arabic, 6.7 > 6.4 allowed; Review cut-off fields in English, 18 > 17). To get the CI result on a Windows machine, run the suite in the Playwright image. The 3% allowance was not changed: the two Courses differences (+5% and −7%) are one wrapped line repeated in every card, and a larger allowance would hide real growth on every other view.

### Known layout problems at 360px (recorded, not hidden)
The same counts were measured in both projects.

| View | Wider than its box | Cut-off text fields (AR / EN) | What it is | Fixed by |
|---|---|---|---|---|
| Review | 1 | 14 / 17 | The course table is 650px (AR) or 717px (EN) wide in a 292px box. Code and name fields are 40–42px wide, so every code and name is cut; in English three grades are cut too (four on Windows). | Task 22 |
| My data: review & correct | 1 (was 3) | 2 / 6 | Was: **the whole page scrolled sideways** (content 702px wide in a 360px window: `div.app-content-wrap`, `section.app-content` and the My data block). **Fixed by PR #27** (2026-11-13): the page fits, and the one element left is the course table inside its own scroll box (`div.table-scroll`, 650px in 292px), like Review. Course names are still cut. | Page: PR #27. Table and cut names: Task 22 |
| Matches | 1 | 0 | The pathway comparison table (600px in a 292px box). It is a labelled scroll region. | No task yet |
| Show connections | 2 | 0 | The relationship map (1000px in a 326px box, a labelled scroll region) and the RDF list (650px in 294px). | No task yet |
| Interests & goal | 1 | 0 | The intro block is 14px wider than its box (342px in 328px). | No task yet |
| The other six views | 0 | 0 | | |

Each count is the budget for its view (`sidewaysScroll360`, `cutOffInputs360`), so a view fails the suite if it gets worse, and a view that is clean today fails on its first overflow. The task that fixes a view sets its count to 0 in the same PR. For the three "no task yet" rows the team has to decide: fix the layout, or mark the element `data-scroll-x` because the sideways scroll is wanted.

**An older test missed the My data problem.** `e2e/compact-layout.spec.js` (Task 13) checked sideways scroll 150ms after opening each view. On "My data" the page content had not loaded yet at that moment, so the check passed on an empty page. The new check waits until the view stops changing height. PR #27 changed the older test too: it now waits until the view's loading placeholder is gone and then for the same `settle()` (imported from `e2e/nav.js`), so both tests measure the loaded page.

### Back button and messages
| Check | Today (both projects) | Fixed by |
|---|---|---|
| Open the app → Matches → Compare → Back, Back, Back | The first Back leaves KAMIN (the browser went to the page before it, `about:blank` in the test). Wanted: Matches, then the first screen, then the app closes. | Task 20 |
| Right after approval, no message lies on the page heading | The toast covers part of the heading: 416×16px (AR) and 416×34px (EN) on desktop, 380×34px (AR) and 380×63px (EN) on the phone. | Task 25 |

Both checks run in every `npm run e2e` and write what they saw to `test-results/usability.json`. While a problem is listed under `knownProblems` in the budget file, the test does not fail on it. The task that fixes it deletes the entry in the same PR; from then on the test fails if the problem returns.

### axe on every view
`e2e/a11y-all-views.spec.js` runs axe on all 11 views, in Arabic and English, on both projects (44 scans). Measured 2026-11-12: **0 serious or critical violations.** Only serious and critical violations fail the test, as in the other specs.

### Checked once (then reverted)
- **10 extra cards on Matches:** the page-length test failed in both languages on both projects ("matches (en) is 53.3 screens long (36933px in a 693px window). Budget: 28.1 screens, plus the allowance.").
- **A fixed-width (900px) table on Review:** the 360px test failed in both languages on both projects ("review (ar) has content wider than its box: div.table-scroll 900>292 | div.table-scroll 650>292").
- **The two `knownProblems` entries removed:** the Back test and the message test failed on both projects.

### After Tasks 20–29
Run `npm run build && npm run e2e`, read `test-results/usability.json`, and fill the "After" column from it. Lower each budget to the new measured value in the PR of the task that changed the view.

## Rerunning the baseline
```bash
git worktree add ../KAMIN-baseline 85ce2ce --detach
cd ../KAMIN-baseline
npm ci
npm run build
cp ../KAMIN/docs/usability/baseline-85ce2ce.spec.js e2e/zz-baseline.spec.js
cp ../KAMIN/e2e/usability-lib.js e2e/
npx playwright test e2e/zz-baseline.spec.js   # writes test-results/usability-baseline.json
cd ../KAMIN && git worktree remove ../KAMIN-baseline --force
```
