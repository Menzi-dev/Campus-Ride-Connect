# NPRT630 report package

Start with **CampusConnect-Final-Report.docx** or **CampusConnect-Final-Report.pdf**.
The PDF is verified as 20 pages. Word is editable with explicit page breaks;
pagination can vary by Word version/fonts. The Markdown and report-data.json
retain the report content for review and regeneration.

The report follows all four phases in the supplied brief. Its title has fewer
than eleven words. Screens are labelled as schematic designs or fixture-based
captures; no human-test results are invented. The report documents limitations
including schema drift, biometric verification, payment settlement, accessibility
contrast and privileged-account provisioning.

Supporting documents:

- assets/: UML use case, activity, state, class, sequence, ERD, planning and screen figures.
- data-dictionary.csv / .md: individual fields, lengths, source and certainty.
- screen-catalogue.md: every registered route and its purpose.
- usability-study.md / usability-results.csv: protocol and an empty results sheet.
- demo-script.md: presenter walkthrough and Q&A preparation.
- submission-checklist.md: rubric and outstanding evidence.
- validation-summary.json: machine-readable preparation checks.

The folder under submission/ reproduces the downloaded official template:
Code, Demo, Dox and a names file. Rename it once the actual group and leader
are confirmed. Report and dictionary copies are in Dox. Code export and the
final narrated demo remain explicitly pending.

To regenerate, from the project root:

```powershell
python -m pip install --target .report-tools pypdf python-docx reportlab pillow
python docs/report/build_report.py
```

The builder uses local Arial fonts on Windows. It verifies PDF page count,
page headings and embedded Word figures. It never changes backend records.
The builder creates the blank results CSV and names file only if they do not
exist, preserving entered observations and identities. Report content comes
from report-data.json; edit that source before regenerating a reviewed report.

Before submitting, supply names/student numbers and individual contributions,
confirm the required fork, conduct real user testing, record the integrated
demo, and review the report as a group. Do not treat placeholders as evidence.
