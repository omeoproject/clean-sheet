# Improving CleanSheet from real feedback (step 6)

**Rule: nothing new gets built because it is easy to build.** Every addition must earn its place from what real users ask for.

## Milestone before anything else

Get **10 real users** to try CleanSheet and learn whether they would pay. Not revenue, not 1,000 customers.

## When a request becomes work

A request moves to "build" only if **all** are true:

1. **Repeated:** asked for by at least 3 independent people (or by one person who clearly would pay and is blocked without it).
2. **On mission:** it helps people clean spreadsheets privately in the browser.
3. **Privacy-safe:** it works without uploading data or adding tracking. If not, it needs an explicit decision and updated privacy copy first.
4. **Smallest first:** ship the minimum version, then ask the requesters if it solved their problem.
5. **Testable:** it comes with tests, and the manual test list is updated.

Log every request in `FEEDBACK.md` so the counts are honest.

## Candidate upgrades (none approved)

Questions to ask users before building, and the risks I already see.

| Idea | Ask users | Risks / notes |
| --- | --- | --- |
| Batch file processing | "How many files do you clean at once, and how big?" | Memory: one 500k-row file already uses about 1 GB. Needs a Web Worker first. |
| Multiple-sheet cleaning | "Do you need every sheet cleaned, or one at a time?" | Today only the selected sheet is exported; other sheets are dropped (the UI warns). Output should be a single workbook. |
| Fuzzy matching ("Jon Smith" ≈ "John Smith") | "What near-duplicates do you actually see?" | False positives are dangerous. Never auto-remove: review each match. Hardest to get right. |
| Saved cleaning rules | "Do you clean the same kind of file repeatedly?" | Can be stored locally in the browser (privacy-compatible); a per-device limitation to explain. |
| Row-limit / performance work | "Did a file fail or freeze?" | The known weak spot: main-thread processing. Likely the first real complaint. |
| Ignore-capitals default | "Did the first result surprise you?" | The landing example ignores capitals but the app is case-sensitive by default. Cheap to change; check what users expect. |

## Weekly loop

1. Read new feedback and GitHub issues; add to `FEEDBACK.md`.
2. Count repeats; apply the rules above.
3. Pick at most one improvement; build the smallest version; test it.
4. Tell the people who asked.
