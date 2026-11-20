# Suggested learning path (Task 19)

**Status: planned feature. CPIT-498 has the skeleton only.** The app labels it "Planned feature" until the department has reviewed enough of the list (see below), and every item is labelled "Illustrative example" until two department reviewers approve it.

Supervisor, 10 Nov: say whether the suggested path is built now or planned, and where the courses and certificates come from (a list the team builds and reviews, no external API). Every suggestion must explain why it appears: the gap between the student's current capabilities and the field they want.

## Where the items come from
- **`src/catalog/learning-opportunities.json`**, a local list in the repo, is the only source. There is no API and no scraping, and nothing is fetched from `providerUrl`, which is display text only.
- **Item kinds:**
  - `course`;
  - `certificate`;
  - `university-course`: an official FCIT catalog course whose `teaches` must equal the Task 01 course map.
- **Status** (Task 36, rules in `src/path/review.js`):
  - `illustrative`: not yet reviewed (`reviewers: null`, `reviewedAt: null`);
  - `reviewed`: two department reviewers approved it; `reviewers` holds their two **roles** (never names) and `reviewedAt` the date. An item with one reviewer cannot be `reviewed`;
  - `retired`: kept in the file for history (`retiredAt`), never suggested.
- **Source** (`source.type`): `kau-catalog` (an official catalogue page, `ref` = course code and page), `department-offer` (the department's own offer), `provider-page` (a real provider's own page, e.g. PMI) or `invented` (no real provider). An item with an invented source is never shown: it must be retired. On 2026-11-18 the six invented items were retired (`ba`, `sql`, `cyber-foundations`, `illustrative-testing-basics`, `illustrative-web-basics`, `illustrative-db-operations`). `supports` is the list of capability ids an item closes (the "closesGap" of Task 36; Task 57 named it `supports`, with `teaches` kept as an alias).
- **University courses** come only from `src/catalog/fcit-2024-25.json`, and their `supports` equals the course map (the reviewed map once Task 32 loads the department's answers).
- **Old course-fit cards:** items with a `goals` list also feed the existing course-fit cards. `src/data.js` keeps exactly their old fields. Since Task 36 that view is stored in `src/catalog/course-fit-cards.json` (written by `npm run catalog:course-fit`; a test checks it still matches the list), so only these five cards are in the startup bundle and the full list loads with the Courses view. Retiring an item from the learning path does not change these cards.

## The rules (written, no score)
1. **The gap** (`src/path/gap.js`): for the field the student picks (a reference job profile), each required capability is one of:
   - *sufficient*: strong or moderate evidence;
   - *limited*: limited evidence;
   - *missing*: none.
   
   "Sufficient" means enough evidence for this list, never "mastered". A grade is a clue, not a guarantee.
2. **Suggestions** (`src/path/suggest.js`): an item is suggested only if it teaches a limited or missing capability of that field.
   - Each suggestion names what it closes and why, for example: *The field "Data Analyst" requires Databases, and your record has no evidence for it.*
   - A university course already on the record is never suggested.
   - A prerequisite asks for a basis: any evidence meets it.
3. **Order:**
   1. prerequisites met first;
   2. then items that close a missing capability before those that strengthen a limited one;
   3. then lower level first;
   4. then university course, course, certificate;
   5. then by id.
4. **No gap:** the screen says so and suggests nothing.
5. **Gap the list can't close yet:** the screen names it.

## The "Planned feature" label
The Courses tab keeps "Planned feature" until every capability that a university course links to in the official course map has at least one `reviewed` item that supports it (`pathReviewStatus` in `src/path/review.js`). From then on the label goes, and each reviewed item shows "Reviewed by the department"; items not yet reviewed keep "Illustrative example". Each suggestion's "Why is this here?" shows its source (for a university course: the catalogue page).

## Reviewing the list (Task 36) · مراجعة القائمة
**For the two reviewers** (named by the supervisor):
1. Amjd runs `npm run path-review:export` and gives you `review/learning-path-review-<date>.csv` (one row per item that is still shown; retired items are not in it).
2. Fill **only your own** fields, without looking at the other reviewer's column: your role (for example "Course coordinator, CPIT"; a role, **not your name**), the date (YYYY-MM-DD), and on every row `approve`, `reject` or `retire`, with a note if you like.
   - `approve`: the item is real, its source is right, and it builds the capabilities in `supports_en` / `supports_ar`.
   - `reject`: not now (wrong capability, wrong level, details to fix). It stays an "Illustrative example".
   - `retire`: it should never be suggested (for example the course or certificate no longer exists).
3. Use only the official FCIT Catalog 2024-25, the department's own offers and a real provider's own page. No AI tools. Save as "CSV UTF-8".

**للمراجعَين** (يسميهما المشرف): املأ حقولك فقط دون النظر إلى عمود المراجع الآخر: دورك (مثل «منسق مقررات، قسم تقنية المعلومات»، الدور **لا الاسم**)، والتاريخ (YYYY-MM-DD)، وفي كل سطر `approve` (البند حقيقي ومصدره صحيح ويبني القدرات المذكورة) أو `reject` (ليس الآن؛ يبقى «مثالًا توضيحيًا») أو `retire` (لا يُقترح أبدًا). استخدم الدليل الرسمي لكلية الحاسبات 2024-25 وعروض القسم وصفحة المزوّد الحقيقي فقط، دون أدوات ذكاء اصطناعي. احفظ الملف بصيغة «CSV UTF-8».

**Merging (Amjd):** `npm run path-review:check -- <file>` lists every problem (empty or unknown decision, missing role or date, the same role twice, an item missing, a sheet from another version of the list, an invented item approved) and changes nothing. When it says OK it shows, per item, what the merge would do: both approve → `reviewed` (the two roles, the later date); both retire → `retired`; **any disagreement, or both reject → stays `illustrative`**. Then `npm run path-review:check -- <file> --apply` writes the list, `npm run catalog:course-fit` refreshes the course-fit view, and `npm test` must pass. The `agreement` column in the sheet is an Excel formula for the reviewers' convenience; the check works agreement out itself.

## CPIT-499 (not built yet)
1. Grow the list for the FCIT fields. Each item is reviewed by two department reviewers with the kit above.
2. Measure on a sample of students and items:
   - does each suggestion really close the stated gap?
   - did the students understand the reason?
   
   Report counts, not percentages, and put the result on the test results page only once it is measured.
3. Then remove the "Planned feature" label.
